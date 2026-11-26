import { defineInt, defineString } from "firebase-functions/params";
import { DEFAULT_PAIRING_TTL_SECONDS, EXPIRY, HOST_LIMITS, MINUTE_MS } from "../../shared/constants";

/** Display pairing code lifetime in seconds. Set in functions/.env (PAIRING_CODE_TTL_SECONDS=180). */
export const pairingTtlSeconds = defineInt("PAIRING_CODE_TTL_SECONDS", {
  default: DEFAULT_PAIRING_TTL_SECONDS,
  description: "How long a display pairing code stays valid, in seconds.",
});

/** Singapore: same region as Firestore and the Realtime Database, so function → database calls stay local. */
export const REGION = "asia-southeast1";

/** Realtime Database triggers must run in the database's own region. */
export const DATABASE_REGION = "asia-southeast1";

/* ─── Expiry and free-tier limits (functions/.env; see functions/.env.example) ─── */

/** A lobby (waiting room) expires after this many minutes with no activity. */
export const roomInactivityMinutes = defineInt("ROOM_INACTIVITY_MINUTES", {
  default: EXPIRY.waitingInactivityMs / MINUTE_MS,
  description: "Minutes a lobby may sit with no activity before it expires.",
});

/** A free host's slot expires (and their rooms end) after this many minutes with no activity. */
export const hostInactivityMinutes = defineInt("HOST_INACTIVITY_MINUTES", {
  default: HOST_LIMITS.hostInactivityMinutes,
  description: "Minutes a free host may be inactive before their slot and rooms expire.",
});

/** Free hosts allowed to be active at the same time. */
export const maxActiveHosts = defineInt("MAX_ACTIVE_HOSTS", {
  default: HOST_LIMITS.maxActiveHosts,
  description: "How many free hosts can be active at once.",
});

/** Rooms one free host can have open at the same time. */
export const maxRoomsPerHost = defineInt("MAX_ROOMS_PER_HOST", {
  default: HOST_LIMITS.maxRoomsPerHost,
  description: "How many rooms a free host can have open at once.",
});

/** Shown (as a link, opened in a new tab) when the host limit is reached. Empty = no link. */
export const hostLimitContactUrl = defineString("HOST_LIMIT_CONTACT_URL", {
  default: "",
  description: "Page to contact for more hosts (shown when the free host limit is reached).",
});
