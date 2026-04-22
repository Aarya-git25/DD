// src/api.js
// Thin wrapper around the FastAPI backend

const BASE = import.meta.env.VITE_API_URL || "/api";

/**
 * Send a video file to the FastAPI /predict endpoint.
 * onProgress(pct: 0-100, msg: string) called during XHR upload.
 *
 * Returns: { label, confidence, frame_scores, frame_count, processing_time_ms }
 */
export function predictVideo(file, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("video", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/predict`);

    // Upload progress (0-50%)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 50);
        onProgress(pct, `Uploading… ${pct}%`);
      }
    };

    // Simulate frame-processing progress (50-95%) while waiting for inference
    let fakeProgress = 50;
    const ticker = setInterval(() => {
      if (fakeProgress < 95) {
        fakeProgress += Math.random() * 4;
        const frame = Math.round(((fakeProgress - 50) / 45) * 15);
        onProgress(Math.round(fakeProgress), `Analyzing frame ${Math.min(frame, 15)}/15…`);
      }
    }, 200);

    xhr.onload = () => {
      clearInterval(ticker);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          onProgress(100, "Inference complete.");
          resolve(data);
        } catch {
          reject(new Error("Invalid JSON from server"));
        }
      } else {
        let msg = `Server error ${xhr.status}`;
        try { msg = JSON.parse(xhr.responseText).detail ?? msg; } catch {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => { clearInterval(ticker); reject(new Error("Network error — is the backend running?")); };
    xhr.ontimeout = () => { clearInterval(ticker); reject(new Error("Request timed out")); };
    xhr.timeout = 120_000; // 2 min for large videos

    xhr.send(fd);
  });
}

/** Check backend health */
export async function getHealth() {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) throw new Error("Backend unreachable");
  return res.json();
}
