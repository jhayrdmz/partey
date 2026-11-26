/** Word Scramble pieces: letter tiles, the phone's answer pad, and the display / host panels. */
import { useEffect, useRef, useState } from "react";
import { Check, Clock, Delete, Eraser, Lightbulb, Loader2, Shuffle, Sparkles, Trophy, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { PublicGameState, ScrambleReveal, ScrambleRound, StandingEntry, SubmitAnswerResponse } from "@shared/engine";
import { SCRAMBLE_CATEGORY_LABELS, SCRAMBLE_DIFFICULTY_LABELS, scramblePoints, scrambleSpeedBonus } from "@shared/gameSettings";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import { BottomBar } from "@/components/shared/BottomBar";
import { Button } from "@/components/ui/button";
import { useServerCountdown } from "@/hooks/useServerClock";
import { cn } from "@/utils/cn";
import { playSound } from "@/utils/sound";

/* ─── Shared ─────────────────────────────────────────────────────────── */

/** Tile colours cycle through the party palette (yellow takes black text). */
const TILE = ["bg-guava text-background", "bg-mango text-black", "bg-calamansi text-background", "bg-sky text-background"];

/** The letters as colourful tiles that pop in one after another. */
export function LetterTiles({ letters, size = "lg", className }: { letters: string[]; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <div className={cn("flex flex-wrap justify-center", size === "lg" ? "gap-2 sm:gap-3 lg:gap-4" : "gap-1.5", className)} aria-label={`Letters: ${letters.join(" ")}`} role="img">
      {letters.map((ch, i) => (
        <motion.span
          key={`${i}-${ch}`}
          aria-hidden
          initial={{ y: -30, rotate: -12, scale: 0.4, opacity: 0 }}
          animate={{ y: 0, rotate: 0, scale: 1, opacity: 1 }}
          transition={{ delay: i * 0.06, type: "spring", stiffness: 320, damping: 16 }}
          className={cn(
            "grid place-items-center rounded-xl font-black uppercase shadow-[0_4px_0_rgba(0,0,0,0.25)]",
            TILE[i % TILE.length],
            size === "lg" && "size-[calc(3.25rem*var(--fit-q,1))] text-[length:calc(2rem*var(--fit-q,1))] sm:size-[calc(4.5rem*var(--fit-q,1))] sm:text-[length:calc(2.75rem*var(--fit-q,1))] lg:size-[calc(6.5rem*var(--fit-q,1))] lg:text-[length:calc(4rem*var(--fit-q,1))]",
            size === "md" && "size-11 text-2xl",
            size === "sm" && "size-8 rounded-lg text-lg",
          )}
        >
          {ch}
        </motion.span>
      ))}
    </div>
  );
}

/** Answer slots: one per letter, filled in only where a hint has revealed it. */
export function AnswerSlots({ length, hints, className }: { length: number; hints: ScrambleRound["hints"]; className?: string }) {
  const shown = new Map(hints.map((h) => [h.index, h.letter]));
  const pattern = Array.from({ length }, (_, i) => shown.get(i) ?? "_").join(" ");
  return (
    <div role="img" aria-label={`Answer: ${pattern}`} className={cn("flex flex-wrap justify-center gap-[0.3em]", className)}>
      {Array.from({ length }, (_, i) => (
        <span key={i} aria-hidden className="inline-flex w-[0.85em] justify-center border-b-[0.12em] border-current leading-none">
          {shown.get(i) ? <motion.span initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-mango">{shown.get(i)}</motion.span> : <>&nbsp;</>}
        </span>
      ))}
    </div>
  );
}

function Chips({ pub, className }: { pub: ScrambleRound; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2", className)}>
      <span className="rounded-md bg-secondary px-3 py-1 font-bold text-muted-foreground">
        Category · <span className="text-foreground">{SCRAMBLE_CATEGORY_LABELS[pub.category]}</span>
      </span>
      <span className="rounded-md bg-secondary px-3 py-1 font-bold text-muted-foreground">{SCRAMBLE_DIFFICULTY_LABELS[pub.difficulty]}</span>
      <span className="rounded-md bg-secondary px-3 py-1 font-bold text-muted-foreground tabular-nums">{pub.letters.length} letters</span>
    </div>
  );
}

const sortedAnswerers = (game: PublicGameState) => [...(game.answeredBy ?? [])].sort((a, b) => a.atMs - b.atMs || a.playerId.localeCompare(b.playerId));

/** The points a correct answer earns, exactly as the server scores it: order + optional speed bonus. */
function livePoints(game: PublicGameState, order: number, atMs: number): { points: number; bonus: number } {
  const pub = game.round_data as ScrambleRound | null;
  const openedAt = game.phaseEndsAtMs !== null ? game.phaseEndsAtMs - game.phaseDurationMs : null;
  const bonus = pub?.speedBonus && openedAt !== null ? scrambleSpeedBonus(atMs - openedAt, game.phaseDurationMs) : 0;
  return { points: scramblePoints(order) + bonus, bonus };
}

/** Game scores so far plus this round's correct answers, which count straight away. */
function liveStandings(game: PublicGameState): (StandingEntry & { gained: number })[] {
  const gained = new Map<string, number>();
  if (game.phase === "question") sortedAnswerers(game).forEach((a, i) => gained.set(a.playerId, livePoints(game, i, a.atMs).points));
  const rows = game.standings.map((s) => ({ ...s, score: s.score + (gained.get(s.playerId) ?? 0), gained: gained.get(s.playerId) ?? 0 }));
  // Someone solving it in round 1 may not be in the standings yet.
  for (const a of sortedAnswerers(game)) {
    if (!rows.some((r) => r.playerId === a.playerId)) rows.push({ playerId: a.playerId, nickname: a.nickname, avatar: a.avatar, score: gained.get(a.playerId) ?? 0, gained: gained.get(a.playerId) ?? 0 });
  }
  return rows.sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));
}

