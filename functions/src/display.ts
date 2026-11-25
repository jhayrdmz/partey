import { onCall } from "firebase-functions/v2/https";
import { LIMITS } from "../../shared/constants";
import type { ClaimDisplayResponse, CreateDisplayCodeResponse } from "../../shared/api";
import { db, PAIRINGS, PAIRING_CODES, RATE_LIMITS, Timestamp, roomRef } from "./lib/admin";
import { generatePairingCode } from "./lib/codes";
import { fail, requireUid } from "./lib/errors";
import { assertHost, getLiveRoomTx, touchRoomTx } from "./lib/rooms";
import * as v from "./lib/validate";
import { REGION, pairingTtlSeconds } from "./config";

const opts = { region: REGION, cors: true } as const;

/**
 * Display pairing flow (the display shows the code, the host enters it)
 *  1. Display: createDisplayCode   → short-lived 6-digit code (pairingCodes/{code} → pairingId),
 *                                    shown on the TV with a QR code. The TV listens to its pairing doc.
 *  2. Host:    claimDisplayPairing → consumes the code (single use) and creates
 *                                    rooms/{roomId}/displaySessions/{displayUid}; pairing becomes "approved".
 *  3. Display: sees status "approved" + roomId and opens the room.
 *  Entering the code that is physically on the screen is the host's approval. The display's
 *  Firebase Auth identity bound to its session doc is its credential; security rules grant
 *  read access to public presentation data only.
 */

/** Simple fixed-window rate limit per key (anti brute force / abuse). */
async function checkRateLimit(key: string, max: number, message: string): Promise<void> {
  const ref = db.collection(RATE_LIMITS).doc(key);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const windowStart = (snap.get("windowStart") as number | undefined) ?? 0;
    const count = (snap.get("count") as number | undefined) ?? 0;
    if (now - windowStart > LIMITS.pairingAttemptWindowMs) {
      tx.set(ref, { windowStart: now, count: 1, expireAt: Timestamp.fromMillis(now + LIMITS.pairingAttemptWindowMs) });
      return;
    }
    if (count >= max) fail("resource-exhausted", message);
    tx.update(ref, { count: count + 1 });
  });
}

/** A display asks for a pairing code to show on screen. Replaces its previous open code. */
export const createDisplayCode = onCall(opts, async (req): Promise<CreateDisplayCodeResponse> => {
  const uid = requireUid(req);
  const data = v.asObject(req.data);
  const label = typeof data.label === "string" && data.label.trim() ? v.text(data, "label", 1, 40, "Display name") : "Display";
  // Codes refresh every few minutes, so this only stops runaway loops.
  await checkRateLimit(`displaycode_${uid}`, LIMITS.displayCodesPerWindow, "Too many new codes. Wait a few minutes and try again.");
  const ttlMs = pairingTtlSeconds.value() * 1000;

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generatePairingCode();
    const codeRef = db.collection(PAIRING_CODES).doc(code);
    const result = await db.runTransaction(async (tx) => {
      const existing = await tx.get(codeRef);
      if (existing.exists && (existing.get("expiresAt") as Timestamp).toMillis() > Date.now()) return null;
      const openForDisplay = await tx.get(db.collection(PAIRINGS).where("requesterUid", "==", uid).where("status", "==", "open"));

      const now = Timestamp.now();
      const expiresAt = Timestamp.fromMillis(now.toMillis() + ttlMs);
      // Only one valid code per display at a time.
      for (const doc of openForDisplay.docs) {
        const oldCode = doc.get("code") as string | null;
        if (oldCode && oldCode !== code) tx.delete(db.collection(PAIRING_CODES).doc(oldCode));
        tx.update(doc.ref, { status: "cancelled", code: null, resolvedAt: now });
      }
      const pairingRef = db.collection(PAIRINGS).doc();
      tx.set(pairingRef, {
        code,
        roomId: null,
        hostId: null,
        status: "open",
        requesterUid: uid,
        requesterLabel: label,
        createdAt: now,
        expiresAt,
        resolvedAt: null,
      });
      tx.set(codeRef, { pairingId: pairingRef.id, expiresAt });
      return { pairingId: pairingRef.id, code, expiresAtMs: expiresAt.toMillis() };
    });
    if (result) return result;
  }
  fail("resource-exhausted", "Couldn't create a pairing code. Try again.");
});

/** The host enters (or scans) the code shown on a display to connect it to their room. */
export const claimDisplayPairing = onCall(opts, async (req): Promise<ClaimDisplayResponse> => {
  const uid = requireUid(req);
  const data = v.asObject(req.data);
  const roomId = v.docId(data, "roomId");
  const code = v.pairingCode(data);
  await checkRateLimit(`pairing_${uid}`, LIMITS.pairingAttemptsPerWindow, "Too many attempts. Wait a few minutes and try again.");

  return db.runTransaction(async (tx) => {
    const room = await getLiveRoomTx(tx, roomId);
    assertHost(room, uid);
    const codeRef = db.collection(PAIRING_CODES).doc(code);
    const codeSnap = await tx.get(codeRef);
    const invalid = (): never => fail("not-found", "That code is invalid or expired. Check the code on the display.");
    if (!codeSnap.exists || (codeSnap.get("expiresAt") as Timestamp).toMillis() <= Date.now()) invalid();

    const pairingRef = db.collection(PAIRINGS).doc(codeSnap.get("pairingId") as string);
    const pairing = await tx.get(pairingRef);
    if (!pairing.exists || pairing.get("status") !== "open") invalid();
    const displayUid = pairing.get("requesterUid") as string;
    if (displayUid === uid) fail("failed-precondition", "Open the display on a different device than the host.");

    const sessionRef = roomRef(roomId).collection("displaySessions").doc(displayUid);
    const existingSession = await tx.get(sessionRef);
    const isNew = !existingSession.exists || existingSession.get("revoked") === true;
    if (isNew && room.displayCount >= LIMITS.maxDisplaysPerRoom) {
      fail("resource-exhausted", "This room already has the maximum number of displays.");
    }

    const now = Timestamp.now();
    const label = (pairing.get("requesterLabel") as string | null) ?? "Display";
    // Single use: the code is consumed now.
    tx.delete(codeRef);
    tx.set(sessionRef, { label, connected: false, revoked: false, pairedAt: now, lastSeenAt: null });
    tx.update(pairingRef, { status: "approved", code: null, roomId, hostId: uid, resolvedAt: now });
    touchRoomTx(tx, roomId, room, { displayCount: room.displayCount + (isNew ? 1 : 0) });
    return { displayId: displayUid, label };
  });
});

export const revokeDisplay = onCall(opts, async (req) => {
  const uid = requireUid(req);
  const data = v.asObject(req.data);
  const roomId = v.docId(data, "roomId");
  const displayId = v.docId(data, "displayId");
  await db.runTransaction(async (tx) => {
    const room = await getLiveRoomTx(tx, roomId);
    assertHost(room, uid);
    const ref = roomRef(roomId).collection("displaySessions").doc(displayId);
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get("revoked") === true) return;
    const wasConnected = snap.get("connected") === true;
    tx.update(ref, { revoked: true, connected: false });
    touchRoomTx(tx, roomId, room, {
      displayCount: Math.max(0, room.displayCount - 1),
      connectedDisplayCount: Math.max(0, room.connectedDisplayCount - (wasConnected ? 1 : 0)),
    });
  });
  return { ok: true };
});
