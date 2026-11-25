import { onValue, ref } from "firebase/database";
import { firebase } from "./app";

/**
 * Server-clock sync via Realtime Database's `.info/serverTimeOffset`.
 * All game deadlines are server-clock ms, so every device counts down in sync
 * regardless of its own clock.
 */
let offsetMs = 0;
let started = false;
const listeners = new Set<() => void>();

export function startServerClock() {
  if (started) return;
  started = true;
  onValue(ref(firebase().database, ".info/serverTimeOffset"), (snap) => {
    offsetMs = Number(snap.val()) || 0;
    listeners.forEach((l) => l());
  });
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function onServerClockChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
