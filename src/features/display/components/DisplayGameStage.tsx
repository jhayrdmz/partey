import { Pause, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { DisplayStateDoc } from "@shared/types";
import type { PublicGameState } from "@shared/engine";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import { useGameViews } from "@/features/games/engine/useGameViews";
import { getGame } from "@/features/games/registry";
import { TimerBar } from "@/features/games/shared/TimerBar";
import { useServerCountdown } from "@/hooks/useServerClock";
import { DisplayGameIntro } from "./DisplayGameIntro";

function RoundHeader({ state, game }: { state: DisplayStateDoc; game: PublicGameState }) {
  const meta = state.gameId ? getGame(state.gameId) : null;
  return (
    <header className="flex flex-wrap items-center gap-x-8 gap-y-4">
      <div className="flex items-center gap-4">
        {meta && <span className="text-5xl">{meta.art.emoji}</span>}
        <div>
          <p className="text-2xl font-extrabold">{meta?.meta.name}</p>
          <p className="text-xl font-semibold text-muted-foreground">
            Round {game.round} of {game.totalRounds}
            {state.gameNumber && state.totalGames ? ` · Game ${state.gameNumber}/${state.totalGames}` : ""}
          </p>
        </div>
      </div>
      {game.phase === "question" && (
        <>
          {meta?.showTimer === false ? <div className="flex-1" /> : <TimerBar endsAtMs={game.phaseEndsAtMs} durationMs={game.phaseDurationMs} paused={game.paused} remainingMs={game.remainingMs} size="lg" className="min-w-80 flex-1" />}
          <span className="flex items-center gap-2 rounded-full bg-secondary px-5 py-3 text-2xl font-extrabold tabular-nums">
            <Users className="size-7" /> {game.submitted}/{game.eligible}
          </span>
        </>
      )}
    </header>
  );
}

function StandingsStrip({ game }: { game: PublicGameState }) {
  const left = useServerCountdown(game.phaseEndsAtMs, { paused: game.paused, pausedRemainingMs: game.remainingMs });
  const last = game.round >= game.totalRounds;
  return (
    <footer className="glass flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border px-6 py-4">
      <span className="text-xl font-extrabold text-muted-foreground">Top scores</span>
      <ol className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2">
        {game.standings.slice(0, 5).map((s, i) => (
          <motion.li layout key={s.playerId} className="flex items-center gap-2 text-xl">
            <span className="font-black text-muted-foreground">{i + 1}</span>
            <AvatarBubble avatar={s.avatar} size="xs" />
            <span className="font-bold">{s.nickname}</span>
            <span className="font-black text-mango tabular-nums">{s.score}</span>
          </motion.li>
        ))}
      </ol>
      {left !== null && (
        <span className="text-lg font-semibold text-muted-foreground tabular-nums">
          {game.paused ? "Paused" : `${last ? "Final results" : "Next round"} in ${Math.ceil(left / 1000)}s`}
        </span>
      )}
    </footer>
  );
}

/** Big-screen game presentation: intro → question → reveal, driven by public state only. */
export function DisplayGameStage({ state }: { state: DisplayStateDoc }) {
  const game = state.game;
  const views = useGameViews(state.gameId);
  if (!game) return null;
  if (game.phase === "intro") return <DisplayGameIntro state={state} />;

  return (
    <div className="relative flex min-h-dvh flex-col gap-8 p-6 lg:p-12">
      <RoundHeader state={state} game={game} />
      <AnimatePresence mode="wait">
        <motion.div
          key={`${game.round}-${game.phase}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          className="flex flex-1 flex-col"
        >
          {views ? game.phase === "question" ? <views.DisplayQuestion game={game} /> : <views.DisplayReveal game={game} /> : null}
        </motion.div>
      </AnimatePresence>
      {game.phase === "reveal" && <StandingsStrip game={game} />}
      {game.paused && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-background/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Pause className="size-24 text-mango" />
            <p className="text-6xl font-black">Paused</p>
            <p className="text-2xl text-muted-foreground">The host will resume the game shortly.</p>
          </div>
        </div>
      )}
    </div>
  );
}
