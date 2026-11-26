/** Draw & Guess pieces: canvas, artist tools, guess pad, display and host panels (assembled in views.tsx). */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Eraser, Hand, Lightbulb, Loader2, Paintbrush, Pencil, Send, Trash2, TriangleAlert, Undo2, X } from "lucide-react";
import { Popover } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";
import { DRAW_SIZE, guessPoints, DRAW_POINTS, type DrawAccess } from "@shared/drawing";
import type { DrawReveal, DrawRound, DrawSecret, PlayerPick, PublicGameState, SubmitAnswerResponse } from "@shared/engine";
import { DRAW_CATEGORY_LABELS } from "@shared/gameSettings";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import { BottomBar } from "@/components/shared/BottomBar";
import { KeyboardDockedBar } from "@/components/shared/KeyboardDockedBar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useServerCountdown } from "@/hooks/useServerClock";
import { cn } from "@/utils/cn";
import { playSound } from "@/utils/sound";
import { StrokeWriter, loadStrokes, paintStrokes, watchAccess, watchStrokes, type Stroke } from "./strokes";

/* ─── Canvas ─────────────────────────────────────────────────────────── */

/**
 * A square, white drawing surface. Repaints on the next frame whenever `version` changes, at the
 * device's pixel density. Pointer handlers make it a drawing surface (touch, mouse and stylus).
 */
export function StrokeCanvas({
  strokes,
  version,
  className,
  children,
  handlers,
  label,
  style,
}: {
  strokes: Stroke[];
  version: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  handlers?: Pick<React.ComponentProps<"canvas">, "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onLostPointerCapture">;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [px, setPx] = useState(0);
  const latest = useRef(strokes);
  latest.current = strokes;

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const size = Math.round(canvas.clientWidth * Math.min(3, window.devicePixelRatio || 1));
      if (size > 0 && canvas.width !== size) {
        canvas.width = size;
        canvas.height = size;
      }
      setPx(size);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !px) return;
    const frame = requestAnimationFrame(() => paintStrokes(ctx, latest.current, px));
    return () => cancelAnimationFrame(frame);
  }, [version, px, strokes]);

  return (
    <div className={cn("relative aspect-square overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/10", className)} style={style}>
      <canvas ref={canvasRef} role="img" aria-label={label} className={cn("block size-full", handlers && "cursor-crosshair touch-none select-none")} {...handlers} />
      {children}
    </div>
  );
}

/** Someone else's drawing, live from the Realtime Database (display, host, reveal). */
export function LiveDrawing({ roomId, drawingKey, className, label = "The drawing" }: { roomId: string; drawingKey: string; className?: string; label?: string }) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [version, setVersion] = useState(0);
  // Callers key this by drawingKey, so a new round starts from a fresh, empty canvas.
  useEffect(() => {
    return watchStrokes(roomId, drawingKey, (s) => {
      setStrokes(s);
      setVersion((v) => v + 1);
    });
  }, [roomId, drawingKey]);
  return <StrokeCanvas strokes={strokes} version={version} className={className} label={label} />;
}

/* ─── Shared bits ────────────────────────────────────────────────────── */

/**
 * "_ _ _ _   _ _ _": the prompt's shape, plus any letters revealed as hints. Never more than the
 * server has published.
 */
