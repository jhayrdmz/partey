import { useEffect, useRef, useState } from "react";
import { Check, Hourglass, Lock, Trophy } from "lucide-react";
import { motion } from "motion/react";
import type { HoldReveal, HoldRound, PlayerPick, PublicGameState } from "@shared/engine";
import { HOLD_LIMITS, HOLD_VERDICT_LABELS, formatHold, holdVerdict, type HoldVerdict } from "@shared/gameSettings";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import { useServerCountdown } from "@/hooks/useServerClock";
import { serverNow } from "@/services/firebase";
import { playSound } from "@/utils/sound";
import { cn } from "@/utils/cn";
import type { PlayerQuestionProps } from "../engine/views";

const VERDICT_COLOR: Record<HoldVerdict, string> = {
  perfect: "text-success",
  almost: "text-calamansi",
  good: "text-mango",
  early: "text-guava",
  late: "text-guava",
};

const targetSeconds = (ms: number) => ms / 1000;

/** "+0.25s" (late) / "−0.50s" (early). */
function signedDiff(holdMs: number, targetMs: number) {
  const d = holdMs - targetMs;
  return `${d >= 0 ? "+" : "−"}${formatHold(Math.abs(d))}`;
}

/**
 * Before GO: the target is announced, then 3, 2, 1. `count` is 3/2/1 during the countdown (null
 * before it), `go` once holding may start. Plays the countdown ticks and the GO sound.
 */
function useCountdown(game: PublicGameState) {
  const pub = game.round_data as HoldRound;
  const left = useServerCountdown(pub.goAtMs, { tickMs: 50 }) ?? 0;
  const go = left <= 0;
  const count = !go && left <= HOLD_LIMITS.countdownMs ? Math.ceil(left / 1000) : null;
  const first = useRef(true);
  useEffect(() => {
    // No sound for the state the screen opened in (e.g. a phone reconnecting mid-round).
    if (first.current) return void (first.current = false);
    if (game.paused) return;
    if (go) playSound("start");
    else if (count !== null) playSound("tick");
  }, [go, count, game.paused]);
  return { go, count };
}

/* ─── Big screen ───────────────────────────────────────────────────────── */

type Status = "waiting" | "locked";

/*
 * The round's board and the ranked results share one grid (same width, columns and tiles), so on the
 * reveal players re-sort in place. Many players (more than 8): 3 columns and icon-only status.
 */
