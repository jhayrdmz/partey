import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { EXPIRY } from "../../shared/constants";
import { db, rtdb, FieldValue, PAIRINGS, PAIRING_CODES, ROOMS, ROOM_CODES, ROOM_SUBCOLLECTIONS, Timestamp, roomRef } from "./lib/admin";
import { REGION } from "./config";

/**
 * Tombstone a room and delete its data. The room document itself stays (status
 * "expired", inaccessible via rules) until Firestore TTL removes it via ttlAt.
 * Subcollections are deleted explicitly because TTL does not cascade.
 */
export async function cleanupRoom(roomId: string): Promise<void> {
  const ref = roomRef(roomId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const now = Date.now();
  await ref.update({
    status: "expired",
    expiresAt: null, // removes it from the expiry sweep query
    ttlAt: Timestamp.fromMillis(now + EXPIRY.ttlBufferMs),
    cleanedAt: Timestamp.fromMillis(now),
  });

  const code = snap.get("roomCode") as string | undefined;
  if (code) {
    await db.runTransaction(async (tx) => {
      const codeRef = db.collection(ROOM_CODES).doc(code);
      const codeSnap = await tx.get(codeRef);
      if (codeSnap.exists && codeSnap.get("roomId") === roomId) tx.delete(codeRef);
    });
  }

  for (const name of ROOM_SUBCOLLECTIONS) await db.recursiveDelete(ref.collection(name));

  const pairings = await db.collection(PAIRINGS).where("roomId", "==", roomId).get();
  const batch = db.batch();
  for (const p of pairings.docs) {
    const pcode = p.get("code") as string | null;
    if (pcode) batch.delete(db.collection(PAIRING_CODES).doc(pcode));
    batch.delete(p.ref);
  }
  await batch.commit();
  await rtdb().ref(`presence/${roomId}`).remove();
  await rtdb().ref(`drawings/${roomId}`).remove();
}

/** Runs the whole sweep once; exported for tests and manual invocation. */
export async function runExpirySweep(nowMs = Date.now()): Promise<{ rooms: number; players: number; pairings: number }> {
  const now = Timestamp.fromMillis(nowMs);
  const result = { rooms: 0, players: 0, pairings: 0 };

  // 1. Rooms past their logical expiry.
  const expired = await db.collection(ROOMS).where("expiresAt", "<=", now).limit(100).get();
  for (const doc of expired.docs) {
    try {
      await cleanupRoom(doc.id);
      result.rooms++;
    } catch (err) {
      logger.error("Room cleanup failed", { roomId: doc.id, err });
    }
  }

  // 2. Players whose individual 8-hour reconnection grace has passed.
  const cutoff = Timestamp.fromMillis(nowMs - EXPIRY.playerGraceMs);
  const stale = await db.collectionGroup("players").where("status", "==", "offline").where("disconnectedAt", "<=", cutoff).limit(300).get();
  for (const doc of stale.docs) {
    const room = doc.ref.parent.parent;
    if (!room) continue;
    const batch = db.batch();
    batch.update(doc.ref, { status: "left" });
    batch.update(room, { playerCount: FieldValue.increment(-1) });
    await batch.commit();
    result.players++;
  }

  // 3. Pairing codes/records past expiry (approved ones are already consumed).
  const oldPairings = await db.collection(PAIRINGS).where("expiresAt", "<=", now).limit(300).get();
  const oldCodes = await db.collection(PAIRING_CODES).where("expiresAt", "<=", now).limit(300).get();
  const batch = db.batch();
  for (const d of oldPairings.docs) batch.delete(d.ref);
  for (const d of oldCodes.docs) batch.delete(d.ref);
  await batch.commit();
  result.pairings = oldPairings.size;

  return result;
}

export const processExpirations = onSchedule({ schedule: "every 5 minutes", region: REGION, timeoutSeconds: 300 }, async () => {
  const result = await runExpirySweep();
  logger.info("Expiry sweep complete", result);
});
