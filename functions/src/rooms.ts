import { onCall } from "firebase-functions/v2/https";
import { DEFAULT_OTHER_PLACEMENT_POINTS, DEFAULT_PLACEMENT_POINTS, KEEPALIVE_WRITE_MIN_MS, LIMITS } from "../../shared/constants";
import type { CreateRoomResponse, LookupRoomResponse } from "../../shared/api";
import type { HostLimitDetails, LineupEntry } from "../../shared/types";
import { db, ROOMS, ROOM_CODES, Timestamp, hostSecretRef, roomRef } from "./lib/admin";
import { activeFreeHostsQuery, activeHostFields, hasActiveSlot, hostRef, hostSlotLockRef, isPaid, readHost, touchHostTx } from "./lib/hosts";
import { generateId, generateRoomCode } from "./lib/codes";
import { fail, requireUid } from "./lib/errors";
import { assertHost, expiryFields, getLiveRoomTx, isRoomLive, readLiveRoom, touchRoomTx, type ServerRoom } from "./lib/rooms";
import * as v from "./lib/validate";
import { REGION, hostLimitContactUrl, maxActiveHosts, maxRoomsPerHost } from "./config";
import { cleanupRoom } from "./maintenance";

const opts = { region: REGION, cors: true } as const;

/**
 * Create a room with a unique player room code. Host = caller.
 * Free hosts: at most MAX_ROOMS_PER_HOST open rooms, and a new host needs one of MAX_ACTIVE_HOSTS
 * slots (resource-exhausted with HostLimitDetails otherwise). Paid hosts skip both.
 */
export const createRoom = onCall(opts, async (req): Promise<CreateRoomResponse> => {
  const uid = requireUid(req);
  const data = v.asObject(req.data);
  const roomName = v.name(data, "roomName", LIMITS.roomNameMin, LIMITS.roomNameMax, "Room name");

  const ref = db.collection(ROOMS).doc();
  for (let attempt = 0; attempt < 8; attempt++) {
    const roomCode = generateRoomCode();
    const codeRef = db.collection(ROOM_CODES).doc(roomCode);
    const created = await db.runTransaction(async (tx) => {
      const existing = await tx.get(codeRef);
      if (existing.exists) {
        // Reuse a code only if its room is gone/expired.
        const roomSnap = await tx.get(roomRef(existing.get("roomId")));
        const room = roomSnap.data() as ServerRoom | undefined;
        if (room && room.status !== "expired" && (!room.expiresAt || room.expiresAt.toMillis() > Date.now())) return false;
      }

      // Free-tier limits (reads before any write).
      const nowMs = Date.now();
      const host = readHost(await tx.get(hostRef(uid)));
      let claimSlot = !hasActiveSlot(host, nowMs);
      if (!isPaid(host)) {
        const mine = await tx.get(db.collection(ROOMS).where("hostId", "==", uid).limit(100));
        const open = mine.docs.filter((d) => {
          const r = d.data() as ServerRoom;
          return (r.status === "waiting" || r.status === "playing") && isRoomLive(r, nowMs);
        }).length;
        const maxRooms = maxRoomsPerHost.value();
        if (open >= maxRooms) {
          const details: HostLimitDetails = { reason: "room-limit", max: maxRooms };
          fail("resource-exhausted", `You can have up to ${maxRooms} rooms open at a time. Close one first, or wait for an idle one to expire.`, details);
        }
        if (claimSlot) {
          await tx.get(hostSlotLockRef()); // serializes concurrent claims
          const active = await tx.get(activeFreeHostsQuery(Timestamp.fromMillis(nowMs)).count());
          if (active.data().count >= maxActiveHosts.value()) {
            const details: HostLimitDetails = { reason: "host-limit", contactUrl: hostLimitContactUrl.value().trim() || null };
            fail("resource-exhausted", "We're limiting the number of hosts for free tiers. Please contact us on our page for more information.", details);
          }
        }
      } else {
        claimSlot = false;
      }

      const now = Timestamp.fromMillis(nowMs);
      const room: ServerRoom = {
        roomCode,
        hostId: uid,
        roomName,
        gameMode: null,
        status: "waiting",
        lineup: [],
        currentGameIndex: 0,
        currentGameId: null,
        lastPlayedGameId: null,
        scoring: { placementPoints: [...DEFAULT_PLACEMENT_POINTS], otherPoints: DEFAULT_OTHER_PLACEMENT_POINTS },
        usedContent: [],
        playerCount: 0,
        connectedPlayerCount: 0,
        hostConnected: true,
        displayCount: 0,
        connectedDisplayCount: 0,
        createdAt: now,
        lastActivityAt: now,
        hostDisconnectedAt: null,
        allDisconnectedAt: null,
        finishedAt: null,
        expiresAt: null,
        ttlAt: null,
      };
      Object.assign(room, expiryFields(room, {}, now.toMillis()));
      tx.set(ref, room);
      // Creating a room is host activity: (re)activate the slot.
      tx.set(hostRef(uid), { ...activeHostFields(host?.tier ?? "free", nowMs), createdAt: host?.createdAt ?? now }, { merge: true });
      if (claimSlot) tx.set(hostSlotLockRef(), { lastClaimAt: now, lastClaimBy: uid });
      tx.set(codeRef, { roomId: ref.id, createdAt: now });
      tx.set(ref.collection("displayState").doc("current"), {
        currentScreen: "lobby",
        gameId: null,
        gameNumber: null,
        totalGames: null,
        game: null,
        publicResults: null,
        updatedAt: now,
      });
      return true;
    });
    if (created) return { roomId: ref.id, roomCode };
  }
  fail("resource-exhausted", "Couldn't allocate a room code. Please try again.");
});

