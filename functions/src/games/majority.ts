import type { ChoiceQuestion, MajorityReveal } from "../../../shared/engine";
import type { GameHandler } from "../engine/types";
import { countChoices, validateChoice } from "../engine/choice";
import { pickFresh } from "../engine/random";
import { MAJORITY, type MajorityItem } from "./majorityContent";

const ROUNDS = 6;
const QUESTION_MS = 20_000;
export const MAJORITY_POINTS = 500;

/** Indexes of the most-picked options (ties all count). Empty when nobody answered. */
export function majorityIndexes(counts: number[]): number[] {
  const max = Math.max(0, ...counts);
  if (max === 0) return [];
  return counts.flatMap((c, i) => (c === max ? [i] : []));
}

export const majority: GameHandler<{ items: MajorityItem[] }, ChoiceQuestion, null> = {
  id: "majority",
  introMs: 10_000,
  revealMs: 8_000,
  setup(_players, used) {
    const items = pickFresh(MAJORITY, ROUNDS, used);
    return { setup: { items }, rounds: items.length, contentIds: items.map((i) => i.id) };
  },
  openRound(setup, round) {
    const item = setup.items[round - 1];
    return { public: { prompt: item.prompt, options: item.options }, secret: null, durationMs: QUESTION_MS };
  },
  validate(answer, pub) {
    return validateChoice(answer, pub.options.length);
  },
  score({ pub, submissions, players }) {
    const counts = countChoices(submissions, pub.options.length);
    const top = majorityIndexes(counts);
    const byId = new Map(players.map((p) => [p.playerId, p]));
    const picks: MajorityReveal["picks"] = [];
    const points: Record<string, number> = {};
    const feedback: Record<string, { correct: boolean | null; detail: string | null }> = {};
    for (const s of submissions) {
      const choice = (s.answer as { choice: number }).choice;
      const player = byId.get(s.playerId);
      if (player) picks.push({ ...player, choice });
      const withCrowd = top.includes(choice);
      points[s.playerId] = withCrowd ? MAJORITY_POINTS : 0;
      feedback[s.playerId] = { correct: withCrowd, detail: withCrowd ? "You think like the crowd!" : `Most picked: ${top.map((i) => pub.options[i]).join(" / ")}` };
    }
    for (const p of players) feedback[p.playerId] ??= { correct: false, detail: "No answer" };
    const reveal: MajorityReveal = { counts, majority: top, picks };
    return { points, feedback, reveal };
  },
};
