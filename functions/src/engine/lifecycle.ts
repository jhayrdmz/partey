import type { Transaction } from "firebase-admin/firestore";
import { DEFAULT_OTHER_PLACEMENT_POINTS, DEFAULT_PLACEMENT_POINTS } from "../../../shared/constants";
import type { PlayerPrivateDoc, PublicGameState, StandingEntry } from "../../../shared/engine";
import type { GameId } from "../../../shared/games";
import { FieldValue, Timestamp, db, roomRef } from "../lib/admin";
import { fail } from "../lib/errors";
import { getLiveRoomTx, touchRoomTx, type ServerRoom } from "../lib/rooms";
import { generateId } from "../lib/codes";
import { getHandler } from "./registry";
import type { GameStateDoc } from "./state";
import type { EnginePlayer, EngineSubmission, GameHandler, ScoredRound } from "./types";

/* ─── Refs ───────────────────────────────────────────────────────────── */

export const gameStateRef = (roomId: string) => roomRef(roomId).collection("gameState").doc("current");
const displayRef = (roomId: string) => roomRef(roomId).collection("displayState").doc("current");
const privateRef = (roomId: string, uid: string) => roomRef(roomId).collection("private").doc(uid);
export const submissionRef = (roomId: string, entryId: string, round: number, uid: string) =>
  roomRef(roomId).collection("submissions").doc(`${entryId}_${round}_${uid}`);
const submissionsQuery = (roomId: string, entryId: string, round: number) =>
  roomRef(roomId).collection("submissions").where("entryId", "==", entryId).where("round", "==", round);

/* ─── Context ────────────────────────────────────────────────────────── */

export interface GameCtx {
  roomId: string;
  room: ServerRoom;
  gs: GameStateDoc;
  handler: GameHandler;
  /** Players currently in the room (online or reconnecting). */
  players: EnginePlayer[];
  /** Cumulative scores (tournament) keyed by uid, for leaderboards. */
  roomScores: Record<string, number>;
}

/** Read everything a transition may need. Must run before any transaction write. */
export async function loadGameCtx(tx: Transaction, roomId: string, opts: { requireActive?: boolean } = {}): Promise<GameCtx | null> {
  const room = await getLiveRoomTx(tx, roomId);
  const [gsSnap, playersSnap] = await Promise.all([
    tx.get(gameStateRef(roomId)),
    tx.get(roomRef(roomId).collection("players").where("status", "in", ["online", "offline"])),
  ]);
  if (!gsSnap.exists) {
    if (opts.requireActive) fail("failed-precondition", "No game is running.");
    return null;
  }
  const gs = gsSnap.data() as GameStateDoc;
  if (gs.status !== "active" || room.status !== "playing") {
    if (opts.requireActive) fail("failed-precondition", "No game is running.");
    return null;
  }
  const handler = getHandler(gs.gameId);
  if (!handler) fail("internal", "Game handler missing.");
  const players = playersSnap.docs.map((d) => ({ playerId: d.id, nickname: d.get("nickname") as string, avatar: d.get("avatar") as string }));
  const roomScores = Object.fromEntries(playersSnap.docs.map((d) => [d.id, (d.get("score") as number) ?? 0]));
  return { roomId, room, gs, handler, players, roomScores };
}

export async function loadSubmissions(tx: Transaction, ctx: GameCtx): Promise<EngineSubmission[]> {
  if (ctx.gs.phase !== "question") return [];
  const snap = await tx.get(submissionsQuery(ctx.roomId, ctx.gs.entryId, ctx.gs.round));
  const eligible = new Set(ctx.gs.eligibleIds);
  return snap.docs
    .map((d) => ({ playerId: d.get("playerId") as string, answer: d.get("answer"), submittedAtMs: d.get("submittedAtMs") as number }))
    .filter((s) => eligible.has(s.playerId));
}

export async function countSubmissions(roomId: string, entryId: string, round: number): Promise<number> {
  const agg = await submissionsQuery(roomId, entryId, round).count().get();
  return agg.data().count;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

export function standingsFrom(scores: Record<string, number>, players: EnginePlayer[]): StandingEntry[] {
  return players
    .map((p) => ({ ...p, score: scores[p.playerId] ?? 0 }))
    .sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));
}

