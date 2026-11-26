/** Callable error helpers. Messages are shown to users as-is, so keep them friendly. */
import { HttpsError, type CallableRequest, type FunctionsErrorCode } from "firebase-functions/v2/https";

/** `details` reaches the client as FunctionsError.details (e.g. which limit was hit). */
export function fail(code: FunctionsErrorCode, message: string, details?: unknown): never {
  throw new HttpsError(code, message, details);
}

/**
 * Largest request body any callable accepts. Real requests are tiny (game options, the biggest, are
 * a few hundred bytes); anything near this is spam, refused before any parsing or database work.
 */
export const MAX_REQUEST_BYTES = 8 * 1024;

/** Refuse oversized payloads. Uses Content-Length when sent, else measures the parsed data. */
export function assertSmallRequest(req: CallableRequest<unknown>): void {
  const header = Number(req.rawRequest?.headers?.["content-length"]);
  const size = Number.isFinite(header) && header > 0 ? header : Buffer.byteLength(JSON.stringify(req.data ?? null) ?? "");
  if (size > MAX_REQUEST_BYTES) fail("invalid-argument", "Request too large.");
}

/** The caller's Firebase Auth uid (everyone signs in anonymously). Every callable starts here. */
export function requireUid(req: CallableRequest<unknown>): string {
  const uid = req.auth?.uid;
  if (!uid) fail("unauthenticated", "Please reconnect and try again.");
  assertSmallRequest(req);
  return uid;
}
