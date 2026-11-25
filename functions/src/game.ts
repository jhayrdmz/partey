import { onCall } from "firebase-functions/v2/https";
import { GAMES } from "../../shared/games";
import { db, roomRef } from "./lib/admin";
import { fail, requireUid } from "./lib/errors";
import { assertHost, getLiveRoomTx } from "./lib/rooms";
import * as v from "./lib/validate";
import { generateId } from "./lib/codes";
import { REGION } from "./config";
import { getHandler } from "./engine/registry";
import { finalizeGame, initGame, loadGameCtx } from "./engine/lifecycle";

const opts = { region: REGION, cors: true } as const;

/**
 * Start the next tournament game, or (freestyle) the requested game.
 *
 *   waiting ──startGame──▶ playing (intro → rounds …) ──▶ waiting | finished
 */
export const startGame = onCall(opts, async (req) => {
  const uid = requireUid(req);
  const data = v.asObject(req.data);
  const roomId = v.docId(data, "roomId");
  const requestedGame = data.gameId === undefined ? undefined : v.gameId(data.gameId);

  await db.runTransaction(async (tx) => {
    const room = await getLiveRoomTx(tx, roomId);
    assertHost(room, uid);
    if (room.status === "playing") return; // idempotent double-tap
    if (room.status !== "waiting") fail("failed-precondition", "This room can't start a game right now.");
    if (!room.gameMode) fail("failed-precondition", "Choose a game mode first.");

    let lineup = room.lineup;
    let index = room.currentGameIndex;
    if (room.gameMode === "freestyle") {
      if (requestedGame) lineup = [{ entryId: generateId(8), gameId: requestedGame }];
      else lineup = lineup.map((e) => ({ ...e, entryId: generateId(8) })); // fresh entry per play
      index = 0;
    }
    const entry = lineup[index];
    if (!entry) fail("failed-precondition", room.gameMode === "tournament" ? "No games left in the lineup." : "Pick a game first.");
    const game = GAMES[entry.gameId];
    if (!getHandler(entry.gameId)) fail("failed-precondition", `${game.name} is coming soon! Pick another game.`);

    const playersSnap = await tx.get(roomRef(roomId).collection("players").where("status", "in", ["online", "offline"]));
    if (playersSnap.size < game.minPlayers) {
      fail("failed-precondition", `${game.name} needs at least ${game.minPlayers} player${game.minPlayers === 1 ? "" : "s"}.`);
    }
    const players = playersSnap.docs.map((d) => ({ playerId: d.id, nickname: d.get("nickname") as string, avatar: d.get("avatar") as string }));

    // A fresh tournament (or any freestyle game) starts everyone at zero.
    if (room.gameMode === "freestyle" || index === 0) {
      for (const p of playersSnap.docs) tx.update(p.ref, { score: 0 });
    }

    await initGame(tx, {
      roomId,
      room,
      gameId: entry.gameId,
      entryId: entry.entryId,
      players,
      nowMs: Date.now(),
      roomPatch: { status: "playing", lineup, currentGameIndex: index, currentGameId: entry.gameId },
    });
  });
  return { ok: true };
});

/** Host ends the current game early; standings are computed from points so far. */
export const endGame = onCall(opts, async (req) => {
  const uid = requireUid(req);
  const roomId = v.docId(v.asObject(req.data), "roomId");
  await db.runTransaction(async (tx) => {
    const ctx = await loadGameCtx(tx, roomId);
    if (!ctx) {
      const room = await getLiveRoomTx(tx, roomId);
      assertHost(room, uid);
      return; // already ended — idempotent
    }
    assertHost(ctx.room, uid);
    finalizeGame(tx, ctx, Date.now());
  });
  return { ok: true };
});
