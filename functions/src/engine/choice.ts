import { fail } from "../lib/errors";

/** Validate a multiple-choice answer `{ choice: number }` against the option count. */
export function validateChoice(answer: unknown, optionCount: number): { choice: number } {
  const choice = (answer as { choice?: unknown } | null)?.choice;
  if (typeof choice !== "number" || !Number.isInteger(choice) || choice < 0 || choice >= optionCount) {
    fail("invalid-argument", "Pick one of the options.");
  }
  return { choice };
}

export function countChoices(submissions: { answer: unknown }[], optionCount: number): number[] {
  const counts = Array.from({ length: optionCount }, () => 0);
  for (const s of submissions) {
    const c = (s.answer as { choice: number }).choice;
    if (c >= 0 && c < optionCount) counts[c]++;
  }
  return counts;
}
