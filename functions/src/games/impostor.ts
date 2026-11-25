import { IMPOSTOR_CATEGORIES, type ImpostorCategory, type ImpostorClue, type ImpostorOutcome, type ImpostorReveal, type ImpostorRound, type ImpostorSecret, type PlayerPick } from "../../../shared/engine";
import { IMPOSTOR_LIMITS, impostorSettings, maxImpostorsFor, type ImpostorHostSecret, type ImpostorSettings } from "../../../shared/gameSettings";
import { fail } from "../lib/errors";
import type { EngineSubmission, GameHandler, ScoredRound } from "../engine/types";
import { pickFresh, shuffle } from "../engine/random";
import { ALL_IMPOSTOR_WORDS } from "./impostorContent";

/** Clue turn: the player says their word aloud and types it (or the host moves on). */
export const TURN_MS = 30_000;
/** Everyone votes at once. */
export const VOTE_MS = 60_000;
/** How long a just-given clue stays big on the display. */
export const CLUE_REVEAL_MS = 3_500;
/** The final reveal: impostor unmasked, secret word, winners. */
export const OUTCOME_REVEAL_MS = 15_000;

export const IMPOSTOR_POINTS = {
  /** Each crew member when the crew catches an impostor. */
  crewWin: 500,
  /** Each crew member who personally voted for an impostor (win or lose). */
  correctVote: 250,
  /** Each impostor who isn't caught. */
  impostorWin: 1000,
} as const;

export interface ImpostorSetup {
  word: string;
  category: ImpostorCategory;
  impostorIds: string[];
  /** Turn order (everyone in the game at the start; never starts with an impostor). */
  order: PlayerPick[];
  clueRounds: number;
  clues: ImpostorClue[];
  /** Revote candidates (the tied players); null = everyone. */
  candidates: string[] | null;
  /** Vote rounds held so far. */
  votes: number;
}

type Secret = null;

const pick = (p: PlayerPick): PlayerPick => ({ playerId: p.playerId, nickname: p.nickname, avatar: p.avatar });
const turnsOf = (s: ImpostorSetup) => s.order.length * s.clueRounds;
const normalize = (text: string) => text.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "");

/** Points and phone feedback once the game is decided. */
export function outcomeScore(setup: ImpostorSetup, outcome: ImpostorOutcome, ballots: { voterId: string; targetId: string }[]) {
  const impostors = new Set(setup.impostorIds);
  const points: Record<string, number> = {};
  const feedback: ScoredRound["feedback"] = {};
  const votedRight = new Set(ballots.filter((b) => impostors.has(b.targetId)).map((b) => b.voterId));
  for (const p of setup.order) {
    const isImpostor = impostors.has(p.playerId);
    const won = isImpostor ? outcome.winner === "impostor" : outcome.winner === "crew";
    let pts = 0;
    if (isImpostor && won) pts += IMPOSTOR_POINTS.impostorWin;
    if (!isImpostor && won) pts += IMPOSTOR_POINTS.crewWin;
    if (!isImpostor && votedRight.has(p.playerId)) pts += IMPOSTOR_POINTS.correctVote;
    points[p.playerId] = pts;
    feedback[p.playerId] = {
      correct: won,
      detail: isImpostor
        ? won ? "You fooled them! The impostor wins." : "Busted! The crew caught you."
        : won ? `Crew wins! The word was “${setup.word}”.` : `The impostor got away. The word was “${setup.word}”.`,
    };
  }
  return { points, feedback };
}

function decide(setup: ImpostorSetup, accusedId: string | null, byTie: boolean): ImpostorOutcome {
  const byId = new Map(setup.order.map((p) => [p.playerId, p]));
  const accused = accusedId ? byId.get(accusedId) ?? null : null;
  return {
    winner: accused && setup.impostorIds.includes(accused.playerId) ? "crew" : "impostor",
    accused: accused ? pick(accused) : null,
    impostors: setup.impostorIds.map((id) => byId.get(id)).filter((p): p is PlayerPick => Boolean(p)).map(pick),
    word: setup.word,
    category: setup.category,
    byTie,
  };
}