export const setGameMode = onCall(opts, async (req) => {
  const uid = requireUid(req);
  const data = v.asObject(req.data);
  const roomId = v.docId(data, "roomId");
  const gameMode = v.gameMode(data);
  await db.runTransaction(async (tx) => {
    const room = await getLiveRoomTx(tx, roomId);
    assertHost(room, uid);
    if (room.status !== "waiting") fail("failed-precondition", "You can't change the mode during a game.");
    if (room.gameMode === gameMode) return;
    // Switching modes resets the lineup; freestyle keeps at most one game.
    const lineup = gameMode === "freestyle" ? room.lineup.slice(0, 1) : room.lineup;
    touchRoomTx(tx, roomId, room, { gameMode, lineup, currentGameIndex: 0 });
  });
  return { ok: true };
});

export const setLineup = onCall(opts, async (req) => {
  const uid = requireUid(req);
  const data = v.asObject(req.data);
  const roomId = v.docId(data, "roomId");
  const gameIds = v.lineup(data);
  await db.runTransaction(async (tx) => {
    const room = await getLiveRoomTx(tx, roomId);
    assertHost(room, uid);
    if (!room.gameMode) fail("failed-precondition", "Pick a game mode first.");
    if (room.status !== "waiting") fail("failed-precondition", "You can't change games while one is running.");
    if (room.gameMode === "freestyle" && gameIds.length > 1) fail("invalid-argument", "Freestyle plays one game at a time.");
    if (room.gameMode === "tournament" && room.currentGameIndex > 0) {
      fail("failed-precondition", "The tournament has already started.");
    }
    const lineup: LineupEntry[] = gameIds.map((gameId) => ({ entryId: generateId(8), gameId }));
    touchRoomTx(tx, roomId, room, { lineup, currentGameId: lineup[0]?.gameId ?? null });
    // A new pick means the big screen goes back to the lobby (with join instructions).
    tx.set(roomRef(roomId).collection("displayState").doc("current"), { currentScreen: "lobby", gameId: null, game: null, publicResults: null, updatedAt: Timestamp.now() }, { merge: true });
  });
  return { ok: true };
});

/**
 * Host changes a game's options (Speed Quiz, The Impostor, Draw & Guess, Word Scramble, Perfectly Hold, Cup Shuffle, Number Rush). Allowed between games; a running
 * game keeps the options it started with. Lowering the player limit never removes anyone.
 */
