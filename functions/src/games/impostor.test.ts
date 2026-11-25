import { describe, expect, it } from "vitest";
import type { ImpostorReveal, ImpostorRound, ImpostorSecret } from "../../../shared/engine";
import { IMPOSTOR_POINTS, impostor, type ImpostorSetup } from "./impostor";

const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ playerId: `p${i}`, nickname: `P${i}`, avatar: "mango" }));
const settings = (over: Record<string, unknown> = {}) => ({ impostors: 1, category: "food", clueRounds: 1, maxPlayers: 12, ...over });
const vote = (playerId: string, target: string) => ({ playerId, answer: { vote: target }, submittedAtMs: 0 });

function game(n = 5, over: Record<string, unknown> = {}) {
  const players = mk(n);
  const { setup, rounds } = impostor.setup(players, new Set(), settings(over));
  return { players, setup, rounds };
}

/** Firestore rejects nested arrays and undefined values. */
function assertFirestoreSafe(value: unknown, path = "$", inArray = false): void {
  if (value === undefined) throw new Error(`${path} is undefined`);
  if (Array.isArray(value)) {
    if (inArray) throw new Error(`${path} is a nested array`);
    value.forEach((v, i) => assertFirestoreSafe(v, `${path}[${i}]`, true));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) assertFirestoreSafe(v, `${path}.${k}`, false);
  }
}

describe("the impostor: setup", () => {
  it("picks the requested impostors, a word from the category, and one turn per player plus a vote", () => {
    const { setup, rounds } = game(5, { impostors: 2 });
    expect(setup.impostorIds).toHaveLength(2);
    expect(setup.category).toBe("food");
    expect(setup.word.length).toBeGreaterThan(0);
    expect(rounds).toBe(5 + 1);
    expect(new Set(setup.order.map((p) => p.playerId)).size).toBe(5);
  });

  it("never lets an impostor give the first clue", () => {
    for (let i = 0; i < 50; i++) {
      const { setup } = game(4);
      expect(setup.impostorIds).not.toContain(setup.order[0].playerId);
    }
  });

  it("multiplies turns by clue rounds", () => {
    expect(game(4, { clueRounds: 3 }).rounds).toBe(4 * 3 + 1);
  });

  it("needs 3 players and keeps impostors a minority", () => {
    expect(() => impostor.setup(mk(2), new Set(), settings())).toThrow(/at least 3/);
    expect(() => impostor.setup(mk(4), new Set(), settings({ impostors: 2 }))).toThrow(/at most 1 impostor/);
    expect(() => impostor.setup(mk(5), new Set(), settings({ impostors: 2 }))).not.toThrow();
  });

  it("random category picks one of the real categories", () => {
    const { setup } = game(4, { category: "random" });
    expect(["food", "animals", "places", "objects", "movies"]).toContain(setup.category);
  });
});

describe("the impostor: custom word", () => {
  const custom = (over: Record<string, unknown> = {}, secret: unknown = { word: "Grandma's Adobo" }) =>
    impostor.setup(mk(4), new Set(), settings({ customWord: true, category: "food", ...over }), secret);

  it("uses the host's word and category, and marks nothing in the word list as used", () => {
    const { setup, contentIds } = custom();
    expect(setup.word).toBe("Grandma's Adobo");
    expect(setup.category).toBe("food");
    expect(contentIds).toEqual([]);
  });

  it("gives the custom word to the crew only", () => {
    const { setup } = custom();
    const crew = setup.order.find((p) => !setup.impostorIds.includes(p.playerId))!.playerId;
    expect(impostor.privateInfo(setup, crew).word).toBe("Grandma's Adobo");
    expect(impostor.privateInfo(setup, setup.impostorIds[0]).word).toBeNull();
  });

  it("fails clearly when the word is missing or the category is random", () => {
    expect(() => custom({}, null)).toThrow(/custom word/);
    expect(() => custom({}, { word: "  " })).toThrow(/custom word/);
    expect(() => custom({ category: "random" })).toThrow(/category/);
  });

  it("ignores a stored word when the host switched back to random words", () => {
    const { setup, contentIds } = impostor.setup(mk(4), new Set(), settings(), { word: "Grandma's Adobo" });
    expect(setup.word).not.toBe("Grandma's Adobo");
    expect(contentIds).toHaveLength(1);
  });

  it("stops the crew from typing part of a multi-word custom word", () => {
    const { setup } = custom();
    const crew = setup.order.find((p) => !setup.impostorIds.includes(p.playerId))!.playerId;
    const opened = impostor.openRound(setup, 1, 0);
    expect(() => impostor.validate({ clue: "adobo" }, opened.public, { playerId: crew, setup })).toThrow(/secret word/);
  });
});