/** Tally a vote round. A shared top spot is a tie: the host then chooses Revote or Reveal. */
export function tallyVotes(setup: ImpostorSetup, candidates: PlayerPick[], submissions: EngineSubmission[]) {
  const names = new Map(setup.order.map((p) => [p.playerId, p.nickname]));
  const ballots = submissions.map((s) => ({ voterId: s.playerId, voterName: names.get(s.playerId) ?? "?", targetId: (s.answer as { vote: string }).vote }));
  const tally = candidates
    .map((c) => ({ ...pick(c), votes: ballots.filter((b) => b.targetId === c.playerId).length }))
    .sort((a, b) => b.votes - a.votes || a.nickname.localeCompare(b.nickname));
  const top = tally[0]?.votes ?? 0;
  const leaders = tally.filter((t) => t.votes === top);
  return { ballots, tally, leaders };
}

export const impostor: GameHandler<ImpostorSetup, ImpostorRound, Secret> = {
  id: "impostor",
  introMs: 15_000, // time to peek at your role
  revealMs: CLUE_REVEAL_MS,

  setup(players, used, settings, hostSecret) {
    const options: ImpostorSettings = impostorSettings(settings as Partial<ImpostorSettings> | undefined);
    if (players.length < IMPOSTOR_LIMITS.minPlayers) fail("failed-precondition", `The Impostor needs at least ${IMPOSTOR_LIMITS.minPlayers} players.`);
    const most = maxImpostorsFor(players.length);
    if (options.impostors > most) {
      fail("failed-precondition", `With ${players.length} players you can have at most ${most} impostor${most === 1 ? "" : "s"}. Lower it in the game options.`);
    }
    let category: ImpostorCategory;
    let word: { word: string; contentIds: string[] };
    if (options.customWord) {
      const custom = (hostSecret as Partial<ImpostorHostSecret> | undefined)?.word;
      if (typeof custom !== "string" || !custom.trim()) fail("failed-precondition", "Type your custom word in The Impostor options, or switch back to a random word.");
      if (options.category === "random") fail("failed-precondition", "Pick the category your custom word fits in The Impostor options.");
      category = options.category;
      word = { word: custom.trim(), contentIds: [] }; // not from the word list: nothing to mark as used
    } else {
      category = options.category === "random" ? shuffle(IMPOSTOR_CATEGORIES)[0] : options.category;
      const [picked] = pickFresh(ALL_IMPOSTOR_WORDS.filter((w) => w.category === category), 1, used);
      word = { word: picked.word, contentIds: [picked.id] };
    }

    const shuffled = shuffle(players.map(pick));
    const impostorIds = shuffle(shuffled.map((p) => p.playerId)).slice(0, options.impostors);
    // Never let an impostor go first: they'd have nothing to go on.
    const firstCrew = shuffled.findIndex((p) => !impostorIds.includes(p.playerId));
    const order = [...shuffled.slice(firstCrew), ...shuffled.slice(0, firstCrew)];

    const setup: ImpostorSetup = { word: word.word, category, impostorIds, order, clueRounds: options.clueRounds, clues: [], candidates: null, votes: 0 };
    return { setup, rounds: turnsOf(setup) + 1, contentIds: word.contentIds };
  },

  privateInfo(setup, playerId): ImpostorSecret {
    const isImpostor = setup.impostorIds.includes(playerId);
    return {
      role: isImpostor ? "impostor" : "crew",
      word: isImpostor ? null : setup.word,
      category: setup.category,
      partners: isImpostor ? setup.order.filter((p) => p.playerId !== playerId && setup.impostorIds.includes(p.playerId)).map(pick) : [],
    };
  },

  openRound(setup, round) {
    const turns = turnsOf(setup);
    if (round <= turns) {
      const index = round - 1;
      const player = setup.order[index % setup.order.length];
      return {
        public: {
          kind: "turn",
          turnPlayer: pick(player),
          turn: round,
          turns,
          clueRound: Math.floor(index / setup.order.length) + 1,
          clueRounds: setup.clueRounds,
          category: setup.category,
          clues: setup.clues,
        },
        secret: null,
        durationMs: TURN_MS,
        eligibleIds: [player.playerId],
        label: `${player.nickname}'s turn`,
      };
    }
    const candidates = setup.candidates ? setup.order.filter((p) => setup.candidates!.includes(p.playerId)) : setup.order;
    return {
      public: { kind: "vote", candidates: candidates.map(pick), revote: setup.votes > 0, category: setup.category, clues: setup.clues },
      secret: null,
      durationMs: VOTE_MS,
      eligibleIds: setup.order.map((p) => p.playerId),
      label: setup.votes > 0 ? "Revote" : "Vote",
      skippable: false, // the vote decides the game
    };
  },

  validate(answer, pub, { playerId, setup }) {
    const a = (answer ?? {}) as Record<string, unknown>;
    if (pub.kind === "turn") {
      if (typeof a.clue !== "string") fail("invalid-argument", "Type your clue.");
      const clue = a.clue.trim().replace(/\s+/g, " ");
      if (!/^[\p{L}\p{N}][\p{L}\p{N}'’-]{0,23}$/u.test(clue)) fail("invalid-argument", "One word only, no spaces (up to 24 letters).");
      // Only the crew knows the word; rejecting an impostor's guess would tell them it's right.
      if (!setup.impostorIds.includes(playerId)) {
        const w = normalize(setup.word);
        const c = normalize(clue);
        if (c === w || setup.word.split(/\s+/).some((part) => normalize(part) === c)) fail("invalid-argument", "That's the secret word! Give a sneakier clue.");
      }
      return { clue };
    }
    if (typeof a.vote !== "string" || !pub.candidates.some((c) => c.playerId === a.vote)) fail("invalid-argument", "Pick one of the players.");
    if (a.vote === playerId) fail("invalid-argument", "You can't vote for yourself.");
    return { vote: a.vote };
  },

  score({ pub, setup, submissions }) {
    if (pub.kind === "turn") {
      const clue = (submissions[0]?.answer as { clue: string } | undefined)?.clue ?? null;
      const entry: ImpostorClue = { ...pub.turnPlayer, clue, clueRound: pub.clueRound };
      const reveal: ImpostorReveal = { kind: "clue", player: pub.turnPlayer, clue };
      return {
        points: {},
        feedback: { [pub.turnPlayer.playerId]: { correct: null, detail: clue ? `Your clue: ${clue}` : "No clue typed" } },
        reveal,
        setup: { ...setup, clues: [...setup.clues, entry] },
      };
    }

    const { ballots, tally, leaders } = tallyVotes(setup, pub.candidates, submissions);
    const next = { ...setup, votes: setup.votes + 1 };
    if (leaders.length !== 1) {
      // Tie (or nobody voted): wait for the host to pick Revote or Reveal.
      const reveal: ImpostorReveal = { kind: "votes", tally, ballots, tied: leaders.map(pick), outcome: null };
      return { points: {}, feedback: {}, reveal, setup: next, revealMs: 0 };
    }
    const outcome = decide(setup, leaders[0].playerId, false);
    const reveal: ImpostorReveal = { kind: "votes", tally, ballots, tied: [], outcome };
    return { ...outcomeScore(setup, outcome, ballots), reveal, setup: next, revealMs: OUTCOME_REVEAL_MS };
  },

  hostAction(name, { setup, phase, lastReveal, totalRounds }) {
    const r = lastReveal as ImpostorReveal | null;
    if (phase !== "reveal" || r?.kind !== "votes" || r.outcome || r.tied.length < 2) fail("failed-precondition", "There's no tied vote to settle.");
    if (name === "revote") {
      return { setup: { ...setup, candidates: r.tied.map((t) => t.playerId) }, totalRounds: totalRounds + 1, advance: true };
    }
    if (name === "reveal") {
      // Ending on a tie means the crew couldn't agree: the impostor wins.
      const outcome = decide(setup, null, true);
      const reveal: ImpostorReveal = { ...r, outcome };
      return { scored: { ...outcomeScore(setup, outcome, r.ballots), reveal, revealMs: OUTCOME_REVEAL_MS } };
    }
    fail("invalid-argument", "Unknown action.");
  },

  blockAdvance({ phase, lastReveal }) {
    const r = lastReveal as ImpostorReveal | null;
    if (phase === "reveal" && r?.kind === "votes" && !r.outcome) return "It's a tie: choose Revote or Reveal the impostor.";
    return undefined;
  },
};
