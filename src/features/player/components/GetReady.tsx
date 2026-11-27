import { motion } from "motion/react";
import type { DisplayStateDoc } from "@shared/types";
import { BottomBar } from "@/components/shared/BottomBar";
import { GameArt } from "@/features/games/GameArt";
import { TimerBar } from "@/features/games/shared/TimerBar";
import { getGame } from "@/features/games/registry";
import { useServerCountdown } from "@/hooks/useServerClock";

export function GetReady({ state }: { state: DisplayStateDoc }) {
  const g = state.game;
  const left = useServerCountdown(g?.phaseEndsAtMs, { paused: g?.paused, pausedRemainingMs: g?.remainingMs });
  if (!state.gameId) return null;
  const game = getGame(state.gameId);
  return (
    <div className="flex flex-1 flex-col gap-6">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <GameArt game={game} className="aspect-video w-full rounded-3xl" />
      </motion.div>
      <div className="space-y-1 text-center">
        {state.gameNumber && state.totalGames && (
          <p className="text-sm font-bold text-muted-foreground">
            Game {state.gameNumber} of {state.totalGames}
          </p>
        )}
        {/* One line on any phone (longest: "Guess the Majority"), with the logo's dot. */}
        <h1 className="text-[min(7.5vw,1.875rem)] font-extrabold whitespace-nowrap">
          {game.meta.name}
          <span className="text-guava">.</span>
        </h1>
        <p className="text-muted-foreground">{game.meta.tagline}</p>
      </div>
      <ol className="space-y-3">
        {game.howToPlay.map((step, i) => (
          <motion.li
            key={step}
            initial={{ x: -16, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.15 + i * 0.1 }}
            className="flex gap-3 rounded-2xl bg-card p-4"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-extrabold text-black">{i + 1}</span>
            <span className="pt-1">{step}</span>
          </motion.li>
        ))}
      </ol>
      {/* Pinned to the bottom so the countdown stays in view while players read the rules. */}
      <BottomBar always className="mt-auto space-y-2 sm:-mx-4 sm:px-4">
        <p className="text-center font-bold text-mango">
          {left === null ? "Get ready — the game is about to begin!" : g?.paused ? "Paused — hang tight" : "Get ready! Starting in…"}
        </p>
        {g && left !== null && <TimerBar endsAtMs={g.phaseEndsAtMs} durationMs={g.phaseDurationMs} paused={g.paused} remainingMs={g.remainingMs} />}
      </BottomBar>
    </div>
  );
}