/* ─── Display ────────────────────────────────────────────────────────── */

function LiveLeaderboard({ game }: { game: PublicGameState }) {
  const rows = liveStandings(game).slice(0, 6);
  return (
    <section className="space-y-2 rounded-2xl bg-card p-4 lg:space-y-3 lg:p-5" aria-label="Leaderboard">
      <h3 className="flex items-center gap-2 text-lg font-extrabold lg:text-2xl">
        <Trophy className="size-5 text-mango lg:size-6" /> Leaderboard
      </h3>
      {rows.length === 0 ? (
        <p className="text-muted-foreground lg:text-lg">First to solve it takes the lead!</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <motion.li layout key={r.playerId} className="flex items-center gap-2.5 text-base lg:text-xl">
              <span className="w-5 text-center font-black text-muted-foreground">{i + 1}</span>
              <AvatarBubble avatar={r.avatar} size="xs" />
              <span className="min-w-0 flex-1 truncate font-bold">{r.nickname}</span>
              {r.gained > 0 && <span className="text-sm font-bold text-calamansi lg:text-base">+{r.gained}</span>}
              <span className="font-black text-mango tabular-nums">{r.score}</span>
            </motion.li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** "Ana solved it!" as people get it (names only, never the word). */
function SolvedFeed({ game }: { game: PublicGameState }) {
  const solved = sortedAnswerers(game);
  const recent = solved.slice(-4).reverse();
  return (
    <section className="space-y-2 rounded-2xl bg-card p-4 lg:p-5" aria-label="Solved it">
      <h3 className="flex items-center gap-2 text-lg font-extrabold lg:text-2xl">
        <Sparkles className="size-5 text-calamansi lg:size-6" /> Solved it · {solved.length}/{game.eligible}
      </h3>
      <ol className="space-y-1.5">
        <AnimatePresence initial={false}>
          {recent.map((a) => {
            const order = solved.findIndex((s) => s.playerId === a.playerId);
            return (
              <motion.li
                key={a.playerId}
                layout
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="flex items-center gap-2.5 rounded-xl border border-calamansi/40 px-3 py-1.5 text-base lg:text-xl"
              >
                <Check className="size-5 text-calamansi" />
                <AvatarBubble avatar={a.avatar} size="xs" />
                <span className="min-w-0 flex-1 truncate font-bold">{a.nickname}</span>
                <span className="font-black text-mango tabular-nums">+{livePoints(game, order, a.atMs).points}</span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
      {solved.length === 0 && <p className="text-muted-foreground lg:text-lg">Nobody yet. Type it on your phone!</p>}
    </section>
  );
}

export function DisplayScramble({ game }: { game: PublicGameState }) {
  const pub = game.round_data as ScrambleRound;
  const solvedCount = game.answeredBy?.length ?? 0;
  const prev = useRef(solvedCount);
  useEffect(() => {
    if (solvedCount > prev.current) playSound("pop");
    prev.current = solvedCount;
  }, [solvedCount]);
  return (
    <div className="flex flex-1 flex-col gap-[calc(1.5rem*var(--fit-c,1))] lg:flex-row lg:items-center lg:gap-10">
      <div className="flex flex-1 flex-col items-center justify-center gap-[calc(1.5rem*var(--fit-c,1))] text-center">
        <Chips pub={pub} className="text-base lg:text-xl" />
        <LetterTiles letters={pub.letters} />
        <AnswerSlots length={pub.letters.length} hints={pub.hints} className="text-3xl font-black lg:text-5xl" />
        {pub.hints.length > 0 && (
          <p className="flex items-center gap-2 text-lg font-bold text-mango lg:text-2xl">
            <Lightbulb className="size-6" /> {pub.hints.length === 1 ? `Starts with ${pub.hints[0].letter}` : `Starts with ${pub.hints[0].letter}, ends with ${pub.hints[1].letter}`}
          </p>
        )}
      </div>
      <div className="grid w-full gap-4 sm:grid-cols-2 lg:w-[26rem] lg:grid-cols-1">
        <SolvedFeed game={game} />
        <LiveLeaderboard game={game} />
      </div>
    </div>
  );
}

export function DisplayScrambleReveal({ game }: { game: PublicGameState }) {
  const r = game.reveal as ScrambleReveal | null;
  useEffect(() => {
    if (r) playSound(r.solvers.length ? "win" : "pop");
  }, [r]);
  if (!r) return null;
  return (
    <div className="flex flex-1 flex-col gap-[calc(1.25rem*var(--fit-c,1))] lg:flex-row lg:items-center lg:gap-10">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-bold text-muted-foreground lg:text-2xl">The word was</p>
        <LetterTiles letters={[...r.word]} />
        <p className="text-lg font-bold text-muted-foreground lg:text-2xl">
          {r.solvers.length === 0 ? "Nobody solved it! 😅" : r.solvers.length >= r.eligible ? "Everyone solved it! 🎉" : `${r.solvers.length} of ${r.eligible} solved it`}
        </p>
      </div>
      {r.solvers.length > 0 && (
        <ol className="w-full space-y-2 lg:w-[30rem] lg:space-y-3">
          {r.solvers.slice(0, 6).map((s, i) => (
            <motion.li
              key={s.playerId}
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.08 }}
              className={cn("flex items-center gap-3 rounded-2xl border px-4 py-2.5 lg:py-3", i === 0 ? "border-mango bg-mango/10" : "border-border bg-card")}
            >
              <span className="w-7 text-center text-xl font-black text-muted-foreground lg:text-2xl">{i + 1}</span>
              <AvatarBubble avatar={s.avatar} size="sm" />
              <span className="min-w-0 flex-1 truncate text-xl font-extrabold lg:text-3xl">{s.nickname}</span>
              <span className="text-sm text-muted-foreground tabular-nums lg:text-lg">{(s.ms / 1000).toFixed(1)}s</span>
              <span className="text-xl font-black text-mango tabular-nums lg:text-3xl">+{s.points}</span>
            </motion.li>
          ))}
          {r.solvers.length > 6 && <li className="text-lg font-bold text-muted-foreground">+{r.solvers.length - 6} more</li>}
        </ol>
      )}
    </div>
  );
}

/* ─── Phone ──────────────────────────────────────────────────────────── */

/**
 * Spell the word by tapping the scrambled tiles in order: each tap drops a letter into the next
 * slot; tap a placed letter (or the undo button) to send it back. The guess is sent as soon as every
 * slot is filled, once every 5 seconds (the server enforces it; this shows the countdown). Wrong
 * guesses cost nothing: the letters shake and return to the pool.
 */
export function ScramblePad({ game, me, submit, submitting }: { game: PublicGameState; me: { gameScore: number; rank: number | null } | null; submit: (a: unknown) => Promise<SubmitAnswerResponse | null>; submitting: boolean }) {
  const pub = game.round_data as ScrambleRound;
  const n = pub.letters.length;
  /** Tile order on screen (the player can shuffle it), as indexes into pub.letters. */
  const [order, setOrder] = useState(() => pub.letters.map((_, i) => i));
  /** Tiles placed in the answer, in order (indexes into pub.letters). */
  const [picked, setPicked] = useState<number[]>([]);
  const [wrong, setWrong] = useState(0);
  const [retryAtMs, setRetryAtMs] = useState<number | null>(null);
  const cooldownLeft = useServerCountdown(retryAtMs, { tickMs: 200 });
  const coolingDown = cooldownLeft !== null && cooldownLeft > 0;
  // Whole seconds left, never more than the cooldown itself (the phone's server-clock estimate can trail a little).
  const coolSecs = coolingDown ? Math.min(Math.ceil(cooldownLeft / 1000), pub.cooldownMs / 1000) : 0;
  const timeLeft = useServerCountdown(game.phaseEndsAtMs, { paused: game.paused, pausedRemainingMs: game.remainingMs });
  const timeUp = !game.paused && timeLeft !== null && timeLeft <= 0;
  const locked = submitting || coolingDown || timeUp || game.paused;

  async function send(letters: number[]) {
    const guess = letters.map((i) => pub.letters[i]).join("");
    const res = await submit({ guess });
    if (res?.retryAtMs) setRetryAtMs(res.retryAtMs);
    if (res?.correct === false || !res) {
      // Wrong (or refused): shake, then the letters go back to the pool.
      if (res?.correct === false) {
        setWrong((w) => w + 1);
        playSound("pop");
        if (navigator.vibrate) navigator.vibrate(60);
      }
      window.setTimeout(() => setPicked([]), 450);
    }
  }

  function pick(i: number) {
    if (locked || picked.includes(i) || picked.length >= n) return;
    const next = [...picked, i];
    setPicked(next);
    if (navigator.vibrate) navigator.vibrate(10);
    if (next.length === n) void send(next); // the last letter sends the guess
  }
  const unpick = (slot: number) => !locked && setPicked((p) => p.filter((_, k) => k !== slot));
  const undo = () => !locked && setPicked((p) => p.slice(0, -1));
  const clear = () => !locked && setPicked([]);
  const shuffleTiles = () =>
    setOrder((o) => {
      const a = [...o];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    });
  const big = n <= 7;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <Chips pub={pub} className="text-xs" />
        <p className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
          <span>
            Score <span className="text-mango tabular-nums">{me?.gameScore ?? 0}</span>
          </span>
          {me?.rank && <span>· #{me.rank}</span>}
          {pub.hints.length > 0 && (
            <span className="inline-flex items-center gap-1 text-mango">
              <Lightbulb className="size-4" /> {pub.hints.length === 1 ? `Starts with ${pub.hints[0].letter}` : `${pub.hints[0].letter}…${pub.hints[1].letter}`}
            </span>
          )}
        </p>
      </div>

      {/* The answer being spelled: tap a letter to send it back. */}
      <motion.ol
        key={wrong}
        aria-label="Your answer"
        animate={wrong ? { x: [0, -12, 10, -6, 4, 0] } : undefined}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap justify-center gap-1.5 rounded-2xl bg-card px-2 py-4"
      >
        {Array.from({ length: n }, (_, slot) => {
          const tile = picked[slot];
          const ch = tile === undefined ? null : pub.letters[tile];
          return (
            <li key={slot}>
              <button
                type="button"
                onClick={() => unpick(slot)}
                disabled={ch === null || locked}
                aria-label={ch ? `Remove ${ch}` : `Empty slot ${slot + 1}`}
                className={cn(
                  "grid place-items-center rounded-lg border-2 font-black uppercase transition-colors",
                  big ? "size-11 text-2xl" : "size-9 text-xl",
                  ch ? "border-mango bg-mango/15 text-foreground" : "border-dashed border-border text-transparent",
                  wrong > 0 && ch && picked.length === n && "border-guava bg-guava/15",
                )}
              >
                {ch ?? "·"}
              </button>
            </li>
          );
        })}
      </motion.ol>

      {/* The scrambled tiles: tap in order to spell the word. */}
      <div role="group" aria-label="Letters" className="flex flex-wrap justify-center gap-2">
        {order.map((i, pos) => {
          const used = picked.includes(i);
          return (
            <motion.button
              key={i}
              layout
              type="button"
              onClick={() => pick(i)}
              disabled={used || locked}
              aria-label={`Letter ${pub.letters[i]}`}
              aria-pressed={used}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: pos * 0.03, type: "spring", stiffness: 320, damping: 18 }}
              className={cn(
                "grid place-items-center rounded-xl font-black uppercase shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-[opacity,transform] active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed",
                big ? "size-14 text-3xl" : "size-12 text-2xl",
                used ? "border-2 border-dashed border-border bg-transparent text-transparent shadow-none" : TILE[i % TILE.length],
                !used && locked && "opacity-50",
              )}
            >
              {pub.letters[i]}
            </motion.button>
          );
        })}
      </div>

      <div className="min-h-14 text-center" role="status" aria-live="polite">
        <AnimatePresence mode="popLayout">
          {timeUp ? (
            <motion.p key="up" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-2xl font-black text-guava">
              Time's up!
            </motion.p>
          ) : wrong > 0 && (coolingDown || submitting) ? (
            <motion.p key={`w-${wrong}`} initial={{ x: -10, opacity: 0 }} animate={{ x: [12, -8, 4, 0], opacity: 1 }} transition={{ duration: 0.35 }} className="flex items-center justify-center gap-2 text-lg font-extrabold text-guava">
              <X className="size-5" /> Incorrect! Try again.
            </motion.p>
          ) : submitting ? (
            <p key="checking" className="flex items-center justify-center gap-2 font-bold text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Checking…
            </p>
          ) : (
            <p key="tip" className="text-sm font-semibold text-muted-foreground">
              Tap the letters in order. It sends when every slot is filled.
            </p>
          )}
        </AnimatePresence>
        {coolingDown && !timeUp && (
          <p className="mt-1 flex items-center justify-center gap-1.5 font-bold text-muted-foreground tabular-nums">
            <Clock className="size-4" /> Next guess available in {coolSecs}s
          </p>
        )}
      </div>

      <BottomBar always className="mt-auto sm:-mx-4 sm:px-4">
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant="secondary" className="h-12 rounded-md" onClick={undo} disabled={locked || picked.length === 0} aria-label="Undo last letter">
            <Delete /> Undo
          </Button>
          <Button type="button" variant="secondary" className="h-12 rounded-md" onClick={clear} disabled={locked || picked.length === 0} aria-label="Clear answer">
            <Eraser /> Clear
          </Button>
          <Button type="button" variant="secondary" className="h-12 rounded-md" onClick={shuffleTiles} disabled={timeUp} aria-label="Shuffle letters">
            <Shuffle /> Shuffle
          </Button>
        </div>
      </BottomBar>
    </div>
  );
}

/** Solved: locked until the next word. */
export function ScrambleSolved({ game, uid }: { game: PublicGameState; uid: string }) {
  const solved = sortedAnswerers(game);
  const order = solved.findIndex((a) => a.playerId === uid);
  const mine = order >= 0 ? livePoints(game, order, solved[order].atMs) : null;
  useEffect(() => {
    playSound("win");
    if (navigator.vibrate) navigator.vibrate([40, 30, 80]);
  }, []);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl bg-card p-6 text-center">
      <motion.span initial={{ scale: 0.3, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 220, damping: 12 }} className="grid size-24 place-items-center rounded-full bg-success/20">
        <Check className="size-14 text-success" />
      </motion.span>
      <p className="text-3xl font-black">Correct!{mine ? ` +${mine.points} points!` : ""}</p>
      {order >= 0 && (
        <p className="text-lg font-bold">
          {ordinal(order + 1)} to solve it{mine?.bonus ? ` · includes +${mine.bonus} speed bonus` : ""}
        </p>
      )}
      <p className="text-muted-foreground">Waiting for the next round…</p>
    </div>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/* ─── Host ───────────────────────────────────────────────────────────── */

/** The host's live view: the scramble, who has solved it, the scores. The word appears at the reveal. */
export function HostScramblePanel({ game }: { game: PublicGameState }) {
  const pub = game.phase === "intro" ? null : (game.round_data as ScrambleRound | null);
  const r = game.phase === "reveal" ? (game.reveal as ScrambleReveal | null) : null;
  if (!pub) return null;
  const solved = sortedAnswerers(game);
  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4">
      <LetterTiles letters={r ? [...r.word] : pub.letters} size="md" />
      {r ? (
        <p className="text-center text-sm">
          The word: <b className="text-lg">{r.word}</b> · {r.solvers.length} of {r.eligible} solved it
        </p>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          {solved.length} of {game.eligible} solved it so far. The word is revealed when the round ends.
        </p>
      )}
      <ol className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
        {liveStandings(game).slice(0, 8).map((s, i) => (
          <li key={s.playerId} className="flex items-center gap-1.5">
            <span className="font-black text-muted-foreground">{i + 1}</span>
            <span className="font-bold">{s.nickname}</span>
            <span className="font-black text-mango tabular-nums">{s.score}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

