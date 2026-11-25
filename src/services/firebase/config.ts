/**
 * Firebase configuration from Vite env vars (see .env.example).
 * With VITE_USE_FIREBASE_EMULATORS=true and a "demo-*" project id, no real
 * credentials are needed — everything runs against the local Emulator Suite.
 */
const env = import.meta.env;

export const useEmulators = env.VITE_USE_FIREBASE_EMULATORS === "true";

const projectId = env.VITE_FIREBASE_PROJECT_ID ?? (useEmulators ? "demo-partey" : undefined);

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? (useEmulators ? "demo-api-key" : undefined),
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL ?? (projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : undefined),
};

export const functionsRegion = env.VITE_FIREBASE_FUNCTIONS_REGION ?? "asia-southeast1";

/** Emulator host: defaults to the page's hostname so phones on the LAN reach the dev machine. */
export const emulatorHost = env.VITE_EMULATOR_HOST ?? (typeof window !== "undefined" ? window.location.hostname : "127.0.0.1");

export const missingConfigKeys = (["apiKey", "projectId", "databaseURL"] as const).filter((k) => !firebaseConfig[k]);
export const isFirebaseConfigured = missingConfigKeys.length === 0;
