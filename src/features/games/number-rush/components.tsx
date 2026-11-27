import { useEffect, useRef, useState } from "react";
import { Check, Flame, Lock, Minus, Trophy, X } from "lucide-react";
import { motion } from "motion/react";
import { sharedPlaces, type PublicGameState, type RushChoice, type RushReveal, type RushRound } from "@shared/engine";
import { RUSH_POINTS, rushAllowed, rushMultiplier, rushPoints } from "@shared/gameSettings";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import { useServerCountdown } from "@/hooks/useServerClock";
import { playSound } from "@/utils/sound";
import { cn } from "@/utils/cn";
import type { PlayerQuestionProps } from "../engine/views";
import { ChoiceButton, ChoiceIcon, DirectionStamp, NumberTiles, RollingNumber, StreakBadge } from "./art";
import { CHOICE_LABEL } from "./styles";

/** A streak that just reached a new multiplier (2 → 1.25x, 4 → 1.5x, 6 → 2x). */
const isMilestone = (streak: number) => streak > 1 && RUSH_POINTS.tiers.some((t) => t.from === streak);

function useSecondsLeft(game: PublicGameState) {
  const left = useServerCountdown(game.phaseEndsAtMs, { paused: game.paused, pausedRemainingMs: game.remainingMs });
  return left === null ? null : Math.ceil(left / 1000);
}

/** Ticks for the last 3 seconds. */
function useFinalTicks(seconds: number | null, paused: boolean) {
  const prev = useRef(seconds);
  useEffect(() => {
    if (!paused && seconds !== null && prev.current !== null && seconds < prev.current && seconds <= 3 && seconds > 0) playSound("tick");
    prev.current = seconds;
  }, [seconds, paused]);
}

/* ─── Big screen ───────────────────────────────────────────────────────── */

