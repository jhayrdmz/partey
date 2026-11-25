import { onCall } from "firebase-functions/v2/https";
import { GAMES } from "../../shared/games";
import { db, Timestamp, roomRef } from "./lib/admin";
import { fail, requireUid } from "./lib/errors";
import { assertHost, getLiveRoomTx, touchRoomTx } from "./lib/rooms";
import * as v from "./lib/validate";
import { generateId } from "./lib/codes";
import { REGION } from "./config";

const opts = { region: REGION, cors: true } as const;

/**
 * Game lifecycle (server-authoritative). Phase 4 will add rounds, timers and
 * submissions on top of these transitions; clients never write game state.
 *
 *   waiting ──startGame──▶ playing ──endGame──▶ waiting (next game / freestyle pick)
 *                                         └──▶ finished (last tournament game)
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
      index = 0;
    }
    const entry = lineup[index];
    if (!entry) fail("failed-precondition", room.gameMode === "tournament" ? "No games left in the lineup." : "Pick a game first.");
    const game = GAMES[entry.gameId];
    if (room.playerCount < game.minPlayers) {
      fail("failed-precondition", `${game.name} needs at least ${game.minPlayers} player${game.minPlayers === 1 ? "" : "s"}.`);
    }

    // Freestyle: every game is its own competition, so scores reset.
    if (room.gameMode === "freestyle" || (room.gameMode === "tournament" && index === 0)) {
      const players = await tx.get(roomRef(roomId).collection("players"));
      for (const p of players.docs) tx.update(p.ref, { score: 0 });
    }

    const now = Timestamp.now();
    tx.set(roomRef(roomId).collection("gameState").doc("current"), {
      gameId: entry.gameId,
      entryId: entry.entryId,
      phase: "intro",
      round: 0,
      gameData: {},
      startedAt: now,
      endsAt: null,
    });
    tx.set(roomRef(roomId).collection("displayState").doc("current"), {
      currentScreen: "game-intro",
      gameId: entry.gameId,
      gameNumber: room.gameMode === "tournament" ? index + 1 : null,
      totalGames: room.gameMode === "tournament" ? lineup.length : null,
      currentQuestion: null,
      timerEndsAt: null,
      paused: false,
      publicResults: null,
      updatedAt: now,
    });
    touchRoomTx(tx, roomId, room, { status: "playing", lineup, currentGameIndex: index, currentGameId: entry.gameId });
  });
  return { ok: true };
});

export const endGame = onCall(opts, async (req) => {
  const uid = requireUid(req);
  const roomId = v.docId(v.asObject(req.data), "roomId");

  await db.runTransaction(async (tx) => {
    const room = await getLiveRoomTx(tx, roomId);
    assertHost(room, uid);
    if (room.status !== "playing") return; // idempotent
    const gameStateRef = roomRef(roomId).collection("gameState").doc("current");
    const [gameState, players] = await Promise.all([
      tx.get(gameStateRef),
      tx.get(roomRef(roomId).collection("players").where("status", "in", ["online", "offline"])),
    ]);
    const standings = players.docs
      .map((d) => ({ playerId: d.id, nickname: d.get("nickname") as string, avatar: d.get("avatar") as string, score: (d.get("score") as number) ?? 0 }))
      .sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));

    const now = Timestamp.now();
    const entryId = (gameState.get("entryId") as string | undefined) ?? generateId(8);
    tx.set(roomRef(roomId).collection("history").doc(`${room.currentGameIndex}_${entryId}`), {
      gameId: room.currentGameId,
      gameMode: room.gameMode,
      startedAt: gameState.get("startedAt") ?? now,
      endedAt: now,
      standings,
    });
    tx.update(gameStateRef, { phase: "ended", endsAt: now });

    const isTournament = room.gameMode === "tournament";
    const nextIndex = room.currentGameIndex + 1;
    const tournamentOver = isTournament && nextIndex >= room.lineup.length;
    tx.set(roomRef(roomId).collection("displayState").doc("current"), {
      currentScreen: tournamentOver ? "champion" : isTournament ? "leaderboard" : "results",
      gameId: room.currentGameId,
      gameNumber: isTournament ? nextIndex : null,
      totalGames: isTournament ? room.lineup.length : null,
      currentQuestion: null,
      timerEndsAt: null,
      paused: false,
      publicResults: { standings: standings.slice(0, 10) },
      updatedAt: now,
    });
    touchRoomTx(tx, roomId, room, {
      status: tournamentOver ? "finished" : "waiting",
      currentGameIndex: isTournament ? Math.min(nextIndex, room.lineup.length) : 0,
      finishedAt: tournamentOver ? now : null,
      lastPlayedGameId: room.currentGameId,
    });
  });
  return { ok: true };
});
