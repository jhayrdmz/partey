import type { ChoiceQuestion, SpeedQuizReveal } from "../../../shared/engine";
import { speedQuizSettings, type SpeedQuizSettings } from "../../../shared/gameSettings";
import type { GameHandler } from "../engine/types";
import { countChoices, validateChoice } from "../engine/choice";
import { pickFresh, shuffle } from "../engine/random";
import { QUIZ, type QuizItem } from "./speedQuizContent";

const BASE_POINTS = 500;
const SPEED_BONUS = 500;
/** Untimed questions: the speed bonus runs out over this window instead of the answer time. */
const UNTIMED_BONUS_WINDOW_MS = 30_000;

interface Setup {
  items: { item: QuizItem; order: number[] }[];
  /** 0 = no time limit. Missing in games started before options existed (they used 15s). */
  questionMs?: number;
}

/**
 * Correct answers earn 500 + up to 500 speed bonus, linear in time remaining.
 * Untimed questions (durationMs 0) measure speed against a 30s window.
 */
export function speedQuizPoints(elapsedMs: number, durationMs: number): number {
  const window = durationMs > 0 ? durationMs : UNTIMED_BONUS_WINDOW_MS;
  const remaining = Math.max(0, Math.min(1, 1 - elapsedMs / window));
  return BASE_POINTS + Math.round(SPEED_BONUS * remaining);
}

export const speedQuiz: GameHandler<Setup, ChoiceQuestion, { correctIndex: number }> = {
  id: "speed-quiz",
  introMs: 10_000,
  revealMs: 7_000,
  setup(_players, used, settings) {
    const options = speedQuizSettings(settings as Partial<SpeedQuizSettings> | undefined);
    const items = pickFresh(QUIZ, options.rounds, used).map((item) => ({ item, order: shuffle([0, 1, 2, 3]) }));
    return { setup: { items, questionMs: options.questionSeconds * 1000 }, rounds: items.length, contentIds: items.map((i) => i.item.id) };
  },
  openRound(setup, round) {
    const { item, order } = setup.items[round - 1];
    return {
      public: { prompt: item.prompt, options: order.map((i) => item.options[i]), category: item.category },
      secret: { correctIndex: order.indexOf(item.answer) },
      durationMs: setup.questionMs ?? 15_000,
    };
  },
  validate(answer, pub) {
    return validateChoice(answer, pub.options.length);
  },
  score({ pub, secret, submissions, players, openedAtMs, durationMs }) {
    const byId = new Map(players.map((p) => [p.playerId, p]));
    const points: Record<string, number> = {};
    const feedback: Record<string, { correct: boolean | null; detail: string | null }> = {};
    const fastest: SpeedQuizReveal["fastest"] = [];
    for (const s of submissions) {
      const correct = (s.answer as { choice: number }).choice === secret.correctIndex;
      const ms = Math.max(0, s.submittedAtMs - openedAtMs);
      const p = correct ? speedQuizPoints(ms, durationMs) : 0;
      points[s.playerId] = p;
      feedback[s.playerId] = { correct, detail: correct ? `${(ms / 1000).toFixed(1)}s` : `Answer: ${pub.options[secret.correctIndex]}` };
      const player = byId.get(s.playerId);
      if (correct && player) fastest.push({ ...player, ms, points: p });
    }
    for (const p of players) feedback[p.playerId] ??= { correct: false, detail: "No answer" };
    fastest.sort((a, b) => a.ms - b.ms);
    const reveal: SpeedQuizReveal = { correctIndex: secret.correctIndex, counts: countChoices(submissions, pub.options.length), fastest: fastest.slice(0, 5) };
    return { points, feedback, reveal };
  },
};
