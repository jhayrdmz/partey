import { Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { DisplayStateDoc } from "@shared/types";
import type { PublicGameState } from "@shared/engine";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import { useGameViews } from "@/features/games/engine/useGameViews";
import { GameThumb } from "@/features/games/GameArt";
import { getGame } from "@/features/games/registry";
import { TimerBar } from "@/features/games/shared/TimerBar";
import { PausedOverlay } from "@/features/games/shared/PausedOverlay";
import { useServerCountdown } from "@/hooks/useServerClock";
import { DisplayGameIntro } from "./DisplayGameIntro";
import { FitToScreen } from "./FitToScreen";

function RoundHeader({ state, game }: { state: DisplayStateDoc; game: PublicGameState }) {
  const meta = state.gameId ? getGame(state.gameId) : null;
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 sm:gap-x-8 sm:gap-y-4 short:gap-y-2">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        {meta && <GameThumb game={meta} className="size-12 sm:size-16 short:size-10" />}
        <div className="min-w-0">
          <p className="truncate text-xl font-extrabold sm:text-2xl short:text-lg">{meta?.meta.name}</p>
          <p className="text-base font-semibold text-muted-foreground sm:text-xl short:text-sm">
            {game.roundLabel ?? `Round ${game.round} of ${game.totalRounds}`}
            {state.gameNumber && state.totalGames ? ` · Game ${state.gameNumber}/${state.totalGames}` : ""}
          </p>
        </div>
      </div>
      {game.phase === "question" && (
        <>
          {meta?.showTimer === false ? <div className="hidden flex-1 sm:block" /> : <TimerBar endsAtMs={game.phaseEndsAtMs} durationMs={game.phaseDurationMs} paused={game.paused} remainingMs={game.remainingMs} size="lg" className="order-last basis-full sm:order-none sm:min-w-80 sm:flex-1 sm:basis-auto" />}
          {/* A one-person turn (e.g. The Impostor's clue) has no meaningful "answered" count. */}
          {game.eligible > 1 && (
            <span className="ml-auto flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-lg font-extrabold tabular-nums sm:ml-0 sm:px-5 sm:py-3 sm:text-2xl short:py-1.5 short:text-lg">
              <Users className="size-5 sm:size-7 short:size-5" /> {game.submitted}/{game.eligible}
            </span>
          )}
        </>
      )}
    </header>
  );
}

function StandingsStrip({ game }: { game: PublicGameState }) {
  const left = useServerCountdown(game.phaseEndsAtMs, { paused: game.paused, pausedRemainingMs: game.remainingMs });
  const last = game.round >= game.totalRounds;
  return (
    <footer className="glass flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border px-4 py-3 sm:gap-y-3 sm:px-6 sm:py-4 short:py-2">
      <span className="text-base font-extrabold text-muted-foreground sm:text-xl short:text-base">Top scores</span>
      <ol className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2">
        {game.standings.slice(0, 5).map((s, i) => (
          <motion.li layout key={s.playerId} className="flex items-center gap-2 text-base sm:text-xl short:text-base">
            <span className="font-black text-muted-foreground">{i + 1}</span>
            <AvatarBubble avatar={s.avatar} size="xs" />
            <span className="font-bold">{s.nickname}</span>
            <span className="font-black text-mango tabular-nums">{s.score}</span>
          </motion.li>
        ))}
      </ol>
      {left !== null && (
        <span className="text-sm font-semibold text-muted-foreground tabular-nums sm:text-lg short:text-sm">
          {game.paused ? "Paused" : `${last ? "Final results" : "Next round"} in ${Math.ceil(left / 1000)}s`}
        </span>
      )}
    </footer>
  );
}

/** Big-screen game presentation: intro → question → reveal, driven by public state only. */
export function DisplayGameStage({ state, roomId }: { state: DisplayStateDoc; roomId: string }) {
  const game = state.game;
  const views = useGameViews(state.gameId);
  if (!game) return null;
  if (game.phase === "intro") return <DisplayGameIntro state={state} />;

  return (
    // Exactly one screen tall: the display has no scrolling or controls during a game, so
    // the content shrinks to fit (FitToScreen) instead of overflowing.
    <div className="relative flex h-dvh flex-col gap-4 overflow-hidden p-4 sm:gap-6 sm:p-6 lg:gap-8 lg:p-12 short:gap-3 short:p-3">
      <RoundHeader state={state} game={game} />
      <AnimatePresence mode="wait">
        <motion.div
          key={`${game.round}-${game.phase}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <FitToScreen watch={game.reveal}>
            {views ? game.phase === "question" ? <views.DisplayQuestion game={game} roomId={roomId} /> : <views.DisplayReveal game={game} roomId={roomId} /> : null}
          </FitToScreen>
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>
        {game.phase === "reveal" && (!state.gameId || getGame(state.gameId).showStandings !== false) && (
          // Grows up from the bottom edge; the content above shrinks to make room as it does.
          <motion.div
            key="standings"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="-mt-4 shrink-0 overflow-hidden sm:-mt-6 lg:-mt-8 short:-mt-3"
          >
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="pt-4 sm:pt-6 lg:pt-8 short:pt-3">
              <StandingsStrip game={game} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <PausedOverlay paused={game.paused} />
    </div>
  );
}