describe("the impostor: privacy", () => {
  it("gives the crew the word and impostors only their role (and partners)", () => {
    const { setup } = game(6, { impostors: 2 });
    for (const p of setup.order) {
      const s = impostor.privateInfo!(setup, p.playerId) as ImpostorSecret;
      if (setup.impostorIds.includes(p.playerId)) {
        expect(s).toMatchObject({ role: "impostor", word: null });
        expect(s.partners.map((x) => x.playerId)).toEqual(setup.impostorIds.filter((id) => id !== p.playerId));
      } else {
        expect(s).toMatchObject({ role: "crew", word: setup.word, partners: [] });
      }
    }
  });

  it("never puts the secret word or roles in public round data", () => {
    const { setup, rounds } = game(5);
    for (let r = 1; r <= rounds; r++) {
      const opened = impostor.openRound(setup, r, 0);
      const json = JSON.stringify(opened.public).toLowerCase();
      expect(json).not.toContain(setup.word.toLowerCase());
      expect(json).not.toContain("impostor");
      assertFirestoreSafe(opened.public);
    }
  });
});

describe("the impostor: clue turns", () => {
  it("only the turn player answers; the vote can't be skipped", () => {
    const { setup, rounds } = game(4);
    const turn = impostor.openRound(setup, 1, 0);
    expect(turn.eligibleIds).toEqual([setup.order[0].playerId]);
    expect(turn.label).toBe(`${setup.order[0].nickname}'s turn`);
    const vote = impostor.openRound(setup, rounds, 0);
    expect(vote.public.kind).toBe("vote");
    expect(vote.skippable).toBe(false);
  });

  it("accepts one word, rejects spaces, and stops the crew from saying the word", () => {
    const { setup } = game(4);
    const pub = impostor.openRound(setup, 1, 0).public;
    const crew = setup.order.find((p) => !setup.impostorIds.includes(p.playerId))!.playerId;
    const imp = setup.impostorIds[0];
    expect(impostor.validate({ clue: "  crunchy " }, pub, { playerId: crew, setup })).toEqual({ clue: "crunchy" });
    expect(() => impostor.validate({ clue: "very crunchy" }, pub, { playerId: crew, setup })).toThrow(/One word/);
    expect(() => impostor.validate({ clue: setup.word.split(" ")[0].toUpperCase() }, pub, { playerId: crew, setup })).toThrow(/secret word/);
    // An impostor saying the word is allowed: rejecting it would tell them they guessed right.
    expect(() => impostor.validate({ clue: setup.word.split(" ")[0] }, pub, { playerId: imp, setup })).not.toThrow();
  });

  it("records each clue (or none) for the next turns", () => {
    const { setup } = game(3);
    const pub = impostor.openRound(setup, 1, 0).public as Extract<ImpostorRound, { kind: "turn" }>;
    const said = impostor.score({ pub, secret: null, setup, submissions: [{ playerId: pub.turnPlayer.playerId, answer: { clue: "salty" }, submittedAtMs: 0 }], players: [], allPlayers: [], openedAtMs: 0, durationMs: 1 });
    expect((said.setup as ImpostorSetup).clues).toEqual([expect.objectContaining({ playerId: pub.turnPlayer.playerId, clue: "salty", clueRound: 1 })]);
    expect(said.reveal).toEqual({ kind: "clue", player: pub.turnPlayer, clue: "salty" });
    const silent = impostor.score({ pub, secret: null, setup, submissions: [], players: [], allPlayers: [], openedAtMs: 0, durationMs: 1 });
    expect((silent.setup as ImpostorSetup).clues[0].clue).toBeNull();
    const next = impostor.openRound(said.setup as ImpostorSetup, 2, 0).public as Extract<ImpostorRound, { kind: "turn" }>;
    expect(next.clues).toHaveLength(1);
  });
});

