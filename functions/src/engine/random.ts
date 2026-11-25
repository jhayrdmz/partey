import { randomInt } from "node:crypto";

export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick `n` items, preferring ones whose id isn't in `used`. */
export function pickFresh<T extends { id: string }>(items: readonly T[], n: number, used: ReadonlySet<string>): T[] {
  const fresh = shuffle(items.filter((i) => !used.has(i.id)));
  const stale = shuffle(items.filter((i) => used.has(i.id)));
  return [...fresh, ...stale].slice(0, n);
}

export function randomBetween(min: number, max: number): number {
  return randomInt(min, max + 1);
}
