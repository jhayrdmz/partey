/**
 * Firebase Admin SDK singletons plus collection names and refs shared by every function.
 */
import { getApps, initializeApp } from "firebase-admin/app";
import { getDatabase, getDatabaseWithUrl } from "firebase-admin/database";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";

const app = getApps()[0] ?? initializeApp();

export const db = getFirestore(app);

/**
 * Realtime Database (presence). Lazy so Firestore-only code paths and tests don't need a databaseURL.
 * RTDB_URL (functions/.env) is required for databases outside us-central1, whose
 * *.firebasedatabase.app URL isn't derivable from the project id.
 */
export const rtdb = () => {
  if (process.env.RTDB_URL) return getDatabaseWithUrl(process.env.RTDB_URL, app);
  // Emulator: the Admin SDK's default namespace is "<project>", but the web app's default database
  // URL is "<project>-default-rtdb". Use the app's, so server writes (Draw & Guess access,
  // cleanup) land where clients read.
  const emulator = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  const project = process.env.GCLOUD_PROJECT;
  if (emulator && project) return getDatabaseWithUrl(`http://${emulator}?ns=${project}-default-rtdb`, app);
  return getDatabase(app);
};

export { FieldValue, Timestamp };

/* ─── Collections ────────────────────────────────────────────────────── */

export const ROOMS = "rooms";
/** roomCodes/{code} → { roomId } */
export const ROOM_CODES = "roomCodes";
/** displayPairings/{pairingId} */
export const PAIRINGS = "displayPairings";
/** pairingCodes/{code} → { pairingId, expiresAt } */
export const PAIRING_CODES = "pairingCodes";
/** rateLimits/{key} */
export const RATE_LIMITS = "rateLimits";
/** hosts/{uid}: free-tier host slots and the paid tag (server-only). */
export const HOSTS = "hosts";
/** system/{doc}: server bookkeeping (e.g. the host-slot lock). */
export const SYSTEM = "system";

/** Every subcollection under rooms/{roomId}; deleted explicitly on cleanup (TTL doesn't cascade). */
export const ROOM_SUBCOLLECTIONS = [
  "players",
  "displayState",
  "displaySessions",
  "history",
  "gameState",
  "private",
  "submissions",
  "attempts",
  "hostSecrets",
] as const;

export const roomRef = (roomId: string) => db.collection(ROOMS).doc(roomId);
/** rooms/{id}/hostSecrets/{gameId}: game options only the host may see (e.g. a custom Impostor word). */
export const hostSecretRef = (roomId: string, gameId: string) => roomRef(roomId).collection("hostSecrets").doc(gameId);
