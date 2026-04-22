// src/email.js
// Sends acknowledgement email via EmailJS (zero-backend, free tier)
// https://emailjs.com  →  create account → Email Service → Email Template

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

const isConfigured = [SERVICE_ID, TEMPLATE_ID, PUBLIC_KEY].every(
  v => v && !v.startsWith("your_")
);

/**
 * Send a report-acknowledgement email to the reporter.
 *
 * EmailJS template should use these variables:
 *   {{to_email}}   — reporter's email
 *   {{verdict}}    — FAKE / REAL
 *   {{confidence}} — e.g. "94.3%"
 *   {{url}}        — reported URL
 *   {{site}}       — platform name
 *   {{report_id}}  — Firestore doc ID (or "N/A")
 */
export async function sendAckEmail({ email, verdict, confidence, url, site, report_id }) {
  if (!isConfigured) {
    console.warn("EmailJS not configured — skipping acknowledgement email.");
    return;
  }

  // Lazy-load EmailJS SDK (keeps bundle small)
  const emailjs = await import("https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js")
    .then(() => window.emailjs)
    .catch(() => null);

  if (!emailjs) {
    console.warn("EmailJS SDK failed to load.");
    return;
  }

  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      to_email:   email,
      verdict,
      confidence: `${(confidence * 100).toFixed(1)}%`,
      url,
      site,
      report_id:  report_id ?? "N/A",
    },
    PUBLIC_KEY
  );
}
