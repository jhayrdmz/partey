import { defineInt } from "firebase-functions/params";
import { DEFAULT_PAIRING_TTL_SECONDS } from "../../shared/constants";

/** Display pairing code lifetime in seconds. Set in functions/.env (PAIRING_CODE_TTL_SECONDS=180). */
export const pairingTtlSeconds = defineInt("PAIRING_CODE_TTL_SECONDS", {
  default: DEFAULT_PAIRING_TTL_SECONDS,
  description: "How long a display pairing code stays valid, in seconds.",
});

export const REGION = "us-central1";

/** Realtime Database triggers must run in the database's own region. */
export const DATABASE_REGION = "asia-southeast1";