describe("the impostor: voting", () => {
  const votePub = (setup: ImpostorSetup, rounds: number) => impostor.openRound(setup, rounds, 0).public as Extract<ImpostorRound, { kind: "vote" }>;
  const score = (setup: ImpostorSetup, pub: ImpostorRound, submissions: ReturnType<typeof vote>[]) =>
    impostor.score({ pub, secret: null, setup, submissions, players: [], allPlayers: [], openedAtMs: 0, durationMs: 1 });

  it("rejects self-votes and non-candidates", () => {
    const { setup, rounds } = game(4);
    const pub = votePub(setup, rounds);
    expect(() => impostor.validate({ vote: "p0" }, pub, { playerId: "p0", setup })).toThrow(/yourself/);
    expect(() => impostor.validate({ vote: "nobody" }, pub, { playerId: "p0", setup })).toThrow(/Pick one/);
    expect(impostor.validate({ vote: "p1" }, pub, { playerId: "p0", setup })).toEqual({ vote: "p1" });
  });

  it("crew wins when the most-voted player is an impostor", () => {
    const { setup, rounds } = game(4);
    const imp = setup.impostorIds[0];
    const crew = setup.order.map((p) => p.playerId).filter((id) => id !== imp);
    const result = score(setup, votePub(setup, rounds), [...crew.map((c) => vote(c, imp)), vote(imp, crew[0])]);
    const r = result.reveal as Extract<ImpostorReveal, { kind: "votes" }>;
    expect(r.outcome).toMatchObject({ winner: "crew", accused: { playerId: imp }, word: setup.word, byTie: false });
    expect(result.points[crew[0]]).toBe(IMPOSTOR_POINTS.crewWin + IMPOSTOR_POINTS.correctVote);
    expect(result.points[imp]).toBe(0);
    expect(result.revealMs).toBeGreaterThan(0);
    assertFirestoreSafe(result.reveal);
  });

  it("the impostor wins when the crew accuses someone innocent", () => {
    const { setup, rounds } = game(4);
    const imp = setup.impostorIds[0];
    const crew = setup.order.map((p) => p.playerId).filter((id) => id !== imp);
    const [victim, ...others] = crew;
    const result = score(setup, votePub(setup, rounds), [...others.map((c) => vote(c, victim)), vote(imp, victim), vote(victim, imp)]);
    const r = result.reveal as Extract<ImpostorReveal, { kind: "votes" }>;
    expect(r.outcome).toMatchObject({ winner: "impostor", accused: { playerId: victim } });
    expect(result.points[imp]).toBe(IMPOSTOR_POINTS.impostorWin);
    expect(result.points[victim]).toBe(IMPOSTOR_POINTS.correctVote); // voted right, team still lost
  });

  it("a tie waits for the host (untimed, no outcome, Next blocked); Revote narrows the candidates", () => {
    const { setup, rounds } = game(4);
    const [a, b, c, d] = setup.order.map((p) => p.playerId);
    const result = score(setup, votePub(setup, rounds), [vote(a, b), vote(b, a), vote(c, a), vote(d, b)]);
    const r = result.reveal as Extract<ImpostorReveal, { kind: "votes" }>;
    expect(r.outcome).toBeNull();
    expect(r.tied.map((t) => t.playerId).sort()).toEqual([a, b].sort());
    expect(result.revealMs).toBe(0);
    const after = result.setup as ImpostorSetup;
    expect(impostor.blockAdvance!({ setup: after, phase: "reveal", lastReveal: r })).toMatch(/tie/);

    const revote = impostor.hostAction!("revote", { setup: after, round: rounds, totalRounds: rounds, phase: "reveal", lastReveal: r, players: [] });
    expect(revote).toMatchObject({ totalRounds: rounds + 1, advance: true });
    const pub = impostor.openRound(revote.setup!, rounds + 1, 0).public as Extract<ImpostorRound, { kind: "vote" }>;
    expect(pub.revote).toBe(true);
    expect(pub.candidates.map((x) => x.playerId).sort()).toEqual([a, b].sort());
  });

  it("revealing on a tie hands the win to the impostor", () => {
    const { setup, rounds } = game(4);
    const [a, b, c, d] = setup.order.map((p) => p.playerId);
    const tie = score(setup, votePub(setup, rounds), [vote(a, b), vote(b, a), vote(c, a), vote(d, b)]);
    const r = tie.reveal as Extract<ImpostorReveal, { kind: "votes" }>;
    const res = impostor.hostAction!("reveal", { setup: tie.setup as ImpostorSetup, round: rounds, totalRounds: rounds, phase: "reveal", lastReveal: r, players: [] });
    const out = (res.scored!.reveal as Extract<ImpostorReveal, { kind: "votes" }>).outcome!;
    expect(out).toMatchObject({ winner: "impostor", accused: null, byTie: true });
    expect(res.scored!.points[setup.impostorIds[0]]).toBe(IMPOSTOR_POINTS.impostorWin);
    expect(() => impostor.hostAction!("revote", { setup, round: rounds, totalRounds: rounds, phase: "reveal", lastReveal: res.scored!.reveal, players: [] })).toThrow(/no tied vote/);
  });
});
