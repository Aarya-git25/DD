# 🎞 Temporal Forgery Detector

A deepfake video detection app with a 90s GUI aesthetic. Built with:

- **Model**: ResNet50 (CNN) + LSTM, trained on face-extracted video frames
- **Backend**: FastAPI (Python) — inference + report storage
- **Frontend**: React + Vite — 90s CRT-style UI
- **Database**: Firebase Firestore — report persistence
- **Email**: EmailJS — acknowledgement emails (zero-backend)

---

## Project Structure

```

├── backend/
│   ├── main.py                     # FastAPI app
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example                # → copy to .env
│   └── deepfake_video_model.pth    # ← add your weights here (not in git)
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Main UI (all tabs)
│   │   ├── api.js                  # FastAPI client
│   │   ├── firebase.js             # Firestore client
│   │   ├── email.js                # EmailJS helper
│   │   └── main.jsx                # React entry
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── .env.example                # → copy to .env.local
│
├── .gitignore
└── README.md
```

---

## Quickstart

### 1. Backend

```bash
cd backend

# Copy env and fill in values
cp .env.example .env

# Add your model weights
cp /path/to/deepfake_video_model.pth .

# Install dependencies (use a venv!)
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run
uvicorn main:app --reload --port 8000
```

The backend runs in **mock mode** if `deepfake_video_model.pth` is missing
(returns random scores). Good for frontend testing.

Visit http://localhost:8000/docs for the auto-generated Swagger UI.

### 2. Frontend

```bash
cd frontend

# Copy env and fill in values
cp .env.example .env.local

# Install and run
npm install
npm run dev
```

App runs at http://localhost:5173

---

## Configuration

### Backend `.env`

| Variable      | Default                         | Description                          |
|---------------|---------------------------------|--------------------------------------|
| `MODEL_PATH`  | `deepfake_video_model.pth`      | Path to PyTorch weights              |
| `FIREBASE_SA` | `firebase-service-account.json` | Firebase Admin SDK service account   |
| `NUM_FRAMES`  | `15`                            | Frames sampled per video (match training) |
| `THRESHOLD`   | `0.5`                           | Fake/Real decision boundary          |

### Frontend `.env.local`

| Variable                        | Description                              |
|---------------------------------|------------------------------------------|
| `VITE_API_URL`                  | FastAPI URL (default: `http://localhost:8000`) |
| `VITE_FIREBASE_API_KEY`         | Firebase Web SDK config                  |
| `VITE_FIREBASE_AUTH_DOMAIN`     | Firebase Web SDK config                  |
| `VITE_FIREBASE_PROJECT_ID`      | Firebase Web SDK config                  |
| `VITE_FIREBASE_STORAGE_BUCKET`  | Firebase Web SDK config                  |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Web SDK config              |
| `VITE_FIREBASE_APP_ID`          | Firebase Web SDK config                  |
| `VITE_EMAILJS_SERVICE_ID`       | EmailJS service ID                       |
| `VITE_EMAILJS_TEMPLATE_ID`      | EmailJS template ID                      |
| `VITE_EMAILJS_PUBLIC_KEY`       | EmailJS public key                       |

---

## Setting Up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com) → Create project
2. **Firestore**: Build → Firestore Database → Create (start in test mode for dev)
3. **Backend service account**: Project Settings → Service Accounts → Generate new private key → save as `backend/firebase-service-account.json`
4. **Frontend config**: Project Settings → General → Your apps → Add app (Web) → copy config values to `frontend/.env.local`

### Firestore Security Rules (production)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /reports/{doc} {
      allow create: if true;         // anyone can submit
      allow read:   if false;        // lock down dashboard reads (add auth later)
    }
  }
}
```

---

## Setting Up EmailJS

1. Sign up at [emailjs.com](https://emailjs.com)
2. Add an Email Service (Gmail, Outlook, etc.)
3. Create a template — use these variables:
   - `{{to_email}}` — reporter's address
   - `{{verdict}}` — FAKE or REAL
   - `{{confidence}}` — e.g. 94.3%
   - `{{url}}` — reported URL
   - `{{site}}` — platform
   - `{{report_id}}` — Firestore document ID
4. Copy Service ID, Template ID, and Public Key to `frontend/.env.local`

---

## Deployment

### Backend — Railway (recommended, free tier)

```bash
# From backend/
railway init
railway up
```
Set env vars in Railway dashboard. Copy the deployment URL to `VITE_API_URL` in frontend.

### Frontend — Vercel

```bash
cd frontend
npm run build
vercel --prod
```
Set all `VITE_*` env vars in Vercel dashboard.

### Docker (backend)

```bash
cd backend
docker build -t tfd-backend .
docker run -p 8000:8000 \
  -v $(pwd)/deepfake_video_model.pth:/app/deepfake_video_model.pth \
  -v $(pwd)/firebase-service-account.json:/app/firebase-service-account.json \
  --env-file .env \
  tfd-backend
```

---

## API Reference

| Method | Endpoint    | Body                      | Returns                                         |
|--------|-------------|---------------------------|-------------------------------------------------|
| GET    | `/health`   | —                         | Server + model status                           |
| POST   | `/predict`  | `multipart/form-data` (video file) | `{label, confidence, frame_scores, ...}` |
| POST   | `/reports`  | JSON report object        | `{status, report_id}`                           |
| GET    | `/reports`  | —                         | Array of reports                                |

### `/predict` response

```json
{
  "label": "FAKE",
  "confidence": 0.8731,
  "frame_scores": [0.12, 0.45, 0.78, ...],
  "frame_count": 15,
  "processing_time_ms": 1240
}
```

---

## Notes

- Model runs on CPU if no GPU is available (slower but works)
- The `.pth` file is excluded from git — add it manually after cloning
- Firebase and EmailJS are both optional — app degrades gracefully without them
- The Instagram report button redirects to Meta's official deepfake report form
