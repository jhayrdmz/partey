import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import type { GameControlAction, GamePhase, SubmitAnswerResponse } from "../../../shared/engine";
import { FieldValue, db, roomRef } from "../lib/admin";
import { fail, requireUid } from "../lib/errors";
import { assertHost } from "../lib/rooms";
import * as v from "../lib/validate";
import { REGION } from "../config";
import {
  advance, countSubmissions, gameStateRef, loadGameCtx, loadSubmissions, pauseGame, resumeGame, skipRound, submissionRef, type GameCtx,
} from "./lifecycle";

const opts = { region: REGION, cors: true } as const;
/** Clock tolerance for deadlines (client clocks are synced to the RTDB server offset). */
const DEADLINE_SKEW_MS = 300;
/** Late answers still accepted this long after the deadline (network in flight). */
const LATE_GRACE_MS = 750;

function round(data: Record<string, unknown>): number {
  const r = data.round;
  if (typeof r !== "number" || !Number.isInteger(r) || r < 0 || r > 1000) fail("invalid-argument", "Invalid round.");
  return r;
}

function phase(data: Record<string, unknown>): GamePhase {
  const p = data.phase;
  if (p !== "intro" && p !== "question" && p !== "reveal") fail("invalid-argument", "Invalid phase.");
  return p;
}

function isActivePlayer(ctx: GameCtx, uid: string) {
  return ctx.players.some((p) => p.playerId === uid);
}

/** Close the round early once every eligible player has answered. Safe to call repeatedly. */
async function closeIfEveryoneAnswered(roomId: string, entryId: string, roundNo: number, eligible: number) {
  if ((await countSubmissions(roomId, entryId, roundNo)) < eligible) return;
  await db.runTransaction(async (tx) => {
    const ctx = await loadGameCtx(tx, roomId);
    if (!ctx || ctx.gs.paused || ctx.gs.phase !== "question" || ctx.gs.round !== roundNo || ctx.gs.entryId !== entryId) return;
    const subs = await loadSubmissions(tx, ctx);
    if (subs.length < ctx.gs.eligibleIds.length) return;
    advance(tx, ctx, subs, Date.now());
  });
}

/**
 * A player's answer for the current round. Idempotent: one submission per
 * player per round (doc id = entry_round_uid); later attempts are ignored.
 */
export const submitAnswer = onCall(opts, async (req): Promise<SubmitAnswerResponse> => {
  const uid = requireUid(req);
  const receivedAtMs = Date.now();
  const data = v.asObject(req.data);
  const roomId = v.docId(data, "roomId");
  const roundNo = round(data);

  const result = await db.runTransaction(async (tx) => {
    const ctx = await loadGameCtx(tx, roomId, { requireActive: true });
    const { gs } = ctx!;
    if (gs.phase !== "question" || gs.round !== roundNo) fail("failed-precondition", "This round is over.");
    if (gs.paused) fail("failed-precondition", "The game is paused.");
    if (!gs.eligibleIds.includes(uid) || !isActivePlayer(ctx!, uid)) fail("permission-denied", "You'll join from the next round.");
    if (gs.phaseEndsAtMs !== null && receivedAtMs > gs.phaseEndsAtMs + LATE_GRACE_MS) fail("deadline-exceeded", "Time's up!");

    const ref = submissionRef(roomId, gs.entryId, gs.round, uid);
    if ((await tx.get(ref)).exists) return { accepted: false, entryId: gs.entryId, eligible: gs.eligibleIds.length };
    const answer = ctx!.handler.validate(data.answer, gs.roundPublic);

    tx.create(ref, { entryId: gs.entryId, round: gs.round, playerId: uid, answer, submittedAtMs: receivedAtMs });
    tx.set(roomRef(roomId).collection("private").doc(uid), { answered: true, answer }, { merge: true });
    // Blind increment: no read of displayState, so concurrent answers don't contend.
    tx.update(roomRef(roomId).collection("displayState").doc("current"), { "game.submitted": FieldValue.increment(1) });
    return { accepted: true, entryId: gs.entryId, eligible: gs.eligibleIds.length };
  });

  if (result.accepted) {
    // Best effort: the answer is already stored; the timer tick closes the round otherwise.
    await closeIfEveryoneAnswered(roomId, result.entryId, roundNo, result.eligible).catch((err) =>
      logger.error("Early round close failed", { roomId, round: roundNo, err }),
    );
  }
  return { accepted: result.accepted };
});

/**
 * "My timer reached zero." Called by the host and players' devices. The server
 * only advances if ITS clock says the deadline passed, so it can't skip time.
 */
export const tickGame = onCall(opts, async (req) => {
  const uid = requireUid(req);
  const data = v.asObject(req.data);
  const roomId = v.docId(data, "roomId");
  const expectedRound = round(data);
  const expectedPhase = phase(data);

  const advanced = await db.runTransaction(async (tx) => {
    const ctx = await loadGameCtx(tx, roomId);
    if (!ctx) return false;
    if (ctx.room.hostId !== uid && !isActivePlayer(ctx, uid)) fail("permission-denied", "Not a member of this game.");
    const { gs } = ctx;
    if (gs.paused || gs.round !== expectedRound || gs.phase !== expectedPhase) return false; // someone else already advanced
    if (gs.phaseEndsAtMs === null || Date.now() < gs.phaseEndsAtMs - DEADLINE_SKEW_MS) return false;
    const subs = await loadSubmissions(tx, ctx);
    advance(tx, ctx, subs, Date.now());
    return true;
  });
  return { advanced };
});

/** Host controls: pause, resume, skip (question, unscored) and next (advance now). */
export const controlGame = onCall(opts, async (req) => {
  const uid = requireUid(req);
  const data = v.asObject(req.data);
  const roomId = v.docId(data, "roomId");
  const action = data.action as GameControlAction;
  if (!["pause", "resume", "skip", "next"].includes(action)) fail("invalid-argument", "Unknown action.");

  await db.runTransaction(async (tx) => {
    const ctx = (await loadGameCtx(tx, roomId, { requireActive: true }))!;
    assertHost(ctx.room, uid);
    const subs = await loadSubmissions(tx, ctx);
    const now = Date.now();
    switch (action) {
      case "pause":
        return pauseGame(tx, ctx, subs.length, now);
      case "resume":
        return resumeGame(tx, ctx, subs.length, now);
      case "skip":
        if (ctx.gs.paused) fail("failed-precondition", "Resume the game first.");
        return skipRound(tx, ctx, now);
      case "next":
        if (ctx.gs.paused) fail("failed-precondition", "Resume the game first.");
        return advance(tx, ctx, subs, now);
    }
  });
  return { ok: true };
});

export { gameStateRef };