/** Competition ranking: ties share a rank (1, 2, 2, 4). */
export function ranks(standings: StandingEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  standings.forEach((s, i) => {
    const prev = standings[i - 1];
    out.set(s.playerId, prev && prev.score === s.score ? out.get(prev.playerId)! : i + 1);
  });
  return out;
}

/** Tournament placement points with shared placements for ties. */
export function placementPoints(standings: StandingEntry[], scoring?: ServerRoom["scoring"]): Map<string, number> {
  const table = scoring?.placementPoints ?? [...DEFAULT_PLACEMENT_POINTS];
  const other = scoring?.otherPoints ?? DEFAULT_OTHER_PLACEMENT_POINTS;
  const r = ranks(standings);
  return new Map(standings.map((s) => [s.playerId, table[(r.get(s.playerId) ?? 99) - 1] ?? other]));
}

function publicState(ctx: GameCtx, gs: GameStateDoc, extra: { submitted: number; reveal: unknown }): PublicGameState {
  return {
    phase: gs.phase,
    round: gs.round,
    totalRounds: gs.totalRounds,
    phaseEndsAtMs: gs.paused ? null : gs.phaseEndsAtMs,
    phaseDurationMs: gs.phaseDurationMs,
    paused: gs.paused,
    remainingMs: gs.remainingMs,
    submitted: extra.submitted,
    eligible: gs.phase === "question" ? gs.eligibleIds.length : ctx.players.length,
    round_data: gs.phase === "intro" ? null : gs.roundPublic,
    reveal: gs.phase === "reveal" ? extra.reveal : null,
    standings: standingsFrom(gs.scores, ctx.players).slice(0, 10),
    roundLabel: gs.phase === "intro" ? null : (gs.roundLabel ?? null),
    skippable: gs.skippable !== false,
  };
}

function writeDisplay(tx: Transaction, ctx: GameCtx, gs: GameStateDoc, extra: { submitted: number; reveal: unknown }) {
  const isTournament = ctx.room.gameMode === "tournament";
  tx.set(displayRef(ctx.roomId), {
    currentScreen: "game",
    gameId: gs.gameId,
    gameNumber: isTournament ? ctx.room.currentGameIndex + 1 : null,
    totalGames: isTournament ? ctx.room.lineup.length : null,
    game: publicState(ctx, gs, extra),
    publicResults: null,
    updatedAt: Timestamp.now(),
  });
}

function writePrivate(tx: Transaction, roomId: string, uid: string, data: Partial<PlayerPrivateDoc>) {
  tx.set(privateRef(roomId, uid), data, { merge: true });
}

/* ─── Transitions ────────────────────────────────────────────────────── */

/** Create a fresh game in the intro phase. Caller has validated the host and room state. */
export async function initGame(
  tx: Transaction,
  args: { roomId: string; room: ServerRoom; gameId: GameId; entryId: string; players: EnginePlayer[]; hostSecret?: unknown; nowMs: number; roomPatch: Partial<ServerRoom> },
) {
  const handler = getHandler(args.gameId);
  if (!handler) fail("failed-precondition", "This game is coming soon!");
  const used = new Set(args.room.usedContent ?? []);
  const { setup, rounds, contentIds } = handler.setup(args.players, used, args.room.gameSettings?.[args.gameId as keyof NonNullable<ServerRoom["gameSettings"]>], args.hostSecret);
  const gs: GameStateDoc = {
    gameId: args.gameId,
    entryId: args.entryId,
    status: "active",
    phase: "intro",
    round: 0,
    totalRounds: rounds,
    phaseEndsAtMs: args.nowMs + handler.introMs,
    phaseDurationMs: handler.introMs,
    paused: false,
    remainingMs: null,
    setup,
    roundPublic: null,
    roundSecret: null,
    roundOpenedAtMs: null,
    eligibleIds: args.players.map((p) => p.playerId),
    scores: {},
    lastReveal: null,
    startedAtMs: args.nowMs,
  };
  tx.set(gameStateRef(args.roomId), gs);
  const room = { ...args.room, ...args.roomPatch };
  const ctx: GameCtx = { roomId: args.roomId, room, gs, handler, players: args.players, roomScores: {} };
  writeDisplay(tx, ctx, gs, { submitted: 0, reveal: null });
  for (const p of args.players) {
    writePrivate(tx, args.roomId, p.playerId, {
      gameId: args.gameId, round: 0, phase: "intro", answer: null, answered: false, lastRound: null, gameScore: 0, rank: null,
      // Roles / secret words: only this player can read their private doc.
      secret: handler.privateInfo?.(setup, p.playerId) ?? null,
    });
  }
  const usedContent = [...new Set([...(args.room.usedContent ?? []), ...contentIds])].slice(-200);
  touchRoomTx(tx, args.roomId, args.room, { ...args.roomPatch, usedContent });
}

