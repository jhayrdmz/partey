import { motion } from "motion/react";
import type { DisplayStateDoc } from "@shared/types";
import { GameArt } from "@/features/games/GameArt";
import { getGame } from "@/features/games/registry";

export function GetReady({ state }: { state: DisplayStateDoc }) {
  if (!state.gameId) return null;
  const game = getGame(state.gameId);
  return (
    <div className="flex flex-1 flex-col gap-6">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <GameArt game={game} size="lg" className="aspect-[16/10] w-full rounded-3xl" />
      </motion.div>
      <div className="space-y-1 text-center">
        {state.gameNumber && state.totalGames && (
          <p className="text-sm font-bold text-muted-foreground">
            Game {state.gameNumber} of {state.totalGames}
          </p>
        )}
        <h1 className="text-3xl font-extrabold">{game.meta.name}</h1>
        <p className="text-muted-foreground">{game.meta.tagline}</p>
      </div>
      <ol className="space-y-3">
        {game.howToPlay.map((step, i) => (
          <motion.li
            key={step}
            initial={{ x: -16, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.15 + i * 0.1 }}
            className="flex gap-3 rounded-2xl bg-card/70 p-4"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-extrabold">{i + 1}</span>
            <span className="pt-1">{step}</span>
          </motion.li>
        ))}
      </ol>
      <p className="mt-auto text-center font-bold text-mango">Get ready — the game is about to begin!</p>
    </div>
  );
}