export function WordHint({ hint, revealed = [], className }: { hint: number[]; revealed?: DrawRound["revealed"]; className?: string }) {
  const shown = new Map(revealed.map((r) => [r.index, r.letter]));
  // Letter indexes run across words: word w starts after the letters of the words before it.
  const words = hint.map((n, w) => {
    const start = hint.slice(0, w).reduce((a, b) => a + b, 0);
    return Array.from({ length: n }, (_, i) => shown.get(start + i) ?? null);
  });
  const pattern = words.map((w) => w.map((ch) => ch ?? "_").join(" ")).join("   ");
  return (
    <div role="img" className={cn("flex flex-wrap justify-center gap-x-[0.9em] gap-y-2", className)} aria-label={`Hint: ${pattern}`}>
      {words.map((letters, w) => (
        <span key={w} className="flex gap-[0.25em]" aria-hidden>
          {letters.map((ch, i) => (
            <span key={i} className="inline-flex w-[0.8em] justify-center border-b-[0.12em] border-current leading-none">
              {ch ? (
                <motion.span initial={{ scale: 0.2, opacity: 0, y: -8 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 320, damping: 14 }} className="text-mango uppercase">
                  {ch}
                </motion.span>
              ) : (
                <>&nbsp;</>
              )}
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}

/** "💡 Letter hint in 12s" while more hints are coming. */
function NextHint({ game, className }: { game: PublicGameState; className?: string }) {
  const left = useServerCountdown(game.eventAtMs ?? null, { tickMs: 250 });
  if (!game.eventAtMs || game.paused || left === null) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-semibold text-muted-foreground tabular-nums", className)}>
      <Lightbulb className="size-[1.1em] text-mango" /> Letter hint in {Math.max(1, Math.ceil(left / 1000))}s
    </span>
  );
}

export function CategoryChip({ category, className }: { category: DrawRound["category"]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 font-bold text-muted-foreground", className)}>
      Category · <span className="text-foreground">{DRAW_CATEGORY_LABELS[category]}</span>
    </span>
  );
}

const sortedAnswerers = (game: PublicGameState) => [...(game.answeredBy ?? [])].sort((a, b) => a.atMs - b.atMs || a.playerId.localeCompare(b.playerId));

/* ─── Phone: artist ──────────────────────────────────────────────────── */

const COLORS = ["#111111", "#6b7280", "#ffffff", "#ef4444", "#f97316", "#facc15", "#22c55e", "#0ea5e9", "#2563eb", "#8b5cf6", "#ec4899", "#92400e"] as const;
const COLOR_NAMES: Record<(typeof COLORS)[number], string> = {
  "#111111": "Black", "#6b7280": "Gray", "#ffffff": "White", "#ef4444": "Red", "#f97316": "Orange", "#facc15": "Yellow",
  "#22c55e": "Green", "#0ea5e9": "Light blue", "#2563eb": "Blue", "#8b5cf6": "Purple", "#ec4899": "Pink", "#92400e": "Brown",
};
/** Brush widths in DRAW_SIZE units (a 1000-wide canvas). */
const SIZES = [{ w: 6, label: "Fine" }, { w: 14, label: "Medium" }, { w: 28, label: "Thick" }, { w: 56, label: "Huge" }] as const;
/** Skip samples closer than this (DRAW_SIZE units): smooth lines, fewer bytes. */
const MIN_STEP = 3;

/** Side of the largest square that fits the measured box (re-measured on resize / rotation). */
function useSquareFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSide(Math.floor(Math.min(el.clientWidth, el.clientHeight)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, side };
}

/** Every toolbar button: same size and shape, sharing the row equally. */
const TOOL = "h-12 min-w-0 flex-1 rounded-md";

/** One pencil button for the brush size; tap it for a pop-up of sizes. */
function StrokePicker({ width, color, eraser, onPick }: { width: number; color: string; eraser: boolean; onPick: (w: number) => void }) {
  const [open, setOpen] = useState(false);
  const current = SIZES.find((s) => s.w === width) ?? SIZES[1];
  const ink = eraser ? "#d4d4d4" : color === "#ffffff" ? "#d4d4d4" : color;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Brush size: ${current.label}`}
          className={cn(TOOL, "relative grid place-items-center border-2 bg-secondary/60", open ? "border-primary" : "border-transparent")}
        >
          <Pencil className="size-5 text-white" />
          {/* The current thickness, under the pencil. */}
          <span className="absolute bottom-1.5 left-1/2 w-5 -translate-x-1/2 rounded-full" style={{ height: Math.max(2, Math.min(6, current.w / 9)), backgroundColor: ink }} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" align="center" sideOffset={8} collisionPadding={12} className="z-50 w-56 rounded-2xl border bg-popover p-2 shadow-xl">
          <div role="radiogroup" aria-label="Brush size" className="grid gap-1">
            {SIZES.map((s) => {
              const selected = width === s.w;
              return (
                <button
                  key={s.w}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${s.label} brush`}
                  onClick={() => {
                    onPick(s.w);
                    setOpen(false);
                  }}
                  className={cn("flex h-12 items-center gap-3 rounded-md border-2 px-3 text-left text-sm font-bold", selected ? "border-primary bg-primary/15" : "border-transparent hover:bg-secondary/60")}
                >
                  <Pencil className="size-4 shrink-0 text-white" />
                  <span className="flex-1">{s.label}</span>
                  <span className="w-16 rounded-full" style={{ height: Math.max(2, s.w / 2.6), backgroundColor: ink }} />
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** One button showing the current colour; tap it for a pop-up palette. */
function ColorPicker({ color, eraser, onPick }: { color: string; eraser: boolean; onPick: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const name = COLOR_NAMES[color as (typeof COLORS)[number]] ?? "Custom";
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Brush color: ${name}`}
          className={cn(TOOL, "grid place-items-center border-2 bg-secondary/60", open ? "border-primary" : "border-transparent")}
        >
          <span className={cn("size-7 rounded-full ring-2 ring-white/70", eraser && "opacity-40")} style={{ backgroundColor: color }} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" align="start" sideOffset={8} collisionPadding={12} className="z-50 rounded-2xl border bg-popover p-2.5 shadow-xl">
          <div role="radiogroup" aria-label="Brush color" className="grid grid-cols-4 gap-2">
            {COLORS.map((c) => {
              const selected = !eraser && color === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={COLOR_NAMES[c]}
                  onClick={() => {
                    onPick(c);
                    setOpen(false);
                  }}
                  className={cn("grid size-12 place-items-center rounded-md border-2", selected ? "border-foreground ring-2 ring-primary" : "border-white/20")}
                  style={{ backgroundColor: c }}
                >
                  {selected && <Check className={cn("size-5", c === "#ffffff" || c === "#facc15" ? "text-neutral-900" : "text-white")} />}
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The artist's private prompt card. */
export function PromptCard({ secret }: { secret: Extract<DrawSecret, { role: "artist" }> }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-mango/30 to-guava/30 px-4 py-2.5">
      <Paintbrush className="size-6 shrink-0 text-mango" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Draw this · {DRAW_CATEGORY_LABELS[secret.category]}</p>
        <p className="truncate text-2xl leading-tight font-black">{secret.word}</p>
      </div>
    </div>
  );
}

/**
 * The artist's canvas and tools. Strokes are drawn locally at once and streamed to the big screen
 * as they're drawn. Drawing unlocks when the server grants access for this round, and stops when
 * time runs out or the game is paused.
 */
export function ArtistBoard({ roomId, uid, game, pub, secret }: { roomId: string; uid: string; game: PublicGameState; pub: DrawRound; secret: Extract<DrawSecret, { role: "artist" }> }) {
  const [color, setColor] = useState<string>(COLORS[0]);
  const [width, setWidth] = useState<number>(SIZES[1].w);
  const [eraser, setEraser] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [access, setAccess] = useState<DrawAccess | null>(null);
  const strokes = useRef<Stroke[]>([]);
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);
  const writer = useRef<StrokeWriter | null>(null);
  const active = useRef<{ pointerId: number; stroke: Stroke } | null>(null);
  const left = useServerCountdown(game.phaseEndsAtMs, { paused: game.paused, pausedRemainingMs: game.remainingMs });
  const timeUp = !game.paused && left !== null && left <= 0;
  const granted = access?.artistId === uid && access.key === pub.drawingKey;
  const canDraw = granted && !game.paused && !timeUp;

  useEffect(() => watchAccess(roomId, setAccess), [roomId]);

  // One writer per round; restore anything already drawn (e.g. after a reload).
  useEffect(() => {
    writer.current = new StrokeWriter(roomId, pub.drawingKey);
    strokes.current = [];
    bump();
    let live = true;
    loadStrokes(roomId, pub.drawingKey)
      .then((saved) => {
        if (live && saved.length && strokes.current.length === 0) {
          strokes.current = saved;
          bump();
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
      writer.current?.end();
    };
  }, [roomId, pub.drawingKey]);

  useEffect(() => {
    playSound("pop");
    if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
  }, []);

  // Lift the pen when drawing stops being allowed mid-stroke.
  useEffect(() => {
    if (!canDraw && active.current) {
      writer.current?.end();
      active.current = null;
    }
  }, [canDraw]);

  const point = (e: { clientX: number; clientY: number }, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const clamp = (n: number) => Math.max(0, Math.min(DRAW_SIZE, Math.round(n)));
    return [clamp(((e.clientX - r.left) / r.width) * DRAW_SIZE), clamp(((e.clientY - r.top) / r.height) * DRAW_SIZE)] as const;
  };

  const handlers: React.ComponentProps<typeof StrokeCanvas>["handlers"] = {
    onPointerDown: (e) => {
      if (!canDraw || active.current || !writer.current) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const [x, y] = point(e, e.currentTarget);
      const style = { color: eraser ? "#000000" : color, width: eraser ? Math.max(width, 20) : width, eraser };
      const id = writer.current.begin(style, x, y);
      const stroke: Stroke = { id, ...style, points: [x, y] };
      strokes.current = [...strokes.current, stroke];
      active.current = { pointerId: e.pointerId, stroke };
      bump();
    },
    onPointerMove: (e) => {
      const cur = active.current;
      if (!cur || cur.pointerId !== e.pointerId || !writer.current) return;
      const samples = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
      const p = cur.stroke.points;
      let moved = false;
      for (const s of samples.length ? samples : [e.nativeEvent]) {
        const [x, y] = point(s, e.currentTarget);
        const dx = x - p[p.length - 2];
        const dy = y - p[p.length - 1];
        if (dx * dx + dy * dy < MIN_STEP * MIN_STEP) continue;
        p.push(x, y);
        writer.current.add(x, y);
        moved = true;
      }
      if (moved) bump();
    },
    onPointerUp: (e) => {
      if (active.current?.pointerId !== e.pointerId) return;
      writer.current?.end();
      active.current = null;
    },
    onPointerCancel: (e) => {
      if (active.current?.pointerId !== e.pointerId) return;
      writer.current?.end();
      active.current = null;
    },
  };

  const undo = () => {
    const last = strokes.current[strokes.current.length - 1];
    if (!last || !writer.current) return;
    if (active.current?.stroke.id === last.id) {
      writer.current.end();
      active.current = null;
    }
    writer.current.undo(last.id);
    strokes.current = strokes.current.slice(0, -1);
    bump();
  };
  const reset = () => {
    setConfirmReset(false);
    writer.current?.clear();
    active.current = null;
    strokes.current = [];
    bump();
  };
  const empty = strokes.current.length === 0;
  const { ref: fitRef, side } = useSquareFit();

  return (
    // Fills the phone exactly: the canvas takes whatever height is left, the tools stay pinned at the bottom.
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <PromptCard secret={secret} />
      {/* The square canvas fits both the width and the height left over. */}
      <div ref={fitRef} className="relative grid min-h-0 flex-1 place-items-center">
        <StrokeCanvas strokes={strokes.current} version={version} handlers={handlers} label="Your drawing" className={cn("absolute", !side && "invisible")} style={side ? { width: side, height: side } : undefined}>
          {!granted && !timeUp && (
            <div className="absolute inset-0 grid place-items-center bg-white/70 text-neutral-700">
              <span className="flex items-center gap-2 font-bold">
                <Loader2 className="size-5 animate-spin" /> Getting your canvas ready…
              </span>
            </div>
          )}
          <AnimatePresence>
            {timeUp && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 grid place-items-center bg-white/75 text-neutral-900">
                <span className="flex flex-col items-center gap-1">
                  <Hand className="size-12 text-guava" />
                  <span className="text-3xl font-black">Time's up!</span>
                  <span className="text-sm font-semibold text-neutral-600">Pencils down</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          {empty && canDraw && <p className="pointer-events-none absolute inset-x-0 top-3 text-center text-sm font-semibold text-neutral-400">Draw here with your finger</p>}
        </StrokeCanvas>
      </div>

      <BottomBar always className="mt-0 space-y-2 pt-2.5 sm:-mx-4 sm:px-4">
        <div className="flex items-center gap-1.5">
          <ColorPicker color={color} eraser={eraser} onPick={(c) => { setColor(c); setEraser(false); }} />
          <StrokePicker width={width} color={color} eraser={eraser} onPick={setWidth} />
          <Button type="button" size="icon" variant={eraser ? "accent" : "secondary"} className={TOOL} aria-pressed={eraser} aria-label="Eraser" onClick={() => setEraser((v) => !v)}>
            <Eraser />
          </Button>
          <Button type="button" size="icon" variant="secondary" className={TOOL} aria-label="Reset board" onClick={() => setConfirmReset(true)} disabled={empty || !canDraw}>
            <Trash2 />
          </Button>
          <Button type="button" size="icon" variant="secondary" className={TOOL} aria-label="Undo" onClick={undo} disabled={empty || !canDraw}>
            <Undo2 />
          </Button>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-warning">
          <TriangleAlert className="size-3.5 shrink-0" />
          No letters or numbers! It shows live on the big screen.
        </p>
      </BottomBar>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset the board?</DialogTitle>
            <DialogDescription>This erases your whole drawing, on the big screen too. It can't be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>
              Keep drawing
            </Button>
            <Button variant="destructive" onClick={reset} disabled={!canDraw}>
              <Trash2 /> Reset board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Phone: guesser ─────────────────────────────────────────────────── */

interface Attempt {
  text: string;
  close: boolean;
}

/** Guess as often as you like until you get it (or time runs out). The artist never sees guesses. */
export function GuessPad({ game, pub, submit, submitting, paused }: { game: PublicGameState; pub: DrawRound; submit: (a: unknown) => Promise<SubmitAnswerResponse | null>; submitting: boolean; paused: boolean }) {
  const [text, setText] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const guess = text.replace(/\s+/g, " ").trim();
  const last = attempts[0];

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!guess || submitting || paused) return;
    setText("");
    inputRef.current?.focus();
    const res = await submit({ guess });
    if (res?.correct === false) {
      setAttempts((a) => [{ text: guess, close: res.close === true }, ...a].slice(0, 6));
      if (navigator.vibrate) navigator.vibrate(res.close ? [30, 30, 30] : 60);
    }
  }

  return (
    <form className="flex flex-1 flex-col gap-3" onSubmit={send}>
      <div className="flex flex-col items-center gap-2 rounded-3xl bg-card/60 px-4 py-4 text-center">
        <span className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <AvatarBubble avatar={pub.artist.avatar} size="xs" /> {pub.artist.nickname} is drawing
        </span>
        <WordHint hint={pub.hint} revealed={pub.revealed} className="text-2xl font-black" />
        <CategoryChip category={pub.category} className="text-xs" />
        <NextHint game={game} className="text-xs" />
        <p className="text-sm text-muted-foreground">Watch the big screen and guess!</p>
      </div>

      <div>
        <input
          ref={inputRef}
          aria-label="Your guess"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={40}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="send"
          placeholder={paused ? "Paused…" : "Type your guess…"}
          disabled={paused}
          className="h-14 w-full rounded-md border-2 border-input bg-background/60 px-4 text-xl font-bold outline-none focus:border-primary"
        />
      </div>

      <AnimatePresence mode="popLayout">
        {last && (
          <motion.p
            key={attempts.length}
            initial={{ x: -12, opacity: 0 }}
            animate={{ x: [12, -8, 4, 0], opacity: 1 }}
            transition={{ duration: 0.35 }}
            role="status"
            className={cn("flex items-center justify-center gap-2 text-center text-lg font-extrabold", last.close ? "text-mango" : "text-guava")}
          >
            {last.close ? <Lightbulb className="size-5" /> : <X className="size-5" />}
            {last.close ? `So close! “${last.text}” isn't quite it` : `“${last.text}” isn't it. Keep guessing!`}
          </motion.p>
        )}
      </AnimatePresence>
      {attempts.length > 1 && (
        <ul className="flex flex-wrap justify-center gap-1.5" aria-label="Your wrong guesses">
          {attempts.slice(1).map((a, i) => (
            <li key={`${a.text}-${i}`} className="rounded-full bg-secondary/70 px-2.5 py-0.5 text-sm text-muted-foreground line-through">
              {a.text}
            </li>
          ))}
        </ul>
      )}

      {/* Pinned to the bottom of the screen, or right above the keyboard while typing. */}
      <KeyboardDockedBar>
        <Button
          type="submit"
          size="xl"
          variant="party"
          className="w-full"
          disabled={!guess || submitting || paused}
          aria-label="Submit guess"
          // Keep the keyboard open: tapping the button mustn't blur the input first.
          onPointerDown={(e) => e.preventDefault()}
        >
          {submitting ? <Loader2 className="animate-spin" /> : <Send />} Guess
        </Button>
      </KeyboardDockedBar>
    </form>
  );
}

/** Shown once you've guessed right: you can't guess again this round. */
export function Guessed({ game, uid }: { game: PublicGameState; uid: string }) {
  const order = sortedAnswerers(game).findIndex((a) => a.playerId === uid);
  useEffect(() => {
    playSound("win");
    if (navigator.vibrate) navigator.vibrate([40, 30, 80]);
  }, []);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl bg-card/60 p-6 text-center">
      <motion.span initial={{ scale: 0.3, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 220, damping: 12 }} className="grid size-24 place-items-center rounded-full bg-success/20">
        <Check className="size-14 text-success" />
      </motion.span>
      <p className="text-3xl font-black">You got it!</p>
      {order >= 0 && (
        <p className="text-lg font-bold">
          {ordinal(order + 1)} to guess · <span className="text-mango">+{guessPoints(order)}</span>
        </p>
      )}
      <p className="text-muted-foreground">Shh, don't say it out loud! Watch the others try.</p>
    </div>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/* ─── Display ────────────────────────────────────────────────────────── */

/** Names of correct guessers so far (never their guesses). */
function GuessedList({ players, size = "lg" }: { players: (PlayerPick & { points?: number; ms?: number })[]; size?: "md" | "lg" }) {
  return (
    <ol className={cn("grid gap-2", size === "lg" ? "lg:gap-3" : "")}>
      <AnimatePresence initial={false}>
        {players.map((p, i) => (
          <motion.li
            key={p.playerId}
            layout
            initial={{ x: 40, opacity: 0, scale: 0.9 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className={cn("glass flex min-w-0 items-center gap-3 rounded-2xl border border-success/40 px-3 py-2", size === "lg" && "lg:px-4 lg:py-3")}
          >
            <span className={cn("w-7 text-center font-black text-muted-foreground tabular-nums", size === "lg" && "lg:text-2xl")}>{i + 1}</span>
            <AvatarBubble avatar={p.avatar} size="sm" />
            <span className={cn("min-w-0 flex-1 truncate font-extrabold", size === "lg" ? "text-xl lg:text-3xl" : "text-lg")}>{p.nickname}</span>
            {p.points !== undefined ? (
              <span className={cn("font-black text-mango tabular-nums", size === "lg" ? "text-xl lg:text-3xl" : "text-lg")}>+{p.points}</span>
            ) : (
              <Check className="size-6 text-success lg:size-8" />
            )}
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

/** Canvas side on the display: as big as the screen height allows. */
const DISPLAY_CANVAS = "w-[min(100%,calc(100dvh-10rem))] lg:w-[min(100%,calc(100dvh-13.5rem))] short:w-[min(100%,calc(100dvh-7rem))]";
/** Leaves room for the "Top scores" strip that slides in under the reveal. */
const REVEAL_CANVAS = "w-[min(100%,calc(100dvh-15rem))] lg:w-[min(100%,calc(100dvh-19.5rem))] short:w-[min(100%,calc(100dvh-10rem))]";

export function DisplayDrawing({ game, roomId }: { game: PublicGameState; roomId: string }) {
  const pub = game.round_data as DrawRound;
  const guessed = sortedAnswerers(game);
  const prevCount = useRef(guessed.length);
  useEffect(() => {
    if (guessed.length > prevCount.current) playSound("pop");
    prevCount.current = guessed.length;
  }, [guessed.length]);
  const everyone = game.eligible > 0 && guessed.length >= game.eligible;

  return (
    <div className="flex flex-1 flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6 lg:gap-10">
      <LiveDrawing key={pub.drawingKey} roomId={roomId} drawingKey={pub.drawingKey} className={cn("shrink-0", DISPLAY_CANVAS)} label={`${pub.artist.nickname}'s drawing`} />
      <div className="flex w-full min-w-0 flex-1 flex-col gap-4 lg:gap-6">
        <div className="flex items-center gap-3 lg:gap-4">
          <AvatarBubble avatar={pub.artist.avatar} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-3xl leading-none font-black lg:text-5xl">{pub.artist.nickname}</p>
            <p className="mt-1 flex items-center gap-2 text-lg font-bold text-mango lg:text-2xl">
              <Paintbrush className="size-5 lg:size-7" /> is drawing…
            </p>
          </div>
        </div>
        <div className="glass flex flex-col items-center gap-3 rounded-3xl border px-4 py-4 lg:py-6">
          <WordHint hint={pub.hint} revealed={pub.revealed} className="text-3xl font-black lg:text-5xl" />
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <CategoryChip category={pub.category} className="text-base lg:text-xl" />
            <NextHint game={game} className="text-base lg:text-xl" />
          </div>
        </div>
        <div className="min-h-0 space-y-2 lg:space-y-3">
          <p className="text-lg font-extrabold text-muted-foreground lg:text-2xl">
            {everyone ? "Everyone got it! 🎉" : guessed.length === 0 ? "Guess on your phones!" : `Guessed it · ${guessed.length} of ${game.eligible}`}
          </p>
          <GuessedList players={guessed.slice(0, 8)} />
          {guessed.length > 8 && <p className="text-lg font-bold text-muted-foreground">+{guessed.length - 8} more</p>}
        </div>
      </div>
    </div>
  );
}

export function DisplayDrawingReveal({ game, roomId }: { game: PublicGameState; roomId: string }) {
  const r = game.reveal as DrawReveal | null;
  useEffect(() => {
    if (r) playSound(r.guessers.length ? "win" : "pop");
  }, [r]);
  if (!r) return null;
  return (
    <div className="flex flex-1 flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6 lg:gap-10">
      <LiveDrawing key={r.drawingKey} roomId={roomId} drawingKey={r.drawingKey} className={cn("shrink-0", REVEAL_CANVAS)} label={`${r.artist.nickname}'s finished drawing of ${r.word}`} />
      <div className="flex w-full min-w-0 flex-1 flex-col gap-4 lg:gap-6">
        <div>
          <p className="text-lg font-bold text-muted-foreground lg:text-2xl">It was…</p>
          <motion.p
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
            className="text-5xl leading-tight font-black break-words text-mango lg:text-7xl"
          >
            {r.word}
          </motion.p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-lg font-bold lg:text-2xl">
            <AvatarBubble avatar={r.artist.avatar} size="xs" /> Drawn by {r.artist.nickname}
            {r.artistPoints > 0 && <span className="text-mango tabular-nums">+{r.artistPoints}</span>}
          </p>
        </div>
        {r.guessers.length === 0 ? (
          <p className="text-2xl font-bold text-muted-foreground lg:text-3xl">Nobody guessed it! 😅</p>
        ) : (
          <div className="space-y-2">
            <p className="text-lg font-extrabold text-muted-foreground lg:text-2xl">
              {r.guessers.length >= r.eligible ? "Everyone guessed it!" : `${r.guessers.length} of ${r.eligible} guessed it`}
            </p>
            <GuessedList players={r.guessers.slice(0, 6)} />
            {r.guessers.length > 6 && <p className="text-lg font-bold text-muted-foreground">+{r.guessers.length - 6} more</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Host ───────────────────────────────────────────────────────────── */

/**
 * The host's view of the round: who's drawing and a live preview (to keep an eye on things).
 * The prompt stays hidden until the reveal, so the host can't let it slip.
 */
export function HostDrawingPanel({ game, roomId }: { game: PublicGameState; roomId: string }) {
  const pub = game.phase === "intro" ? null : (game.round_data as DrawRound | null);
  const r = game.phase === "reveal" ? (game.reveal as DrawReveal | null) : null;
  if (!pub) return null;
  return (
    <div className="glass flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row">
      <LiveDrawing key={pub.drawingKey} roomId={roomId} drawingKey={pub.drawingKey} className="w-full max-w-52 self-center sm:w-56 sm:max-w-none sm:self-start" label={`Preview of ${pub.artist.nickname}'s drawing`} />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <AvatarBubble avatar={pub.artist.avatar} size="sm" />
          <p className="min-w-0 truncate text-lg font-extrabold">
            {pub.artist.nickname} <span className="font-semibold text-muted-foreground">{r ? "drew" : "is drawing"}</span>
          </p>
        </div>
        {r ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              The answer: <b className="text-xl text-foreground">{r.word}</b>
            </p>
            <p className="text-sm font-bold">
              {r.guessers.length} of {r.eligible} guessed it{r.artistPoints > 0 ? ` · artist +${DRAW_POINTS.artistBonus}` : ""}
            </p>
            <ol className="space-y-1">
              {r.guessers.slice(0, 5).map((g, i) => (
                <li key={g.playerId} className="flex items-center gap-2 text-sm">
                  <span className="w-4 font-black text-muted-foreground">{i + 1}</span>
                  <AvatarBubble avatar={g.avatar} size="xs" />
                  <span className="min-w-0 flex-1 truncate font-bold">{g.nickname}</span>
                  <span className="tabular-nums text-muted-foreground">{(g.ms / 1000).toFixed(1)}s</span>
                  <span className="font-black text-mango tabular-nums">+{g.points}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">The prompt is on {pub.artist.nickname}'s phone only. It's revealed when the round ends.</p>
            <WordHint hint={pub.hint} revealed={pub.revealed} className="justify-start text-lg font-black" />
            <p className="text-sm font-bold">
              {game.submitted} of {game.eligible} guessed it
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sortedAnswerers(game).map((a) => (
                <span key={a.playerId} className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-sm font-bold">
                  <AvatarBubble avatar={a.avatar} size="xs" /> {a.nickname}
                </span>
              ))}
            </div>
          </>
        )}
        {game.standings.length > 0 && (
          <div className="border-t border-border/60 pt-2">
            <p className="mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">Scores</p>
            <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {game.standings.slice(0, 6).map((s, i) => (
                <li key={s.playerId} className="flex items-center gap-1.5">
                  <span className="font-black text-muted-foreground">{i + 1}</span>
                  <span className="font-bold">{s.nickname}</span>
                  <span className="font-black text-mango tabular-nums">{s.score}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
