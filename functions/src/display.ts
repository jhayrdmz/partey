import { onCall } from "firebase-functions/v2/https";
import { LIMITS } from "../../shared/constants";
import type { CreatePairingResponse, RequestPairingResponse, ResolvePairingResponse } from "../../shared/api";
import { db, PAIRINGS, PAIRING_CODES, RATE_LIMITS, Timestamp, roomRef } from "./lib/admin";
import { generatePairingCode } from "./lib/codes";
import { fail, requireUid } from "./lib/errors";
import { assertHost, getLiveRoomTx, touchRoomTx } from "./lib/rooms";
import * as v from "./lib/validate";
import { REGION, pairingTtlSeconds } from "./config";

const opts = { region: REGION, cors: true } as const;

/**
 * Display pairing flow
 *  1. Host:    createDisplayPairing  → short-lived 6-digit code (pairingCodes/{code} → pairingId)
 *  2. Display: requestDisplayPairing → consumes the code (single use), pairing becomes "requested"
 *  3. Host:    resolveDisplayPairing → approve: displaySessions/{displayUid} is created
 *  The display's Firebase Auth identity bound to that session doc is its credential;
 *  security rules grant read access to public presentation data only.
 */

export const createDisplayPairing = onCall(opts, async (req): Promise<CreatePairingResponse> => {
  const uid = requireUid(req);
  const roomId = v.docId(v.asObject(req.data), "roomId");
  const ttlMs = pairingTtlSeconds.value() * 1000;

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generatePairingCode();
    const codeRef = db.collection(PAIRING_CODES).doc(code);
    const result = await db.runTransaction(async (tx) => {
      const room = await getLiveRoomTx(tx, roomId);
      assertHost(room, uid);
      const existing = await tx.get(codeRef);
      if (existing.exists && (existing.get("expiresAt") as Timestamp).toMillis() > Date.now()) return null;
      if (room.displayCount >= LIMITS.maxDisplaysPerRoom) fail("resource-exhausted", "This room already has the maximum number of displays.");

      // Invalidate this room's previous open codes so only one is ever valid.
      const openForRoom = await tx.get(
        db.collection(PAIRINGS).where("roomId", "==", roomId).where("hostId", "==", uid).where("status", "==", "open"),
      );

      const now = Timestamp.now();
      const expiresAt = Timestamp.fromMillis(now.toMillis() + ttlMs);
      for (const doc of openForRoom.docs) {
        const oldCode = doc.get("code") as string | null;
        if (oldCode) tx.delete(db.collection(PAIRING_CODES).doc(oldCode));
        tx.update(doc.ref, { status: "rejected", code: null, resolvedAt: now });
      }
      const pairingRef = db.collection(PAIRINGS).doc();
      tx.set(pairingRef, {
        code,
        roomId,
        hostId: uid,
        status: "open",
        requesterUid: null,
        requesterLabel: null,
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

/** Simple fixed-window rate limit on pairing attempts per uid (anti brute force). */
async function checkPairingRateLimit(uid: string): Promise<void> {
  const ref = db.collection(RATE_LIMITS).doc(`pairing_${uid}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const windowStart = (snap.get("windowStart") as number | undefined) ?? 0;
    const count = (snap.get("count") as number | undefined) ?? 0;
    if (now - windowStart > LIMITS.pairingAttemptWindowMs) {
      tx.set(ref, { windowStart: now, count: 1, expireAt: Timestamp.fromMillis(now + LIMITS.pairingAttemptWindowMs) });
      return;
    }
    if (count >= LIMITS.pairingAttemptsPerWindow) fail("resource-exhausted", "Too many attempts. Wait a few minutes and try again.");
    tx.update(ref, { count: count + 1 });
  });
}

export const requestDisplayPairing = onCall(opts, async (req): Promise<RequestPairingResponse> => {
  const uid = requireUid(req);
  const data = v.asObject(req.data);
  const code = v.pairingCode(data);
  const label = typeof data.label === "string" && data.label.trim() ? v.text(data, "label", 1, 40, "Display name") : "Display";
  await checkPairingRateLimit(uid);

  return db.runTransaction(async (tx) => {
    const codeRef = db.collection(PAIRING_CODES).doc(code);
    const codeSnap = await tx.get(codeRef);
    const invalid = () => fail("not-found", "That code is invalid or expired. Ask the host for a new one.");
    if (!codeSnap.exists) invalid();
    if ((codeSnap.get("expiresAt") as Timestamp).toMillis() <= Date.now()) invalid();

    const pairingRef = db.collection(PAIRINGS).doc(codeSnap.get("pairingId") as string);
    const pairing = await tx.get(pairingRef);
    if (!pairing.exists || pairing.get("status") !== "open") invalid();
    const room = await getLiveRoomTx(tx, pairing.get("roomId") as string);
    if (room.hostId === uid) fail("failed-precondition", "Open the display on a different device than the host.");

    const now = Timestamp.now();
    // Single use: the code is consumed now; the host has a fresh window to approve.
    tx.delete(codeRef);
    tx.update(pairingRef, {
      status: "requested",
      code: null,
      requesterUid: uid,
      requesterLabel: label,
      expiresAt: Timestamp.fromMillis(now.toMillis() + pairingTtlSeconds.value() * 1000),
    });
    return { pairingId: pairingRef.id };
  });
});

export const resolveDisplayPairing = onCall(opts, async (req): Promise<ResolvePairingResponse> => {
  const uid = requireUid(req);
  const data = v.asObject(req.data);
  const roomId = v.docId(data, "roomId");
  const pairingId = v.docId(data, "pairingId");
  const approve = v.bool(data, "approve");

  return db.runTransaction(async (tx) => {
    const room = await getLiveRoomTx(tx, roomId);
    assertHost(room, uid);
    const pairingRef = db.collection(PAIRINGS).doc(pairingId);
    const pairing = await tx.get(pairingRef);
    if (!pairing.exists || pairing.get("roomId") !== roomId) fail("not-found", "Pairing request not found.");
    const status = pairing.get("status");
    // Idempotent: resolving twice returns the original outcome.
    if (status === "approved" || status === "rejected") return { status };
    if (status !== "requested") fail("failed-precondition", "No display has requested this code yet.");
    if ((pairing.get("expiresAt") as Timestamp).toMillis() <= Date.now()) fail("deadline-exceeded", "This request expired. Generate a new code.");

    const now = Timestamp.now();
    if (!approve) {
      tx.update(pairingRef, { status: "rejected", resolvedAt: now });
      return { status: "rejected" as const };
    }
    const displayUid = pairing.get("requesterUid") as string;
    const sessionRef = roomRef(roomId).collection("displaySessions").doc(displayUid);
    const existingSession = await tx.get(sessionRef);
    tx.set(sessionRef, {
      label: pairing.get("requesterLabel") ?? "Display",
      connected: false,
      revoked: false,
      pairedAt: now,
      lastSeenAt: null,
    });
    tx.update(pairingRef, { status: "approved", resolvedAt: now });
    const isNew = !existingSession.exists || existingSession.get("revoked") === true;
    touchRoomTx(tx, roomId, room, { displayCount: room.displayCount + (isNew ? 1 : 0) });
    return { status: "approved" as const };
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
