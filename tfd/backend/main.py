"""
Temporal Forgery Detector — FastAPI Backend
==========================================
POST /predict   multipart/form-data { video: File }
  → { label, confidence, frame_scores, frame_count, processing_time_ms }

POST /reports   JSON report body  → stored in Firestore
GET  /reports   → list of all reports (admin)
GET  /health    → server + model status
"""

import os, time, io, tempfile, logging
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
import torch
import torch.nn as nn
from torchvision import models, transforms
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import firebase_admin
from firebase_admin import credentials, firestore

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("tfd")

# ─── CONFIG ────────────────────────────────────────────────────────────────
MODEL_PATH   = Path(os.getenv("MODEL_PATH",   "deepfake_video_model.pth"))
FIREBASE_SA  = Path(os.getenv("FIREBASE_SA",  "firebase-service-account.json"))
NUM_FRAMES   = int(os.getenv("NUM_FRAMES",    "15"))
THRESHOLD    = float(os.getenv("THRESHOLD",   "0.5"))
DEVICE       = "cuda" if torch.cuda.is_available() else "cpu"

# ─── MODEL DEFINITION (must match training arch exactly) ───────────────────
class DeepfakeModel(nn.Module):
    def __init__(self):
        super().__init__()
        resnet = models.resnet50(weights=None)
        self.cnn  = nn.Sequential(*list(resnet.children())[:-1])
        self.lstm = nn.LSTM(input_size=2048, hidden_size=128,
                            num_layers=1, batch_first=True)
        self.fc   = nn.Linear(128, 1)

    def forward(self, x):
        batch, frames, C, H, W = x.size()
        x        = x.view(batch * frames, C, H, W)
        features = self.cnn(x).view(batch, frames, 2048)
        out, _   = self.lstm(features)
        return self.fc(out[:, -1, :])

    def forward_frames(self, x):
        """Returns per-frame scores (for the timeline UI)."""
        batch, frames, C, H, W = x.size()
        x        = x.view(batch * frames, C, H, W)
        features = self.cnn(x).view(batch, frames, 2048)
        out, _   = self.lstm(features)
        # score every prefix ending at each frame
        return torch.sigmoid(self.fc(out)).squeeze(-1)   # (batch, frames)

# ─── TRANSFORM (identical to training) ─────────────────────────────────────
TRANSFORM = transforms.Compose([
    transforms.ToPILImage(),
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225]),
])

# ─── GLOBALS (loaded once at startup) ──────────────────────────────────────
model: Optional[DeepfakeModel] = None
db:    Optional[object]        = None

# ─── APP ────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Temporal Forgery Detector API",
    version="0.9.1",
    description="ResNet50+LSTM deepfake video detection backend",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production → your Vercel domain
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    global model, db

    # ── Load model ──────────────────────────────────────────────────────────
    if MODEL_PATH.exists():
        log.info(f"Loading model from {MODEL_PATH} on {DEVICE}…")
        model = DeepfakeModel().to(DEVICE)
        state = torch.load(MODEL_PATH, map_location=DEVICE)
        model.load_state_dict(state)
        model.eval()
        log.info("Model loaded ✓")
    else:
        log.warning(f"Model weights not found at {MODEL_PATH}. /predict will return mock data.")

    # ── Firebase ─────────────────────────────────────────────────────────────
    if FIREBASE_SA.exists():
        try:
            cred = credentials.Certificate(str(FIREBASE_SA))
            firebase_admin.initialize_app(cred)
            db = firestore.client()
            log.info("Firebase connected ✓")
        except Exception as e:
            log.warning(f"Firebase init failed: {e}. Reports will not be persisted.")
    else:
        log.warning(f"Firebase service account not found at {FIREBASE_SA}. Reports disabled.")


