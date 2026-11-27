import type { Analytics } from "firebase/analytics";
import { firebaseApp, firebaseConfig, isFirebaseConfigured, useEmulators } from "./config";

/**
 * Google Analytics (GA4) via Firebase. Off unless VITE_FIREBASE_MEASUREMENT_ID is set, and never
 * against the emulators. Page views are automatic (GA4 tracks history changes in this SPA).
 * Loaded lazily so the SDK stays off the first paint.
 */
const enabled = isFirebaseConfigured && !useEmulators && !!firebaseConfig.measurementId;

let analytics: Promise<Analytics | null> | null = null;

export function startAnalytics(): Promise<Analytics | null> {
  if (!enabled) return Promise.resolve(null);
  analytics ??= import("firebase/analytics")
    .then(async ({ getAnalytics, isSupported }) => ((await isSupported()) ? getAnalytics(firebaseApp()) : null))
    .catch(() => null);
  return analytics;
}

/** Fire-and-forget custom event; a no-op when analytics is off or blocked. */
export function track(event: string, params?: Record<string, string | number>): void {
  if (!enabled) return;
  void startAnalytics().then(async (a) => {
    if (!a) return;
    const { logEvent } = await import("firebase/analytics");
    logEvent(a, event, params);
  });
}