function openRound(tx: Transaction, ctx: GameCtx, round: number, nowMs: number) {
  const opened = ctx.handler.openRound(ctx.gs.setup, round, nowMs);
  const gs: GameStateDoc = {
    ...ctx.gs,
    phase: "question",
    round,
    // No deadline for untimed rounds: they end when everyone has answered or the host ends them.
    phaseEndsAtMs: opened.durationMs > 0 ? nowMs + opened.durationMs : null,
    phaseDurationMs: opened.durationMs,
    paused: false,
    remainingMs: null,
    roundPublic: opened.public,
    roundSecret: opened.secret,
    roundOpenedAtMs: nowMs,
    // Only players still in the room can answer (someone who left mid-game drops out).
    eligibleIds: (opened.eligibleIds ?? ctx.players.map((p) => p.playerId)).filter((id) => ctx.players.some((p) => p.playerId === id)),
    lastReveal: null,
    roundLabel: opened.label ?? null,
    skippable: opened.skippable !== false,
  };
  tx.set(gameStateRef(ctx.roomId), gs);
  writeDisplay(tx, ctx, gs, { submitted: 0, reveal: null });
  for (const p of ctx.players) {
    writePrivate(tx, ctx.roomId, p.playerId, { gameId: gs.gameId, round, phase: "question", answer: null, answered: false });
  }
}

function closeRound(tx: Transaction, ctx: GameCtx, submissions: EngineSubmission[], nowMs: number, opts: { score: boolean }) {
  const { gs } = ctx;
  const scored: ScoredRound = opts.score
    ? ctx.handler.score({
        pub: gs.roundPublic,
        secret: gs.roundSecret,
        setup: gs.setup,
        submissions,
        players: ctx.players.filter((p) => gs.eligibleIds.includes(p.playerId)),
        allPlayers: ctx.players,
        openedAtMs: gs.roundOpenedAtMs ?? nowMs,
        durationMs: gs.phaseDurationMs,
      })
    : { points: {}, feedback: {}, reveal: null };
  writeReveal(tx, ctx, gs, scored, submissions.length, nowMs, opts);
}

/** Show a reveal (new, or replacing the current one) and add its points. */
function writeReveal(
  tx: Transaction,
  ctx: GameCtx,
  gs: GameStateDoc,
  scored: ScoredRound,
  submittedCount: number,
  nowMs: number,
  opts: { score: boolean },
) {
  const scores = { ...gs.scores };
  for (const [uid, pts] of Object.entries(scored.points)) scores[uid] = (scores[uid] ?? 0) + pts;
  // 0 = untimed: stays up until the host moves on (e.g. a tied vote waiting for Revote / Reveal).
  const revealMs = scored.revealMs ?? ctx.handler.revealMs;
  const next: GameStateDoc = {
    ...gs,
    phase: "reveal",
    phaseEndsAtMs: revealMs > 0 ? nowMs + revealMs : null,
    phaseDurationMs: revealMs,
    paused: false,
    remainingMs: null,
    scores,
    lastReveal: scored.reveal,
    ...(scored.setup !== undefined ? { setup: scored.setup } : {}),
    ...(scored.totalRounds !== undefined ? { totalRounds: scored.totalRounds } : {}),
  };
  tx.set(gameStateRef(ctx.roomId), next);
  writeDisplay(tx, ctx, next, { submitted: submittedCount, reveal: scored.reveal });
  const r = ranks(standingsFrom(scores, ctx.players));
  for (const p of ctx.players) {
    const fb = scored.feedback[p.playerId];
    writePrivate(tx, ctx.roomId, p.playerId, {
      gameId: gs.gameId,
      round: gs.round,
      phase: "reveal",
      lastRound: opts.score && fb ? { round: gs.round, points: scored.points[p.playerId] ?? 0, correct: fb.correct, detail: fb.detail } : null,
      gameScore: scores[p.playerId] ?? 0,
      rank: r.get(p.playerId) ?? null,
    });
  }
}