export function DisplayRush({ game }: { game: PublicGameState }) {
  const pub = game.round_data as RushRound;
  const seconds = useSecondsLeft(game);
  useFinalTicks(seconds, game.paused);
  const allowed = rushAllowed(pub.current);
  const urgent = seconds !== null && seconds <= 5 && seconds > 0;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[calc(1.5rem*var(--fit-c,1))] text-center lg:flex-row lg:gap-12">
      <div className="flex flex-1 flex-col items-center gap-[calc(1.25rem*var(--fit-c,1))]">
        <p className="font-display text-4xl font-black lg:text-6xl">Higher or lower?</p>
        <motion.div key={pub.current} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}>
          <NumberTiles digits={String(pub.current)} label={`Current number ${pub.current}`} />
        </motion.div>
        <div className="flex gap-4">
          <ChoiceButton choice="lower" disabled={!allowed.lower} className="pointer-events-none w-auto px-8 py-2 [&>span]:text-3xl" note={allowed.lower ? undefined : "Nothing is below 100"} />
          <ChoiceButton choice="higher" disabled={!allowed.higher} className="pointer-events-none w-auto px-8 py-2 [&>span]:text-3xl" note={allowed.higher ? undefined : "Nothing is above 999"} />
        </div>
      </div>
      <div className="flex w-full flex-col items-center gap-4 lg:w-[22rem]">
        {/* The shell's timer bar runs all round; the last seconds count down big here. */}
        <div className="grid size-36 place-items-center lg:size-44">
          {urgent && !game.paused && (
            <motion.div
              key={seconds}
              initial={{ scale: 1.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="grid size-full place-items-center rounded-full border-[6px] border-[#2a1240] bg-guava font-display text-8xl font-black text-white tabular-nums shadow-[0_6px_0_#2a1240]"
              aria-label={`${seconds} seconds left`}
              aria-live="assertive"
            >
              {seconds}
            </motion.div>
          )}
        </div>
        <p className="text-2xl font-black lg:text-3xl" data-testid="locked-count">
          {game.submitted} / {game.eligible} locked in
        </p>
        {pub.onStreak.length > 0 && (
          <div className="w-full space-y-2">
            <p className="text-sm font-extrabold tracking-widest text-muted-foreground uppercase lg:text-base">On a streak</p>
            <ul className="flex flex-wrap justify-center gap-2" aria-label="On a streak">
              {pub.onStreak.slice(0, 8).map((p) => (
                <li key={p.playerId} className="flex items-center gap-1.5 rounded-full bg-card py-1 pr-2 pl-1 font-extrabold">
                  <AvatarBubble avatar={p.avatar} size="xs" />
                  <span className="max-w-24 truncate">{p.nickname}</span>
                  <StreakBadge streak={p.streak} multiplier={rushMultiplier(p.streak)} />
                </li>
              ))}
              {pub.onStreak.length > 8 && <li className="self-center font-bold text-muted-foreground">+{pub.onStreak.length - 8} more</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/** Reveal timeline (ms after it opens): digits stop by ~1.6 s, then the direction, then points, then the re-sort. */
const SHOW_POINTS_MS = 2_300;
const SORT_MS = 3_300;

const compactBoard = (n: number) => n > 8;

export function DisplayRushReveal({ game }: { game: PublicGameState }) {
  const r = game.reveal as RushReveal | null;
  const [rolled, setRolled] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const a = window.setTimeout(() => setStep(1), SHOW_POINTS_MS);
    const b = window.setTimeout(() => setStep(2), SORT_MS);
    return () => [a, b].forEach(window.clearTimeout);
  }, []);
  useEffect(() => {
    if (rolled && r) playSound(r.results.some((x) => x.correct) ? "win" : "pop");
  }, [rolled, r]);
  if (!r) return null;

  const n = r.results.length;
  const right = r.results.filter((x) => x.correct).length;
  // Before: last round's order (by total before this round). After: by total now. Ties share a place.
  const before = [...r.results].sort((a, b) => b.total - b.points - (a.total - a.points) || a.nickname.localeCompare(b.nickname));
  const after = [...r.results].sort((a, b) => b.total - a.total || b.streak - a.streak || a.nickname.localeCompare(b.nickname));
  const placeBefore = new Map(before.map((p, i) => [p.playerId, sharedPlaces(before.map((x) => ({ score: x.total - x.points })))[i]]));
  const placesAfter = sharedPlaces(after.map((x) => ({ score: x.total })));
  const rows = step >= 2 ? after : before;
  const compact = compactBoard(n);
  // More than 12: 4 columns and smaller digits, so all 24 fit on one screen.
  const crowded = n > 12;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[calc(1.5rem*var(--fit-c,1))] text-center lg:flex-row lg:gap-10">
      <div className="flex flex-1 flex-col items-center gap-[calc(1rem*var(--fit-c,1))]">
        <p className="text-xl font-extrabold text-muted-foreground lg:text-3xl">
          From <span className="font-display text-foreground tabular-nums">{r.previous}</span> to…
        </p>
        <RollingNumber key={game.round} to={r.next} size={crowded ? "md" : "lg"} onLock={() => playSound("tick")} onDone={() => setRolled(true)} />
        <div className="flex h-24 items-center lg:h-32">
          {rolled && <DirectionStamp direction={r.direction} className="text-5xl lg:text-7xl" />}
        </div>
        {rolled && (
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-black lg:text-4xl" data-testid="called-it">
            {right === 0 ? "Nobody called it! 😮" : `${right} of ${n} called it`}
          </motion.p>
        )}
      </div>

      <div className={cn("w-full", crowded ? "lg:w-[46rem] xl:w-[56rem]" : compact ? "lg:w-[38rem] xl:w-[50rem]" : "lg:w-[28rem] xl:w-[36rem]")}>
        <ol className={cn("grid w-full", compact ? "gap-1.5" : "gap-2", crowded ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1")} aria-label="Leaderboard" data-sorted={step >= 2}>
          {rows.map((p, i) => {
            const place = step >= 2 ? placesAfter[i] : placeBefore.get(p.playerId)!;
            const move = step >= 2 ? placeBefore.get(p.playerId)! - placesAfter[i] : 0;
            return (
              <motion.li
                key={p.playerId}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: step >= 2 ? 0 : i * Math.min(0.05, 0.8 / n), layout: { type: "spring", stiffness: 140, damping: 20 } }}
                className={cn(
                  "flex items-center rounded-2xl border-2 text-left transition-colors duration-500",
                  compact ? "gap-1.5 px-1.5 py-1" : "gap-2 px-2.5 py-1.5",
                  step >= 1 && p.correct ? "border-success bg-success/10" : step >= 1 && p.choice !== null ? "border-guava/60 bg-guava/5" : "border-border bg-card",
                )}
                data-player={p.nickname}
                data-correct={step >= 1 ? p.correct : undefined}
              >
                <span className={cn("shrink-0 text-center font-black text-muted-foreground", compact ? "w-5 text-sm" : "w-6")}>{place}</span>
                <AvatarBubble avatar={p.avatar} size={compact ? "xs" : "sm"} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className={cn("block truncate font-extrabold", compact ? "text-sm lg:text-base" : "text-lg lg:text-xl")}>{p.nickname}</span>
                  <span className={cn("flex items-center gap-1.5 overflow-hidden font-bold whitespace-nowrap text-muted-foreground tabular-nums", compact ? "text-xs" : "text-sm")}>
                    {crowded ? p.total : `${p.total} pts`}
                    {/* Many players: the streak as a small flame here instead of a badge. */}
                    {compact && step >= 1 && p.streak > 0 && (
                      <span className={cn("inline-flex shrink-0 items-center font-black", isMilestone(p.streak) ? "text-mango" : "text-guava")} aria-label={`${p.streak} in a row, ${p.multiplier}x`}>
                        <Flame className="size-3 shrink-0 fill-current" />
                        {p.streak}
                        {/* Four columns: no room for the multiplier (it's on each phone). */}
                        {p.multiplier > 1 && !crowded && ` ${p.multiplier}x`}
                      </span>
                    )}
                    {move !== 0 && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className={move > 0 ? "text-success" : "text-guava"}>
                        {move > 0 ? `▲${move}` : `▼${-move}`}
                      </motion.span>
                    )}
                  </span>
                </span>
                {step >= 1 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex shrink-0 items-center gap-1">
                    {p.correct && !compact ? <StreakBadge streak={p.streak} multiplier={p.multiplier} milestone={isMilestone(p.streak)} /> : null}
                    <span className={cn("font-black tabular-nums", p.correct ? "text-success" : "text-muted-foreground")}>
                      {p.correct ? `+${p.points}` : p.choice === null ? <Minus className="size-5" /> : <X className="size-5 text-guava" />}
                    </span>
                  </motion.span>
                )}
              </motion.li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/* ─── Phone ────────────────────────────────────────────────────────────── */

/** Score, streak and what the next right call is worth. */
function MyStats({ score, streak }: { score: number; streak: number }) {
  const next = rushPoints(streak + 1);
  return (
    <div className="flex w-full items-center justify-between gap-2 text-sm font-extrabold">
      <span className="rounded-full bg-card px-3 py-1.5 tabular-nums">
        <Trophy className="mr-1 inline size-4 text-mango" />
        {score} pts
      </span>
      {streak > 0 ? <StreakBadge streak={streak} multiplier={rushMultiplier(streak)} className="px-3 py-1.5" /> : <span className="text-muted-foreground">No streak yet</span>}
      <span className="rounded-full bg-card px-3 py-1.5 tabular-nums" aria-label={`Next right call is worth ${next} points`}>
        Next <span className="text-success">+{next}</span>
      </span>
    </div>
  );
}

export function RushPad({ game, me, uid, submit, submitting }: PlayerQuestionProps) {
  const pub = game.round_data as RushRound;
  const seconds = useSecondsLeft(game);
  useFinalTicks(seconds, game.paused);
  const [picked, setPicked] = useState<RushChoice | null>(null);
  const allowed = rushAllowed(pub.current);
  const streak = pub.onStreak.find((p) => p.playerId === uid)?.streak ?? 0;
  const open = !game.paused && !submitting && picked === null;

  function choose(choice: RushChoice) {
    if (!open || !allowed[choice]) return;
    setPicked(choice);
    navigator.vibrate?.(15);
    void submit({ choice }).then((res) => {
      if (!res) setPicked(null);
    });
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <MyStats score={me?.gameScore ?? 0} streak={streak} />
      <div className="space-y-2">
        <p className="text-lg font-extrabold text-muted-foreground">
          Higher or lower than… <span className={cn("tabular-nums", seconds !== null && seconds <= 3 ? "text-guava" : "text-mango")}>{seconds ?? 0}s</span>
        </p>
        <NumberTiles digits={String(pub.current)} size="md" label={`Current number ${pub.current}`} />
      </div>
      {/* Side by side: LOWER on the left, HIGHER on the right (like a number line). */}
      <div className="grid w-full grid-cols-2 gap-4">
        <ChoiceButton choice="lower" stacked disabled={!open || !allowed.lower} selected={picked === "lower"} onClick={() => choose("lower")} className="min-h-44 px-2" note={allowed.lower ? undefined : "Nothing is below 100"} />
        <ChoiceButton choice="higher" stacked disabled={!open || !allowed.higher} selected={picked === "higher"} onClick={() => choose("higher")} className="min-h-44 px-2" note={allowed.higher ? undefined : "Nothing is above 999"} />
      </div>
    </div>
  );
}

export function RushLocked({ game, me, uid }: PlayerQuestionProps) {
  const pub = game.round_data as RushRound | null;
  const choice = (me?.answer as { choice?: RushChoice } | null)?.choice;
  const streak = pub?.onStreak.find((p) => p.playerId === uid)?.streak ?? 0;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <MyStats score={me?.gameScore ?? 0} streak={streak} />
      <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 12 }}>
        <Lock className="size-14 text-success" />
      </motion.span>
      {choice ? (
        <p className="flex items-center gap-2 text-3xl font-black">
          {CHOICE_LABEL[choice]} <ChoiceIcon choice={choice} className={cn("size-9", choice === "higher" ? "text-success" : "text-mango")} /> locked in!
        </p>
      ) : (
        <p className="text-3xl font-black">Locked in!</p>
      )}
      {pub && <p className="text-lg font-bold text-muted-foreground">than {pub.current}</p>}
      <p className="text-muted-foreground">
        Waiting for the others… {game.submitted} / {game.eligible} locked in
      </p>
    </div>
  );
}

export function RushResult({ game, me, uid }: { game: PublicGameState; me: { gameScore: number; rank: number | null; round: number }; uid: string }) {
  const r = game.reveal as RushReveal | null;
  const mine = r?.results.find((x) => x.playerId === uid);
  useEffect(() => {
    if (mine) playSound(mine.correct ? "win" : "pop");
  }, [mine]);
  if (!r) return null;
  const milestone = mine?.correct && isMilestone(mine.streak);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 14 }} className="flex flex-col items-center gap-2">
        <span className={cn("grid size-16 place-items-center rounded-full", mine?.correct ? "bg-success text-white" : "bg-guava/20 text-guava")}>
          {mine?.correct ? <Check className="size-10" strokeWidth={3} /> : <X className="size-10" strokeWidth={3} />}
        </span>
        <p className={cn("text-4xl font-black", mine?.correct ? "text-success" : "text-guava")}>
          {mine?.choice == null ? "No prediction" : mine.correct ? "Nice call!" : "Wrong way!"}
        </p>
        <p className="text-5xl font-black tabular-nums">{mine?.points ? `+${mine.points}` : "0"}</p>
      </motion.div>
      <div className="flex items-center gap-3 text-2xl font-black tabular-nums">
        <span className="text-muted-foreground">{r.previous}</span>
        <ChoiceIcon choice={r.direction} className={cn("size-9", r.direction === "higher" ? "text-success" : "text-mango")} />
        <span>{r.next}</span>
      </div>
      {mine && mine.streak > 0 ? (
        <div className="flex flex-col items-center gap-4">
          <StreakBadge streak={mine.streak} multiplier={mine.multiplier} milestone={milestone} className="px-4 py-1.5 text-lg" />
          {milestone && (
            <motion.p initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-lg font-black text-mango" data-testid="milestone">
              {mine.multiplier}x multiplier unlocked!
            </motion.p>
          )}
        </div>
      ) : (
        <p className="font-bold text-muted-foreground">{mine?.choice == null ? "Streak reset. Be quicker next time!" : "Streak reset."}</p>
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
