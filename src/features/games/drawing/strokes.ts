/**
 * Live strokes for Draw & Guess over the Realtime Database (layout in shared/drawing.ts).
 * The artist streams each stroke as small point chunks; viewers rebuild only the stroke that changed.
 */
import { child, get, onChildAdded, onChildChanged, onChildRemoved, onValue, push, ref, remove, set, type DatabaseReference } from "firebase/database";
import { DRAW_SIZE, STROKE_LIMITS, accessPath, strokesPath, type DrawAccess, type StrokeDoc } from "@shared/drawing";
import { firebase } from "@/services/firebase";

export interface Stroke {
  id: string;
  color: string;
  /** DRAW_SIZE units. */
  width: number;
  eraser: boolean;
  /** Flat x, y pairs in DRAW_SIZE units. */
  points: number[];
}

const db = () => firebase().database;

function parse(id: string, doc: StrokeDoc | null): Stroke | null {
  if (!doc || typeof doc.c !== "string" || typeof doc.w !== "number") return null;
  const chunks = Object.entries(doc.p ?? {}).sort((a, b) => Number(a[0]) - Number(b[0]));
  const points: number[] = [];
  for (const [, chunk] of chunks) {
    if (!chunk) continue;
    for (const n of chunk.split(",")) points.push(Number(n));
  }
  return { id, color: doc.c, width: doc.w, eraser: doc.e === true, points };
}

/**
 * Watch a round's strokes. Calls `onChange` with the full ordered list after each update.
 * Retries when access is refused: the server grants it a moment after the round opens.
 */
export function watchStrokes(roomId: string, key: string, onChange: (strokes: Stroke[]) => void): () => void {
  const strokes = new Map<string, Stroke>();
  let stopped = false;
  let retry: number | undefined;
  let unsubs: (() => void)[] = [];
  let queued = false;
  // Batch bursts of child events into one update per frame.
  const emit = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (!stopped) onChange([...strokes.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
    });
  };
  const start = () => {
    const node = ref(db(), strokesPath(roomId, key));
    const upsert = (snap: { key: string | null; val: () => unknown }) => {
      const s = snap.key ? parse(snap.key, snap.val() as StrokeDoc) : null;
      if (s) strokes.set(s.id, s);
      emit();
    };
    const onError = () => {
      unsubs.forEach((u) => u());
      unsubs = [];
      if (!stopped) retry = window.setTimeout(start, 1500);
    };
    unsubs = [
      onChildAdded(node, upsert, onError),
      onChildChanged(node, upsert, onError),
      onChildRemoved(node, (snap) => {
        if (snap.key) strokes.delete(snap.key);
        emit();
      }, onError),
    ];
  };
  start();
  emit();
  return () => {
    stopped = true;
    window.clearTimeout(retry);
    unsubs.forEach((u) => u());
  };
}

/** Who may draw right now, and where (server-written). */
export function watchAccess(roomId: string, onChange: (access: DrawAccess | null) => void): () => void {
  return onValue(
    ref(db(), accessPath(roomId)),
    (snap) => onChange(snap.val() as DrawAccess | null),
    () => onChange(null),
  );
}

/** One-shot read of a round's strokes (the artist restoring after a reload). */
export async function loadStrokes(roomId: string, key: string): Promise<Stroke[]> {
  const snap = await get(ref(db(), strokesPath(roomId, key)));
  const val = (snap.val() ?? {}) as Record<string, StrokeDoc>;
  return Object.keys(val)
    .sort()
    .map((id) => parse(id, val[id]))
    .filter((s): s is Stroke => s !== null);
}

/** Points are sent this often while a stroke is being drawn. */
const FLUSH_MS = 50;

/**
 * The artist's side: streams strokes as they're drawn. Writes the database rejects (time's up,
 * a paused game) are dropped silently; the server is the judge of who may draw.
 */
export class StrokeWriter {
  private node: DatabaseReference;
  private current: { ref: DatabaseReference; pending: number[]; chunk: number } | null = null;
  private timer: number | undefined;

  constructor(roomId: string, key: string) {
    this.node = ref(db(), strokesPath(roomId, key));
  }

  /** Start a stroke at (x, y); returns its id. */
  begin(stroke: { color: string; width: number; eraser: boolean }, x: number, y: number): string {
    this.end();
    const strokeRef = push(this.node);
    const doc: StrokeDoc = { c: stroke.color, w: stroke.width, p: { 0: `${x},${y}` } };
    if (stroke.eraser) doc.e = true;
    set(strokeRef, doc).catch(() => undefined);
    this.current = { ref: strokeRef, pending: [], chunk: 1 };
    return strokeRef.key!;
  }

  add(x: number, y: number) {
    if (!this.current) return;
    this.current.pending.push(x, y);
    this.timer ??= window.setTimeout(() => this.flush(), FLUSH_MS);
  }

  end() {
    this.flush();
    this.current = null;
  }

  undo(id: string) {
    remove(child(this.node, id)).catch(() => undefined);
  }

  clear() {
    this.end();
    remove(this.node).catch(() => undefined);
  }

  private flush() {
    window.clearTimeout(this.timer);
    this.timer = undefined;
    const cur = this.current;
    if (!cur || cur.pending.length === 0) return;
    // Split so each chunk stays under the database's size limit.
    while (cur.pending.length) {
      let text = "";
      let used = 0;
      while (used < cur.pending.length) {
        const next = `${text ? "," : ""}${cur.pending[used]},${cur.pending[used + 1]}`;
        if (text.length + next.length > STROKE_LIMITS.maxChunk) break;
        text += next;
        used += 2;
      }
      cur.pending.splice(0, used);
      set(child(cur.ref, `p/${cur.chunk++}`), text).catch(() => undefined);
    }
  }
}

/* ─── Rendering ──────────────────────────────────────────────────────── */

/** Paint strokes onto a square canvas `px` pixels wide (white background comes from CSS). */
export function paintStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], px: number) {
  const s = px / DRAW_SIZE;
  ctx.clearRect(0, 0, px, px);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    const p = stroke.points;
    if (p.length < 2) continue;
    ctx.globalCompositeOperation = stroke.eraser ? "destination-out" : "source-over";
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = stroke.width * s;
    if (p.length === 2) {
      ctx.beginPath();
      ctx.arc(p[0] * s, p[1] * s, (stroke.width * s) / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    // Smooth through the midpoints between samples.
    ctx.beginPath();
    ctx.moveTo(p[0] * s, p[1] * s);
    for (let i = 2; i < p.length - 2; i += 2) {
      const mx = ((p[i] + p[i + 2]) / 2) * s;
      const my = ((p[i + 1] + p[i + 3]) / 2) * s;
      ctx.quadraticCurveTo(p[i] * s, p[i + 1] * s, mx, my);
    }
    ctx.lineTo(p[p.length - 2] * s, p[p.length - 1] * s);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
}
