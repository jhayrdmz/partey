import { motion } from "motion/react";
import type { DisplayStateDoc } from "@shared/types";
import { GameArt } from "@/features/games/GameArt";
import { getGame } from "@/features/games/registry";
import { useServerCountdown } from "@/hooks/useServerClock";

export function DisplayGameIntro({ state }: { state: DisplayStateDoc }) {
  const g = state.game;
  const left = useServerCountdown(g?.phaseEndsAtMs, { paused: g?.paused, pausedRemainingMs: g?.remainingMs });
  if (!state.gameId) return null;
  const game = getGame(state.gameId);
  return (
    <div className="grid min-h-dvh content-center items-center gap-5 p-4 sm:gap-10 sm:p-6 lg:grid-cols-2 lg:content-normal lg:p-16">
      <motion.div initial={{ scale: 0.7, rotate: -6, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 120, damping: 12 }}>
        <GameArt game={game} size="lg" className="aspect-[16/9] w-full rounded-3xl shadow-2xl shadow-primary/30 sm:aspect-[4/3] sm:rounded-[2rem] [&>span]:text-[5rem] sm:[&>span]:text-[8rem] lg:[&>span]:text-[12rem]" />
      </motion.div>
      <div className="space-y-5 sm:space-y-8">
        <motion.div initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
          {state.gameNumber && state.totalGames && (
            <p className="text-lg font-bold text-muted-foreground sm:text-2xl lg:text-3xl">
              Game {state.gameNumber} of {state.totalGames}
            </p>
          )}
          <h1 className="text-4xl font-extrabold leading-none sm:text-6xl lg:text-8xl">{game.meta.name}</h1>
          <p className="mt-2 text-xl text-mango sm:mt-3 sm:text-2xl lg:text-3xl">{game.meta.tagline}</p>
        </motion.div>
        <ol className="space-y-2.5 sm:space-y-4">
          {game.howToPlay.map((step, i) => (
            <motion.li
              key={step}
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 + i * 0.15 }}
              className="glass flex items-center gap-3 rounded-2xl border p-3 text-base sm:gap-5 sm:p-5 sm:text-xl lg:text-2xl"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-lg font-extrabold sm:size-12 sm:text-2xl">{i + 1}</span>
              {step}
            </motion.li>
          ))}
        </ol>
        <div className="flex items-center gap-4">
          <p className="text-base font-bold text-muted-foreground sm:text-xl">Check your phones — get ready!</p>
          {left !== null && (
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-2xl font-black tabular-nums sm:size-16 sm:text-3xl">
              {g?.paused ? "II" : Math.ceil(left / 1000)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
