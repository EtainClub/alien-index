import { readFileSync } from "node:fs";

const envText = readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.replace(/^['"]|['"]$/g, "")]),
);
const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
if (!apiKey) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY is missing from .env.local");

const authResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ returnSecureToken: true }),
});
const authPayload = await authResponse.json();
if (!authResponse.ok) throw new Error(`Anonymous auth failed (${authResponse.status})`);

const questionIds = [
  "hidden-links", "dream-places", "small-signals", "watch-first", "new-angle", "vivid-world",
  "unspoken-rules", "atmosphere", "solo-flow", "odd-customs", "first-contact", "translate",
];
const response = await fetch("https://asia-northeast3-alien-index.cloudfunctions.net/createScan", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${authPayload.idToken}`,
    Origin: "https://alien-index.web.app",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    data: {
      mode: "quick",
      inputVersion: "quick-v1",
      answers: Object.fromEntries(questionIds.map((id) => [id, 2])),
      gameSignals: { patternChoice: 0 },
      photoKinds: [],
      consentVersion: "privacy-2026-07",
    },
  }),
});
const payload = await response.json();
console.log(JSON.stringify({ status: response.status, ok: response.ok, payload }));