# ─── HELPERS ────────────────────────────────────────────────────────────────
def extract_frames(video_path: str, n: int = NUM_FRAMES) -> np.ndarray:
    """Extract n evenly-spaced frames from a video file."""
    cap    = cv2.VideoCapture(video_path)
    total  = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total == 0:
        raise ValueError("Could not read any frames from video.")
    idxs   = np.linspace(0, total - 1, n, dtype=int)
    frames = []
    for idx in idxs:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ok, frame = cap.read()
        if not ok:
            # fallback: use last good frame
            frame = frames[-1] if frames else np.zeros((224, 224, 3), dtype=np.uint8)
        frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    cap.release()
    return frames


def preprocess(frames) -> torch.Tensor:
    tensors = [TRANSFORM(f) for f in frames]
    return torch.stack(tensors).unsqueeze(0).to(DEVICE)   # (1, T, C, H, W)


# ─── ROUTES ─────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status":       "ok",
        "model_loaded": model is not None,
        "firebase":     db is not None,
        "device":       DEVICE,
        "num_frames":   NUM_FRAMES,
        "threshold":    THRESHOLD,
    }


@app.post("/predict")
async def predict(video: UploadFile = File(...)):
    t0 = time.time()

    # ── Validate ─────────────────────────────────────────────────────────────
    allowed = {"video/mp4", "video/x-msvideo", "video/quicktime",
               "video/webm", "video/x-matroska", "application/octet-stream"}
    if video.content_type not in allowed:
        raise HTTPException(400, f"Unsupported file type: {video.content_type}")

    # ── Write to temp file (OpenCV needs a path) ─────────────────────────────
    suffix = Path(video.filename).suffix or ".mp4"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await video.read())
        tmp_path = tmp.name

    try:
        frames = extract_frames(tmp_path)

        # ── MOCK mode (no weights loaded) ────────────────────────────────────
        if model is None:
            conf         = float(np.random.uniform(0.4, 0.99))
            frame_scores = [float(np.random.uniform(0.2, 0.99)) for _ in frames]
        else:
            x = preprocess(frames)
            with torch.no_grad():
                logit        = model(x)
                conf         = float(torch.sigmoid(logit).item())
                raw_fs       = model.forward_frames(x)      # (1, T)
                frame_scores = raw_fs[0].cpu().tolist()

        label = "FAKE" if conf > THRESHOLD else "REAL"
        ms    = round((time.time() - t0) * 1000)
        log.info(f"predict → {label} ({conf:.3f}) in {ms}ms")

        return {
            "label":               label,
            "confidence":          round(conf, 4),
            "frame_scores":        [round(s, 4) for s in frame_scores],
            "frame_count":         len(frames),
            "processing_time_ms":  ms,
        }

    except Exception as e:
        log.error(f"Inference error: {e}")
        raise HTTPException(500, f"Inference failed: {e}")
    finally:
        os.unlink(tmp_path)


# ─── REPORT SCHEMA ─────────────────────────────────────────────────────────
class ReportIn(BaseModel):
    email:       str
    url:         str
    site:        str
    description: Optional[str] = ""
    confidence:  Optional[float] = None
    verdict:     Optional[str]   = None
    has_screenshot: bool = False


@app.post("/reports")
async def submit_report(report: ReportIn):
    if db is None:
        raise HTTPException(503, "Report storage unavailable (Firebase not configured).")
    try:
        doc = report.dict()
        doc["timestamp"] = firestore.SERVER_TIMESTAMP
        ref = db.collection("reports").add(doc)
        log.info(f"Report saved: {ref[1].id}")
        return {"status": "ok", "report_id": ref[1].id}
    except Exception as e:
        log.error(f"Firestore error: {e}")
        raise HTTPException(500, f"Could not save report: {e}")


@app.get("/reports")
async def get_reports(limit: int = 100):
    if db is None:
        raise HTTPException(503, "Firebase not configured.")
    docs = db.collection("reports").order_by(
        "timestamp", direction=firestore.Query.DESCENDING
    ).limit(limit).stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]
