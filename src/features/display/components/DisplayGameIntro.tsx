import { motion } from "motion/react";
import type { DisplayStateDoc } from "@shared/types";
import { GameArt } from "@/features/games/GameArt";
import { getGame } from "@/features/games/registry";

export function DisplayGameIntro({ state }: { state: DisplayStateDoc }) {
  if (!state.gameId) return null;
  const game = getGame(state.gameId);
  return (
    <div className="grid min-h-dvh items-center gap-10 p-6 lg:grid-cols-2 lg:p-16">
      <motion.div initial={{ scale: 0.7, rotate: -6, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 120, damping: 12 }}>
        <GameArt game={game} size="lg" className="aspect-[4/3] w-full rounded-[2rem] shadow-2xl shadow-primary/30 [&>span]:text-[8rem] lg:[&>span]:text-[12rem]" />
      </motion.div>
      <div className="space-y-8">
        <motion.div initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
          {state.gameNumber && state.totalGames && (
            <p className="text-2xl font-bold text-muted-foreground lg:text-3xl">
              Game {state.gameNumber} of {state.totalGames}
            </p>
          )}
          <h1 className="text-6xl font-extrabold leading-none lg:text-8xl">{game.meta.name}</h1>
          <p className="mt-3 text-2xl text-mango lg:text-3xl">{game.meta.tagline}</p>
        </motion.div>
        <ol className="space-y-4">
          {game.howToPlay.map((step, i) => (
            <motion.li
              key={step}
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 + i * 0.15 }}
              className="glass flex items-center gap-5 rounded-2xl border p-5 text-xl lg:text-2xl"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-2xl font-extrabold">{i + 1}</span>
              {step}
            </motion.li>
          ))}
        </ol>
        <p className="text-xl font-bold text-muted-foreground">Check your phones — get ready!</p>
      </div>
    </div>
  );
}