const isCompact = (players: number) => players > 8;
const boardWidth = (players: number) => (isCompact(players) ? "lg:w-[38rem] xl:w-[52rem]" : "lg:w-[30rem] xl:w-[40rem]");
const boardGrid = (players: number) => cn("grid w-full gap-2 lg:gap-3", isCompact(players) ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 lg:grid-cols-1");
const TILE = "flex items-center gap-3 rounded-2xl border-2 px-3 py-2 transition-colors lg:py-2.5";
const nameText = (players: number) => (isCompact(players) ? "text-base lg:text-xl" : "text-lg lg:text-2xl");

function StatusBoard({ players, locked }: { players: PlayerPick[]; locked: Set<string> }) {
  const compact = isCompact(players.length);
  return (
    <ul className={boardGrid(players.length)} aria-label="Players">
      {players.map((p) => {
        const status: Status = locked.has(p.playerId) ? "locked" : "waiting";
        return (
          <li
            key={p.playerId}
            data-status={status}
            className={cn(
              TILE,
              status === "locked" && "border-success bg-success/10",
              status === "waiting" && "border-border bg-card",
            )}
          >
            <AvatarBubble avatar={p.avatar} size="sm" />
            <span className={cn("min-w-0 flex-1 truncate font-extrabold", nameText(players.length))}>{p.nickname}</span>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 text-sm font-bold lg:text-lg",
                status === "locked" ? "text-success" : "text-muted-foreground",
              )}
            >
              {status === "locked" ? <Check className="size-5" /> : <Hourglass className="size-5" />}
              <span className={cn(compact && "sr-only")}>{status === "locked" ? "Locked in" : "Waiting"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function DisplayHold({ game }: { game: PublicGameState }) {
  const pub = game.round_data as HoldRound;
  const { go, count } = useCountdown(game);
  const locked = new Set(game.answeredBy?.map((a) => a.playerId));
  const lockedCount = locked.size;
  const prev = useRef(lockedCount);
  useEffect(() => {
    if (lockedCount > prev.current) playSound("pop");
    prev.current = lockedCount;
  }, [lockedCount]);

  return (
    <div className="flex flex-1 flex-col gap-[calc(1.5rem*var(--fit-c,1))] lg:flex-row lg:items-center lg:gap-10">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-xl font-extrabold tracking-widest text-muted-foreground uppercase lg:text-3xl">{go ? "Hold for exactly" : "Your target"}</p>
        <motion.p
          key={pub.targetMs}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 160, damping: 12 }}
          className="font-display text-[7rem] leading-none font-black text-mango tabular-nums lg:text-[13rem]"
          aria-label={`Target: ${targetSeconds(pub.targetMs)} seconds`}
        >
          {targetSeconds(pub.targetMs)}
          <span className="text-5xl lg:text-8xl">s</span>
        </motion.p>
        <div className="flex h-28 items-center justify-center lg:h-40">
          {go ? (
            <motion.p key="go" initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-4xl font-black lg:text-6xl">
              {lockedCount} / {game.eligible} locked in
            </motion.p>
          ) : count !== null ? (
            <motion.span key={count} initial={{ scale: 2.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-8xl font-black lg:text-[9rem]" aria-live="assertive">
              {count}
            </motion.span>
          ) : (
            <p className="text-3xl font-bold text-muted-foreground lg:text-5xl">Get ready…</p>
          )}
        </div>
        <p className="max-w-xl text-lg font-semibold text-muted-foreground lg:text-2xl">
          {go ? "No clocks. Let go when you think time's up." : "Press and hold on GO. No clock on your phone: count it in your head!"}
        </p>
      </div>
      <div className={cn("w-full", boardWidth(pub.players.length))}>
        <StatusBoard players={pub.players} locked={locked} />
      </div>
    </div>
  );
}

/** How long the reveal shows everyone in round order before re-arranging them by result. */
const SORT_AFTER_MS = 1_400;

export function DisplayHoldReveal({ game }: { game: PublicGameState }) {
  const r = game.reveal as HoldReveal | null;
  // Mounted once per round (keyed in views.tsx), so this starts false every reveal.
  const [sorted, setSorted] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSorted(true), SORT_AFTER_MS);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (r && sorted) playSound(r.results.some((x) => x.rank === 1) ? "win" : "pop");
  }, [r, sorted]);
  if (!r) return null;
  const held = r.results.filter((x) => x.holdMs !== null);
  const winners = held.filter((x) => x.rank === 1);
  const n = r.results.length;
  // Before: the order players were listed in during the round. After: closest first (r.results order).
  const roundOrder = (game.round_data as HoldRound | null)?.players.map((p) => p.playerId) ?? [];
  const at = (id: string) => (roundOrder.includes(id) ? roundOrder.indexOf(id) : roundOrder.length);
  const rows = sorted ? r.results : [...r.results].sort((a, b) => at(a.playerId) - at(b.playerId));
  return (
    <div className="flex flex-1 flex-col gap-[calc(1.5rem*var(--fit-c,1))] lg:flex-row lg:items-center lg:gap-10">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-xl font-extrabold tracking-widest text-muted-foreground uppercase lg:text-3xl">Target</p>
        <p className="font-display text-7xl font-black text-mango tabular-nums lg:text-9xl">{formatHold(r.targetMs)}</p>
        {winners.length > 0 && sorted ? (
          <motion.div
            initial={{ scale: 0.3, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 10, delay: 0.4 }}
            className="mt-2 flex flex-col items-center gap-2 rounded-3xl bg-mango px-6 py-4 text-black"
          >
            <motion.span animate={{ rotate: [0, -12, 12, 0] }} transition={{ repeat: Infinity, duration: 1.6, delay: 0.8 }}>
              <Trophy className="size-12 lg:size-16" />
            </motion.span>
            <p className="text-2xl font-black lg:text-4xl">
              {winners.length === 1 ? `${winners[0].nickname} wins!` : `${winners.map((w) => w.nickname).join(" & ")} tie!`}
            </p>
            <p className="text-lg font-bold lg:text-2xl">
              {formatHold(winners[0].holdMs!)} · {HOLD_VERDICT_LABELS[holdVerdict(winners[0].holdMs!, r.targetMs)]}
            </p>
          </motion.div>
        ) : winners.length > 0 ? (
          <p className="text-2xl font-bold text-muted-foreground lg:text-4xl">And the closest is…</p>
        ) : (
          <p className="text-2xl font-bold text-muted-foreground lg:text-4xl">Nobody held! 😴</p>
        )}
      </div>
      <div className={cn("w-full", boardWidth(n))}>
        <ol className={boardGrid(n)} aria-label="Results" data-sorted={sorted}>
          {rows.map((p, i) => (
            <motion.li
              key={p.playerId}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              // Everyone is in before the re-sort, however many players (≤ ~0.9 s of stagger).
              transition={{ delay: sorted ? 0 : 0.1 + i * Math.min(0.06, 0.8 / n), layout: { type: "spring", stiffness: 140, damping: 20 } }}
              className={cn(TILE, "duration-500", sorted && p.rank === 1 ? "border-mango bg-mango/10" : "border-border bg-card")}
            >
              <span className="w-6 shrink-0 text-center text-lg font-black text-muted-foreground lg:text-xl">{sorted ? (p.rank ?? "–") : ""}</span>
              <AvatarBubble avatar={p.avatar} size="sm" />
              <span className="min-w-0 flex-1 leading-tight">
                <span className={cn("block truncate font-extrabold", nameText(n))}>{p.nickname}</span>
                <span className="block truncate text-sm font-bold text-muted-foreground tabular-nums lg:text-base">
                  {/* Narrow 3-column tiles: just the time (the target is big on the left). */}
                  {p.holdMs === null ? "No hold" : isCompact(n) ? formatHold(p.holdMs) : `${formatHold(p.holdMs)} · ${signedDiff(p.holdMs, r.targetMs)}`}
                </span>
              </span>
              <span className={cn("shrink-0 font-black text-mango tabular-nums transition-opacity duration-500 lg:text-xl", !sorted && "opacity-0")}>+{p.points}</span>
            </motion.li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ─── Phone ────────────────────────────────────────────────────────────── */

/**
 * The HOLD button. The hold is timed on this device with performance.now() from press to release, so
 * network latency never counts; only the duration is sent. The target is shown, a running clock never is.
 * Solid colours, no animation players could count: red with black text until pressed, green with white text while held.
 */
export function HoldPad({ game, submit, submitting }: PlayerQuestionProps) {
  const pub = game.round_data as HoldRound;
  const { go, count } = useCountdown(game);
  const [holding, setHolding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const hold = useRef<{ pointerId: number; startedAt: number; timer: number } | null>(null);
  const sent = useRef(false);

  function end() {
    const h = hold.current;
    if (!h) return null;
    window.clearTimeout(h.timer);
    hold.current = null;
    setHolding(false);
    return h;
  }

  function cancel(message: string) {
    if (end()) setNote(message);
  }

  function release() {
    const h = end();
    if (!h) return;
    const holdMs = Math.min(pub.maxHoldMs, Math.round(performance.now() - h.startedAt));
    if (holdMs < HOLD_LIMITS.minHoldMs) return setNote("That was a tap. Press and hold!");
    sent.current = true;
    playSound("pop");
    void submit({ holdMs }).then((res) => {
      if (res) return;
      // Not accepted (e.g. the round just ended or the network dropped): the error is toasted.
      sent.current = false;
      setNote("That hold didn't count. Try again!");
    });
  }

  function press(pointerId: number) {
    if (!go || game.paused || hold.current || sent.current || submitting) return;
    // Let go by ourselves before the hold limit or the round's end, whichever is first.
    const untilEnd = game.phaseEndsAtMs ? game.phaseEndsAtMs - serverNow() - 700 : Infinity;
    const limit = Math.max(0, Math.min(pub.maxHoldMs, untilEnd));
    hold.current = { pointerId, startedAt: performance.now(), timer: window.setTimeout(release, limit) };
    setHolding(true);
    setNote(null);
    navigator.vibrate?.(15);
  }

  // A pause, the app going to the background, or leaving the screen cancels a hold in progress.
  useEffect(() => {
    // The pause comes from the server: stop timing.
    if (game.paused) cancel("Paused. Hold again when the game resumes.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.paused]);
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && cancel("Hold interrupted. Press and hold again.");
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      end();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enabled = go && !game.paused && !submitting;
  const title = holding ? "Keep holding…" : go ? "GO! Press and hold" : count !== null ? String(count) : "Get ready to test your sense of time!";

  return (
    <div className="flex flex-1 flex-col items-center justify-between gap-4 text-center">
      <div className="space-y-1">
        <p className="mx-auto w-fit rounded-full bg-card px-4 py-1.5 text-lg font-extrabold" aria-label={`Target: ${targetSeconds(pub.targetMs)} seconds`}>
          Target <span className="text-mango tabular-nums">{targetSeconds(pub.targetMs)}s</span>
        </p>
        <motion.p key={title} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={cn("font-black", count !== null && !go ? "text-7xl" : "text-3xl")} aria-live="polite">
          {title}
        </motion.p>
        <p className={cn("min-h-6 font-bold", note ? "text-guava" : "text-muted-foreground")}>
          {note ?? (holding ? "Let go when you think time's up." : go ? "Press and hold. Let go when you think time's up." : "Get ready to press and hold on GO.")}
        </p>
      </div>

      <div className="flex w-full flex-1 items-center justify-center">
        <motion.button
          type="button"
          aria-label={holding ? "Holding. Let go when time is up" : "Hold"}
          aria-pressed={holding}
          disabled={!enabled && !holding}
          onPointerDown={(e) => {
            e.preventDefault();
            if (!enabled) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            press(e.pointerId);
          }}
          onPointerUp={(e) => e.pointerId === hold.current?.pointerId && release()}
          onPointerCancel={(e) => e.pointerId === hold.current?.pointerId && cancel("Hold interrupted. Press and hold again.")}
          onKeyDown={(e) => {
            if ((e.key === " " || e.key === "Enter") && !e.repeat) {
              e.preventDefault();
              press(-1);
            }
          }}
          onKeyUp={(e) => (e.key === " " || e.key === "Enter") && hold.current?.pointerId === -1 && release()}
          onContextMenu={(e) => e.preventDefault()}
          animate={{ scale: holding ? 0.94 : 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          style={{ touchAction: "none", WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
          className={cn(
            // Fixed size (no aspect-ratio or % width): iOS Safari mis-sizes and mis-centres those on buttons.
            "grid size-[min(72vw,18rem)] shrink-0 place-items-center rounded-full border-8 border-black/80 text-5xl font-black tracking-wide outline-none select-none",
            "shadow-[0_10px_0_rgba(0,0,0,0.45)] focus-visible:ring-4 focus-visible:ring-white/70",
            holding ? "bg-[#16a34a] text-white shadow-[0_4px_0_rgba(0,0,0,0.45)]" : "bg-[#ef3b4f] text-black",
            !holding && !enabled && "opacity-50",
          )}
          data-state={holding ? "holding" : "idle"}
        >
          HOLD
        </motion.button>
      </div>
    </div>
  );
}

export function HoldLocked({ game }: PlayerQuestionProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl bg-card text-center">
      <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 12 }}>
        <Lock className="size-16 text-success" />
      </motion.span>
      <p className="text-3xl font-black">Time locked!</p>
      <p className="text-muted-foreground">
        Waiting for the others… {game.submitted} / {game.eligible} locked in
      </p>
    </div>
  );
}

export function HoldResult({ game, me, uid }: { game: PublicGameState; me: { gameScore: number; rank: number | null; round: number }; uid: string }) {
  const r = game.reveal as HoldReveal | null;
  const mine = r?.results.find((x) => x.playerId === uid);
  const won = mine?.rank === 1;
  useEffect(() => {
    if (mine) playSound(won ? "win" : "pop");
  }, [mine, won]);
  if (!r) return null;
  const verdict = mine?.holdMs != null ? holdVerdict(mine.holdMs, r.targetMs) : null;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 14 }} className="space-y-1">
        {won && <Trophy className="mx-auto size-14 text-mango" />}
        <p className={cn("text-4xl font-black", verdict ? VERDICT_COLOR[verdict] : "text-muted-foreground")}>{verdict ? HOLD_VERDICT_LABELS[verdict] : "No hold this round"}</p>
        <p className="text-5xl font-black tabular-nums">{mine && mine.points > 0 ? `+${mine.points}` : "0"}</p>
        {mine?.rank && (
          <p className="font-bold text-muted-foreground">
            #{mine.rank} of {r.results.filter((x) => x.holdMs !== null).length}
          </p>
        )}
      </motion.div>
      {mine?.holdMs != null && (
        <dl className="grid w-full grid-cols-3 gap-2">
          {[
            ["You held", formatHold(mine.holdMs)],
            ["Target", formatHold(r.targetMs)],
            ["Off by", signedDiff(mine.holdMs, r.targetMs)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-card p-3">
              <dt className="text-xs font-bold text-muted-foreground uppercase">{label}</dt>
              <dd className="text-xl font-black tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="w-full rounded-2xl bg-card p-5">
        <p className="flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground">
          <Trophy className="size-4 text-mango" /> This game
        </p>
        <p className="mt-1 text-3xl font-black tabular-nums">{me.gameScore} pts</p>
        {me.rank && <p className="text-muted-foreground">You're #{me.rank}</p>}
      </div>
      <p className="text-sm text-muted-foreground">{me.round >= game.totalRounds ? "Final results coming up…" : "Next round coming up…"}</p>
    </div>
  );
}