export const setGameSettings = onCall(opts, async (req) => {
  const uid = requireUid(req);
  const data = v.asObject(req.data);
  const roomId = v.docId(data, "roomId");
  const gameId = data.gameId;
  if (gameId !== "speed-quiz" && gameId !== "impostor" && gameId !== "drawing" && gameId !== "word-scramble" && gameId !== "perfectly-hold" && gameId !== "cup-shuffle" && gameId !== "number-rush") fail("invalid-argument", "This game has no options.");
  const settings =
    gameId === "speed-quiz"
      ? v.speedQuizSettings(data.settings)
      : gameId === "impostor"
        ? v.impostorSettings(data.settings)
        : gameId === "drawing"
          ? v.drawingSettings(data.settings)
          : gameId === "word-scramble"
            ? v.scrambleSettings(data.settings)
            : gameId === "perfectly-hold"
              ? v.holdSettings(data.settings)
              : gameId === "cup-shuffle"
                ? v.cupSettings(data.settings)
                : v.rushSettings(data.settings);
  // The Impostor's custom word stays off the room doc (players and displays can read that).
  const customWord = "customWord" in settings && settings.customWord ? v.impostorCustomWord(data) : null;
  await db.runTransaction(async (tx) => {
    const room = await getLiveRoomTx(tx, roomId);
    assertHost(room, uid);
    if (room.status !== "waiting") fail("failed-precondition", "Change options between games.");
    touchRoomTx(tx, roomId, room, { gameSettings: { ...room.gameSettings, [gameId]: settings } });
    if (gameId === "impostor") {
      if (customWord) tx.set(hostSecretRef(roomId, gameId), { word: customWord });
      else tx.delete(hostSecretRef(roomId, gameId));
    }
  });
  return { ok: true };
});

/** Resolve a public room code into room info (used by the player join screen). */
export const lookupRoom = onCall(opts, async (req): Promise<LookupRoomResponse> => {
  const uid = requireUid(req);
  const data = v.asObject(req.data);
  const code = v.roomCode(data);
  const codeSnap = await db.collection(ROOM_CODES).doc(code).get();
  if (!codeSnap.exists) fail("not-found", "No room with that code. Check the code on the big screen.");
  const roomId = codeSnap.get("roomId") as string;
  const [roomSnap, playerSnap] = await Promise.all([
    roomRef(roomId).get(),
    roomRef(roomId).collection("players").doc(uid).get(),
  ]);
  const room = readLiveRoom(roomSnap);
  const status = playerSnap.get("status") as string | undefined;
  return {
    roomId,
    roomName: room.roomName,
    status: room.status,
    playerCount: room.playerCount,
    alreadyJoined: playerSnap.exists && status !== "kicked" && status !== "left",
    kicked: status === "kicked",
  };
});

/** Host ends the session for everyone. */
export const closeRoom = onCall(opts, async (req) => {
  const uid = requireUid(req);
  const roomId = v.docId(v.asObject(req.data), "roomId");
  await db.runTransaction(async (tx) => {
    const room = await getLiveRoomTx(tx, roomId);
    assertHost(room, uid);
    const now = Timestamp.now();
    tx.update(roomRef(roomId), {
      status: "expired",
      expiresAt: now,
      ttlAt: Timestamp.fromMillis(now.toMillis() + 60 * 60 * 1000),
      lastActivityAt: now,
    });
  });
  await cleanupRoom(roomId);
  return { ok: true };
});



/**
 * "Someone is using this room." Sent by the host's and players' devices after a real interaction
 * (at most every KEEPALIVE_INTERVAL_MS, only while the page is visible), so a lobby that's in use
 * never runs out its inactivity window. Extends the room and, for the host, their host slot.
 * Throttled to one write per KEEPALIVE_WRITE_MIN_MS per room / host.
 */
export const keepAlive = onCall(opts, async (req) => {
  const uid = requireUid(req);
  const roomId = v.docId(v.asObject(req.data), "roomId");
  return db.runTransaction(async (tx) => {
    const room = await getLiveRoomTx(tx, roomId);
    const isHost = room.hostId === uid;
    const [playerSnap, hostSnap] = await Promise.all([
      isHost ? Promise.resolve(null) : tx.get(roomRef(roomId).collection("players").doc(uid)),
      isHost ? tx.get(hostRef(uid)) : Promise.resolve(null),
    ]);
    const status = playerSnap?.get("status");
    if (!isHost && status !== "online" && status !== "offline") fail("permission-denied", "Not a member of this room.");
    const nowMs = Date.now();
    if (nowMs - room.lastActivityAt.toMillis() >= KEEPALIVE_WRITE_MIN_MS) touchRoomTx(tx, roomId, room, {});
    if (hostSnap) touchHostTx(tx, uid, readHost(hostSnap), nowMs);
    return { ok: true };
  });
});