/**
 * End the game: rank by game points, award tournament placement points (or set
 * freestyle scores), record history and move the room on. Idempotent via gs.status.
 */
export function finalizeGame(tx: Transaction, ctx: GameCtx, nowMs: number) {
  const { gs, room, roomId } = ctx;
  const isTournament = room.gameMode === "tournament";
  const gameStandings = standingsFrom(gs.scores, ctx.players);
  const awarded = isTournament ? placementPoints(gameStandings, room.scoring) : new Map<string, number>();

  for (const p of ctx.players) {
    const ref = roomRef(roomId).collection("players").doc(p.playerId);
    if (isTournament) tx.update(ref, { score: FieldValue.increment(awarded.get(p.playerId) ?? 0) });
    else tx.update(ref, { score: gs.scores[p.playerId] ?? 0 });
    writePrivate(tx, roomId, p.playerId, { phase: null, round: gs.round, answered: false, answer: null });
  }

  const overall: StandingEntry[] = isTournament
    ? ctx.players
        .map((p) => ({ ...p, score: (ctx.roomScores[p.playerId] ?? 0) + (awarded.get(p.playerId) ?? 0), delta: awarded.get(p.playerId) ?? 0 }))
        .sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname))
    : gameStandings;

  const nextIndex = room.currentGameIndex + 1;
  const tournamentOver = isTournament && nextIndex >= room.lineup.length;
  const now = Timestamp.fromMillis(nowMs);

  tx.set(roomRef(roomId).collection("history").doc(`${room.currentGameIndex}_${gs.entryId || generateId(6)}`), {
    gameId: gs.gameId,
    gameMode: room.gameMode,
    startedAt: Timestamp.fromMillis(gs.startedAtMs),
    endedAt: now,
    roundsPlayed: gs.round,
    totalRounds: gs.totalRounds,
    standings: gameStandings,
    placementPoints: isTournament ? Object.fromEntries(awarded) : null,
  });
  tx.set(gameStateRef(roomId), { ...gs, status: "ended", phaseEndsAtMs: null, paused: false });
  tx.set(displayRef(roomId), {
    currentScreen: tournamentOver ? "champion" : isTournament ? "leaderboard" : "results",
    gameId: gs.gameId,
    gameNumber: isTournament ? nextIndex : null,
    totalGames: isTournament ? room.lineup.length : null,
    game: null,
    publicResults: { standings: overall.slice(0, 12), gameStandings: gameStandings.slice(0, 12) },
    updatedAt: now,
  });
  touchRoomTx(tx, roomId, room, {
    status: tournamentOver ? "finished" : "waiting",
    currentGameIndex: isTournament ? Math.min(nextIndex, room.lineup.length) : 0,
    finishedAt: tournamentOver ? now : null,
    lastPlayedGameId: gs.gameId,
  });
}

/** Move to the next phase: intro→round 1, question→reveal (scored), reveal→next round or finalize. */
export function advance(tx: Transaction, ctx: GameCtx, submissions: EngineSubmission[], nowMs: number) {
  const { gs } = ctx;
  if (gs.phase === "intro") return openRound(tx, ctx, 1, nowMs);
  if (gs.phase === "question") return closeRound(tx, ctx, submissions, nowMs, { score: true });
  if (gs.round < gs.totalRounds) return openRound(tx, ctx, gs.round + 1, nowMs);
  return finalizeGame(tx, ctx, nowMs);
}

