/**
 * Draw & Guess live strokes, in the Realtime Database (low latency, small deltas):
 *
 *   drawings/{roomId}/access              { artistId, key }   server-written; who may draw, and where
 *   drawings/{roomId}/readers/{uid}       true                server-written; host, displays, the artist
 *   drawings/{roomId}/strokes/{key}/{id}  Stroke              written only by the current artist
 *
 * `key` is the round's DrawRound.drawingKey. A stroke's points arrive in chunks while it's drawn
 * (`p/0`, `p/1`, …), so every write and every listener update carries only the new points.
 * The whole canvas image is never sent.
 */

/** Strokes use a square coordinate space: integers 0…DRAW_SIZE on both axes. */
export const DRAW_SIZE = 1000;

export const drawingPath = (roomId: string) => `drawings/${roomId}`;
export const accessPath = (roomId: string) => `drawings/${roomId}/access`;
export const strokesPath = (roomId: string, key: string) => `drawings/${roomId}/strokes/${key}`;

/** Stored stroke (RTDB). Keys are short: they're sent with every chunk. */
export interface StrokeDoc {
  /** Color, #rrggbb. */
  c: string;
  /** Width in DRAW_SIZE units. */
  w: number;
  /** Eraser. */
  e?: boolean;
  /** Point chunks in order, each "x,y,x,y,…". */
  p?: Record<string, string>;
}

export interface DrawAccess {
  artistId: string | null;
  key: string | null;
}

/** Stay in sync with database.rules.json. */
export const STROKE_LIMITS = {
  minWidth: 1,
  maxWidth: 120,
  /** Characters per chunk. */
  maxChunk: 2400,
} as const;

/**
 * Draw & Guess scoring. Correct guesses by order: 1st, 2nd, 3rd, 4th, then `rest` for everyone
 * after. The artist gets `artistBonus` when at least one player guesses right. Adjust freely:
 * the server scores with this table and phones show their estimate from it.
 */
export const DRAW_POINTS = {
  byOrder: [100, 80, 60, 40],
  rest: 20,
  artistBonus: 50,
} as const;

/** Points for the n-th correct guess (0-based). */
export function guessPoints(order: number): number {
  return DRAW_POINTS.byOrder[order] ?? DRAW_POINTS.rest;
}
