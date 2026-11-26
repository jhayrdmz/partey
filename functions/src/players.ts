import { onCall } from "firebase-functions/v2/https";
import { LIMITS } from "../../shared/constants";
import { roomPlayerCap } from "../../shared/gameSettings";
import type { JoinRoomResponse } from "../../shared/api";
import { db, ROOM_CODES, Timestamp, roomRef } from "./lib/admin";
import { fail, requireUid } from "./lib/errors";
import { assertHost, getLiveRoomTx, touchRoomTx } from "./lib/rooms";
import * as v from "./lib/validate";
import { REGION } from "./config";

const opts = { region: REGION, cors: true } as const;

/**
 * Join (or rejoin) a room. Idempotent per uid: an existing player keeps their
 * score and history; their nickname/avatar may be updated.
 */
export const joinRoom = onCall(opts, async (req): Promise<JoinRoomResponse> => {
  const uid = requireUid(req);
  const data = v.asObject(req.data);
  const code = v.roomCode(data);
  const nickname = v.name(data, "nickname", LIMITS.nicknameMin, LIMITS.nicknameMax, "Nickname");
  const avatar = v.avatar(data);

  const codeSnap = await db.collection(ROOM_CODES).doc(code).get();
  if (!codeSnap.exists) fail("not-found", "No room with that code.");
  const roomId = codeSnap.get("roomId") as string;

  return db.runTransaction(async (tx) => {
    const room = await getLiveRoomTx(tx, roomId);
    if (room.hostId === uid) fail("failed-precondition", "You're the host of this room. Join from another device to play.");
    if (room.status === "finished") fail("failed-precondition", "This game has finished.");
    const playerRef = roomRef(roomId).collection("players").doc(uid);
    const existing = await tx.get(playerRef);
    const now = Timestamp.now();

    if (existing.exists) {
      const status = existing.get("status");
      if (status === "kicked") fail("permission-denied", "The host removed you from this room.");
      const wasCounted = status !== "left";
      tx.update(playerRef, { nickname, avatar, status: status === "left" ? "offline" : status, lastSeenAt: now });
      if (!wasCounted) touchRoomTx(tx, roomId, room, { playerCount: room.playerCount + 1 });
      return { roomId, playerId: uid, rejoined: true };
    }

    // The selected game decides capacity (Speed Quiz's host-set limit; otherwise the default).
    if (room.playerCount >= roomPlayerCap(room)) fail("resource-exhausted", "This room is full.");

    // Nicknames must be unique within a room (case-insensitive) for readable leaderboards.
    const sameName = await tx.get(roomRef(roomId).collection("players").where("nicknameKey", "==", nickname.toLowerCase()).limit(1));
    if (!sameName.empty) fail("already-exists", "Someone already has that nickname. Try another!");

    tx.set(playerRef, {
      nickname,
      nicknameKey: nickname.toLowerCase(),
      avatar,
      score: 0,
      status: "offline", // flips to online when the presence connection lands
      teamId: null,
      joinedAt: now,
      lastSeenAt: now,
      disconnectedAt: null,
    });
    touchRoomTx(tx, roomId, room, { playerCount: room.playerCount + 1 });
    return { roomId, playerId: uid, rejoined: false };
  });
});

/** Player voluntarily leaves. Their record is kept (status "left") for history. */
export const leaveRoom = onCall(opts, async (req) => {
  const uid = requireUid(req);
  const roomId = v.docId(v.asObject(req.data), "roomId");
  await db.runTransaction(async (tx) => {
    const room = await getLiveRoomTx(tx, roomId);
    const playerRef = roomRef(roomId).collection("players").doc(uid);
    const snap = await tx.get(playerRef);
    if (!snap.exists || snap.get("status") === "left" || snap.get("status") === "kicked") return;
    const wasOnline = snap.get("status") === "online";
    tx.update(playerRef, { status: "left", disconnectedAt: Timestamp.now() });
    touchRoomTx(tx, roomId, room, {
      playerCount: Math.max(0, room.playerCount - 1),
      connectedPlayerCount: Math.max(0, room.connectedPlayerCount - (wasOnline ? 1 : 0)),
    });
  });
  return { ok: true };
});

export const kickPlayer = onCall(opts, async (req) => {
  const uid = requireUid(req);
  const data = v.asObject(req.data);
  const roomId = v.docId(data, "roomId");
  const playerId = v.docId(data, "playerId");
  await db.runTransaction(async (tx) => {
    const room = await getLiveRoomTx(tx, roomId);
    assertHost(room, uid);
    const playerRef = roomRef(roomId).collection("players").doc(playerId);
    const snap = await tx.get(playerRef);
    if (!snap.exists) fail("not-found", "That player isn't in this room.");
    const status = snap.get("status");
    if (status === "kicked") return; // idempotent
    tx.update(playerRef, { status: "kicked", disconnectedAt: Timestamp.now() });
    touchRoomTx(tx, roomId, room, {
      playerCount: status === "left" ? room.playerCount : Math.max(0, room.playerCount - 1),
      connectedPlayerCount: Math.max(0, room.connectedPlayerCount - (status === "online" ? 1 : 0)),
    });
  });
  return { ok: true };
});
