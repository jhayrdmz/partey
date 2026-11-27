import { useEffect, useRef, useState } from "react";
import { Flame, Lock, Trophy, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { CupReveal, CupRound, PublicGameState } from "@shared/engine";
import { cupSpeedTier } from "@shared/gameSettings";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import { useServerCountdown } from "@/hooks/useServerClock";
import { playSound } from "@/utils/sound";
import { cn } from "@/utils/cn";
import type { PlayerQuestionProps } from "../engine/views";
import { CupArt, CupTable } from "./cups";
import { arrangements, useCupTimeline, useElapsed, type CupPose, type CupStage } from "./timeline";

const STAGE_TEXT: Record<CupStage, string> = {
  announce: "Watch the ball!",
  peek: "Here's the ball…",
  shuffle: "Shuffling…",
  guess: "Where's the ball?",
};

/** True on the first round of a faster speed tier (30%, 60% and 80% of the way through the game). */
function spedUp(game: PublicGameState) {
  const tier = (game.round_data as CupRound).speedTier ?? 0;
  return tier > 0 && game.round > 1 && tier > cupSpeedTier(game.round - 1, game.totalRounds);
}

/** "Faster!" before the shuffle of a sped-up round. */
function SpeedUp({ className }: { className?: string }) {
  return (
    <motion.span
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: [1, 1.12, 1], opacity: 1 }}
      transition={{ scale: { repeat: Infinity, duration: 0.8 } }}
      className={cn("inline-flex items-center gap-1 rounded-full bg-calamansi px-3 py-1 font-black text-black", className)}
      data-testid="speed-up"
    >
      <Zap className="size-[1em] fill-current" /> Faster!
    </motion.span>
  );
}

/** Seconds left to pick (the round's deadline is the end of the picking time). */
function useGuessSeconds(game: PublicGameState) {
  const left = useServerCountdown(game.phaseEndsAtMs, { paused: game.paused, pausedRemainingMs: game.remainingMs });
  return left === null ? null : Math.ceil(left / 1000);
}

/** Sounds as the round moves on (none for the stage a screen opened in). */
function useStageSounds(stage: CupStage, paused: boolean) {
  const prev = useRef(stage);
  useEffect(() => {
    if (prev.current === stage) return;
    prev.current = stage;
    if (paused) return;
    if (stage === "peek") playSound("pop");
    if (stage === "guess") playSound("start");
  }, [stage, paused]);
}

/* ─── Big screen ───────────────────────────────────────────────────────── */

export function DisplayCups({ game }: { game: PublicGameState }) {
  const { pub, poses, stage, swap } = useCupTimeline(game);
  const seconds = useGuessSeconds(game);
  useStageSounds(stage, game.paused);
  const guessing = stage === "guess";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[calc(2rem*var(--fit-c,1))] text-center">
      <div className="flex h-28 flex-col items-center justify-center gap-2 lg:h-40">
        <AnimatePresence mode="wait">
          <motion.p
            key={stage}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            className="font-display text-5xl font-black lg:text-7xl"
            data-stage={stage}
          >
            {STAGE_TEXT[stage]}
          </motion.p>
        </AnimatePresence>
        <p className="text-xl font-bold text-muted-foreground tabular-nums lg:text-3xl">
          {guessing ? (
            <>
              <span className="text-mango">{seconds ?? 0}s</span> · {game.submitted} / {game.eligible} picked
            </>
          ) : stage === "shuffle" ? (
            `${pub.swaps.length} swaps`
          ) : spedUp(game) ? (
            <SpeedUp className="text-2xl lg:text-4xl" />
          ) : (
            "Keep your eyes on the yellow ball"
          )}
        </p>
      </div>
      <CupTable
        poses={poses}
        ballCup={pub.ballStart}
        className="max-w-[60rem]"
        labels={guessing ? [0, 1, 2].map((slot) => <SlotNumber key={slot} slot={slot} />) : undefined}
      />
      {/* Keeps the cups from jumping when the numbers appear (number badge + margin). */}
      {!guessing && <div aria-hidden className="h-[calc(3.5rem+0.75rem)] lg:h-[calc(5rem+0.75rem)]" data-swaps-done={swap} />}
    </div>
  );
}

function SlotNumber({ slot }: { slot: number }) {
  return (
    <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grid size-14 place-items-center rounded-full bg-card text-3xl font-black lg:size-20 lg:text-5xl">
      {slot + 1}
    </motion.span>
  );
}

/** The wrong cups come up first, then the one with the ball. */
const LIFT_WRONG_MS = 500;
const LIFT_BALL_MS = 1_400;