/** Skip the current question without scoring. */
export function skipRound(tx: Transaction, ctx: GameCtx, nowMs: number) {
  if (ctx.gs.phase !== "question") fail("failed-precondition", "You can only skip during a question.");
  if (ctx.gs.skippable === false) fail("failed-precondition", "This round can't be skipped.");
  if (ctx.gs.round < ctx.gs.totalRounds) return openRound(tx, ctx, ctx.gs.round + 1, nowMs);
  return finalizeGame(tx, ctx, nowMs);
}

/** A game-specific host action (e.g. The Impostor's "revote" / "reveal" after a tied vote). */
export function hostGameAction(tx: Transaction, ctx: GameCtx, name: string, submittedCount: number, nowMs: number) {
  const { gs, handler } = ctx;
  if (!handler.hostAction) fail("failed-precondition", "This game has no such action.");
  if (gs.paused) fail("failed-precondition", "Resume the game first.");
  const result = handler.hostAction(name, {
    setup: gs.setup,
    round: gs.round,
    totalRounds: gs.totalRounds,
    phase: gs.phase,
    lastReveal: gs.lastReveal,
    players: ctx.players,
  });
  const updated: GameStateDoc = {
    ...gs,
    ...(result.setup !== undefined ? { setup: result.setup } : {}),
    ...(result.totalRounds !== undefined ? { totalRounds: result.totalRounds } : {}),
  };
  const next: GameCtx = { ...ctx, gs: updated };
  if (result.scored) return writeReveal(tx, next, updated, result.scored, submittedCount, nowMs, { score: true });
  if (result.advance) return openRound(tx, next, updated.round + 1, nowMs);
  tx.set(gameStateRef(ctx.roomId), updated);
}

export function pauseGame(tx: Transaction, ctx: GameCtx, submittedCount: number, nowMs: number) {
  const { gs } = ctx;
  if (gs.paused) return;
  // Untimed rounds have no deadline to freeze; remainingMs stays null so resume keeps them untimed.
  const untimed = gs.phaseEndsAtMs === null;
  const next: GameStateDoc = { ...gs, paused: true, remainingMs: untimed ? null : Math.max(1000, gs.phaseEndsAtMs! - nowMs) };
  tx.set(gameStateRef(ctx.roomId), next);
  writeDisplay(tx, ctx, next, { submitted: submittedCount, reveal: gs.lastReveal });
}

export function resumeGame(tx: Transaction, ctx: GameCtx, submittedCount: number, nowMs: number) {
  const { gs } = ctx;
  if (!gs.paused) return;
  if (gs.remainingMs === null && gs.phaseDurationMs === 0) {
    const next: GameStateDoc = { ...gs, paused: false };
    tx.set(gameStateRef(ctx.roomId), next);
    writeDisplay(tx, ctx, next, { submitted: submittedCount, reveal: gs.lastReveal });
    return;
  }
  const endsAt = nowMs + (gs.remainingMs ?? 5000);
  let { roundPublic, roundSecret } = gs;
  if (gs.phase === "question" && ctx.handler.shiftTimes && gs.phaseEndsAtMs) {
    ({ pub: roundPublic, secret: roundSecret } = ctx.handler.shiftTimes(roundPublic, roundSecret, endsAt - gs.phaseEndsAtMs));
  }
  const shift = gs.phaseEndsAtMs ? endsAt - gs.phaseEndsAtMs : 0;
  const next: GameStateDoc = {
    ...gs,
    paused: false,
    remainingMs: null,
    phaseEndsAtMs: endsAt,
    roundPublic,
    roundSecret,
    // Speed bonuses are measured from the open time; shift it so pausing doesn't cost points.
    roundOpenedAtMs: gs.roundOpenedAtMs !== null ? gs.roundOpenedAtMs + shift : null,
  };
  tx.set(gameStateRef(ctx.roomId), next);
  writeDisplay(tx, ctx, next, { submitted: submittedCount, reveal: gs.lastReveal });
}

export { db };
