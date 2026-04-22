// src/firebase.js
// Reads config from .env.local — never hardcode credentials here

import { initializeApp } from "firebase/app";
import { getFirestore }   from "firebase/firestore";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Only init if credentials are provided
const isConfigured = Object.values(firebaseConfig).every(
  v => v && !v.startsWith("your_")
);

let db = null;

if (isConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch (e) {
    console.warn("Firebase init failed:", e.message);
  }
} else {
  console.warn("Firebase not configured — reports will use local storage fallback.");
}

export { db, isConfigured };