export function DisplayCupReveal({ game }: { game: PublicGameState }) {
  const r = game.reveal as CupReveal | null;
  const pub = game.round_data as CupRound | null;
  // Mounted once per round (keyed in views.tsx): the lifts play from the start each reveal.
  const t = useElapsed(LIFT_BALL_MS + 400);
  const step = t >= LIFT_BALL_MS ? 2 : t >= LIFT_WRONG_MS ? 1 : 0;
  useEffect(() => {
    if (step === 2 && r) playSound(r.results.some((x) => x.correct) ? "win" : "pop");
  }, [step, r]);
  if (!r || !pub) return null;
  const finalOrder = arrangements(pub.swaps)[pub.swaps.length];
  const lift = (from: number) => Math.min(1, Math.max(0, (t - from) / 350));
  const poses: CupPose[] = [0, 1, 2].map((cup) => {
    const slot = finalOrder.indexOf(cup);
    return { x: slot, depth: 0, lift: slot === r.ballSlot ? lift(LIFT_BALL_MS) : lift(LIFT_WRONG_MS) * 0.55 };
  });
  const winners = r.results.filter((x) => x.correct);

  return (
    // Cups on the left, who found it on the right (stacked on narrow screens), like Perfectly Hold's reveal.
    <div className="flex flex-1 flex-col items-center justify-center gap-[calc(1.5rem*var(--fit-c,1))] text-center lg:flex-row lg:gap-10">
      <div className="flex w-full flex-1 flex-col items-center gap-[calc(1rem*var(--fit-c,1))]">
        <p className="font-display text-5xl font-black lg:text-7xl">{step < 2 ? "Where's the ball?" : `Cup ${r.ballSlot + 1}!`}</p>
        <CupTable
          poses={poses}
          ballCup={pub.ballStart}
          highlight={step === 2 ? r.ballSlot : null}
          className="[--cup:min(20vw,12rem)] lg:[--cup:min(13vw,12rem)]"
          labels={[0, 1, 2].map((slot) => (
            <SlotPicks key={slot} slot={slot} reveal={r} />
          ))}
        />
      </div>
      <div className="w-full lg:w-[26rem] xl:w-[34rem]">
        {step === 2 && (
          <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-3">
            {winners.length ? (
              <>
                <p className="flex items-center justify-center gap-2 text-2xl font-black text-success lg:text-4xl">
                  <Trophy className="size-8 lg:size-10" /> {winners.length === 1 ? "1 player found it" : `${winners.length} players found it`}
                </p>
                <p className="text-xl font-black text-mango lg:text-3xl">+100 each</p>
                <StreakLine winners={winners} />
                {/* Many winners: faces only. */}
                <ul className={cn("flex flex-wrap justify-center", winners.length > 10 ? "gap-1" : "gap-2")} aria-label="Found the ball">
                  {winners.map((w) =>
                    winners.length > 10 ? (
                      <li key={w.playerId} title={w.nickname} aria-label={w.nickname}>
                        <AvatarBubble avatar={w.avatar} size="sm" />
                      </li>
                    ) : (
                      <li key={w.playerId} className="flex items-center gap-2 rounded-full bg-card py-1 pr-4 pl-1 text-lg font-extrabold lg:text-xl">
                        <AvatarBubble avatar={w.avatar} size="sm" /> {w.nickname}
                        {w.streak > 1 && (
                          <span className="inline-flex items-center text-guava" aria-label={`${w.streak} in a row`}>
                            <Flame className="size-5 fill-current" />
                            {w.streak}
                          </span>
                        )}
                      </li>
                    ),
                  )}
                </ul>
              </>
            ) : (
              <p className="text-2xl font-black text-muted-foreground lg:text-4xl">Nobody found it! 😮</p>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

/** The longest run of right picks this round, e.g. "🔥 Ana & Ben: 3 in a row · +50". */
function StreakLine({ winners }: { winners: CupReveal["results"] }) {
  const best = Math.max(0, ...winners.map((w) => w.streak));
  if (best < 2) return null;
  const top = winners.filter((w) => w.streak === best);
  const names = top.length <= 3 ? top.map((w) => w.nickname).join(" & ") : `${top.length} players`;
  return (
    <p className="flex items-center justify-center gap-2 text-xl font-black text-guava lg:text-2xl" data-testid="streak-line">
      <Flame className="size-6 shrink-0 fill-current lg:size-8" /> {names}: {best} in a row · +{top[0].bonus} bonus
    </p>
  );
}

/** Who picked this cup: a count and up to 5 faces. */
function SlotPicks({ slot, reveal }: { slot: number; reveal: CupReveal }) {
  const pickers = reveal.results.filter((x) => x.choice === slot);
  return (
    <>
      <span className="text-2xl font-black lg:text-4xl">{slot + 1}</span>
      <span className="flex -space-x-2" aria-label={`${pickers.length} picked cup ${slot + 1}`}>
        {pickers.slice(0, 5).map((p) => (
          <AvatarBubble key={p.playerId} avatar={p.avatar} size="sm" />
        ))}
        {pickers.length > 5 && <span className="grid size-8 place-items-center rounded-full bg-card text-sm font-black">+{pickers.length - 5}</span>}
      </span>
      <span className="text-sm font-bold text-muted-foreground lg:text-lg" data-picks={slot}>
        {pickers.length} {pickers.length === 1 ? "pick" : "picks"}
      </span>
    </>
  );
}

/* ─── Phone ────────────────────────────────────────────────────────────── */

const PHONE_TEXT: Record<CupStage, string> = {
  announce: "Watch the ball!",
  peek: "Here's the ball…",
  shuffle: "Follow the ball…",
  guess: "Where's the ball?",
};

/**
 * The shuffle, played on the phone itself from the round data (the same swaps and timing the big
 * screen uses), so players can play without a TV. Once the cups stop, tap one; it can't be changed.
 */
export function CupPad({ game, submit, submitting }: PlayerQuestionProps) {
  const { pub, poses, stage } = useCupTimeline(game);
  const seconds = useGuessSeconds(game);
  const [picked, setPicked] = useState<number | null>(null);
  useStageSounds(stage, game.paused);
  const open = stage === "guess" && !game.paused && !submitting;

  function choose(slot: number) {
    if (!open || picked !== null) return;
    setPicked(slot);
    navigator.vibrate?.(15);
    void submit({ choice: slot }).then((res) => {
      // Not accepted (e.g. too early or the round ended): the error is toasted; let them pick again.
      if (!res) setPicked(null);
    });
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="min-h-20 space-y-1">
        <p className="text-3xl font-black" data-stage={stage}>
          {PHONE_TEXT[stage]}
        </p>
        <p className="font-bold text-muted-foreground tabular-nums">
          {stage === "guess" ? (
            <>
              Tap a cup · <span className="text-mango">{seconds ?? 0}s</span>
            </>
          ) : stage === "shuffle" ? (
            `${pub.swaps.length} swaps`
          ) : spedUp(game) ? (
            <SpeedUp />
          ) : (
            "Keep your eyes on the yellow ball"
          )}
        </p>
      </div>
      <CupTable
        poses={poses}
        ballCup={pub.ballStart}
        className="[--cup:min(25vw,8.5rem)]"
        pick={{ open, picked, onPick: choose }}
        labels={[0, 1, 2].map((slot) => (
          <span key={slot} className={cn("text-3xl font-black", stage !== "guess" && "opacity-30")}>
            {slot + 1}
          </span>
        ))}
      />
    </div>
  );
}

export function CupLocked({ game, me }: PlayerQuestionProps) {
  const choice = (me?.answer as { choice?: number } | null)?.choice;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 12 }}>
        <Lock className="size-14 text-success" />
      </motion.span>
      <p className="text-3xl font-black">{choice !== undefined ? `Cup ${choice + 1} locked in!` : "Locked in!"}</p>
      <MiniCups mark={choice ?? null} />
      <p className="text-muted-foreground">
        Waiting for the others… {game.submitted} / {game.eligible} picked
      </p>
    </div>
  );
}

/** Three small cups; `mark` = your pick, `ball` = where it was (reveal). */
function MiniCups({ mark, ball }: { mark: number | null; ball?: number }) {
  return (
    <div className="grid w-full max-w-xs grid-cols-3 gap-3">
      {[0, 1, 2].map((slot) => (
        <div key={slot} className={cn("flex flex-col items-center gap-1 rounded-2xl border-4 p-2", mark === slot ? "border-mango bg-mango/15" : "border-transparent")}>
          {/* Headroom (when a ball is shown) so the lifted cup clears the text above. */}
          <div className={cn("relative w-full", ball !== undefined && "pt-[50%]")}>
            {ball === slot && <span className="absolute bottom-[4%] left-1/2 aspect-square w-[38%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fffbd1,#ffe23a_35%,#f5b800_80%)]" data-testid="mini-ball" />}
            <CupArt className={cn("relative w-full transition-transform", ball === slot && "-translate-y-[45%]")} />
          </div>
          <span className="text-xl font-black">{slot + 1}</span>
        </div>
      ))}
    </div>
  );
}

export function CupResult({ game, me, uid }: { game: PublicGameState; me: { gameScore: number; rank: number | null; round: number }; uid: string }) {
  const r = game.reveal as CupReveal | null;
  const mine = r?.results.find((x) => x.playerId === uid);
  useEffect(() => {
    if (mine) playSound(mine.correct ? "win" : "pop");
  }, [mine]);
  if (!r) return null;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 14 }} className="space-y-1">
        <p className={cn("text-4xl font-black", mine?.correct ? "text-success" : "text-guava")}>
          {mine?.choice == null ? "No pick this round" : mine.correct ? "Found it!" : "Missed!"}
        </p>
        <p className="text-5xl font-black tabular-nums">{mine?.points ? `+${mine.points}` : "0"}</p>
        {mine && mine.streak > 1 && (
          <p className="flex items-center justify-center gap-1 font-black text-guava">
            <Flame className="size-5 fill-current" /> {mine.streak} in a row · +{mine.bonus} streak bonus
          </p>
        )}
        <p className="font-bold text-muted-foreground">The ball was under cup {r.ballSlot + 1}</p>
      </motion.div>
      <MiniCups mark={mine?.choice ?? null} ball={r.ballSlot} />
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
