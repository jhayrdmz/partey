/** Callable error helpers. Messages are shown to users as-is, so keep them friendly. */
import { HttpsError, type CallableRequest, type FunctionsErrorCode } from "firebase-functions/v2/https";

export function fail(code: FunctionsErrorCode, message: string): never {
  throw new HttpsError(code, message);
}

/** The caller's Firebase Auth uid (everyone signs in anonymously). */
export function requireUid(req: CallableRequest<unknown>): string {
  const uid = req.auth?.uid;
  if (!uid) fail("unauthenticated", "Please reconnect and try again.");
  return uid;
}
