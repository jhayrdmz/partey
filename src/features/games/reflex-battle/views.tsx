import { motion } from "motion/react";
import type { ReflexReveal, ReflexRound } from "@shared/engine";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import { useServerTimeReached } from "@/hooks/useServerClock";
import { cn } from "@/utils/cn";
import type { GameViews } from "../engine/views";
import { ReactionPad } from "../shared/ReactionPad";

function DisplayGo({ goAtMs, paused, submitted, eligible }: { goAtMs: number; paused: boolean; submitted: number; eligible: number }) {
  const go = useServerTimeReached(goAtMs, paused);
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-6 rounded-[3rem] transition-colors duration-75",
        go ? "bg-success" : "bg-destructive/90",
        paused && "bg-muted",
      )}
    >
      <motion.span key={String(go)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="text-[10rem] leading-none font-black text-white lg:text-[16rem]">
        {paused ? "PAUSED" : go ? "GO!" : "WAIT…"}
      </motion.span>
      <span className="text-3xl font-bold text-white/85">
        {go ? `${submitted} / ${eligible} tapped` : "Fingers ready. Don't tap early!"}
      </span>
    </div>
  );
}

export const views: GameViews = {
  DisplayQuestion: ({ game }) => {
    const r = game.round_data as ReflexRound;
    return <DisplayGo goAtMs={r.goAtMs} paused={game.paused} submitted={game.submitted} eligible={game.eligible} />;
  },
  DisplayReveal: ({ game }) => {
    const r = game.reveal as ReflexReveal | null;
    if (!r) return null;
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-4">
        <h2 className="text-center text-5xl font-extrabold">Reaction times</h2>
        {r.results.length === 0 && <p className="text-center text-3xl text-muted-foreground">Nobody tapped! 😴</p>}
        <ol className="space-y-3">
          {r.results.map((p, i) => (
            <motion.li
              key={p.playerId}
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              className={cn("glass flex items-center gap-5 rounded-2xl border px-6 py-4 text-3xl", i === 0 && !p.falseStart && "border-mango ring-2 ring-mango")}
            >
              <span className="w-10 font-black text-muted-foreground">{p.falseStart ? "✗" : i + 1}</span>
              <AvatarBubble avatar={p.avatar} size="md" />
              <span className="flex-1 truncate font-bold">{p.nickname}</span>
              <span className={cn("font-black tabular-nums", p.falseStart ? "text-guava" : "text-calamansi")}>
                {p.falseStart ? "False start" : `${p.reactionMs} ms`}
              </span>
              <span className="w-24 text-right font-bold text-muted-foreground tabular-nums">+{p.points}</span>
            </motion.li>
          ))}
        </ol>
      </div>
    );
  },
  PlayerQuestion: ({ game, submit, submitting, me }) => {
    const r = game.round_data as ReflexRound;
    return <ReactionPad goAtMs={r.goAtMs} paused={game.paused} onTap={() => submit({ tap: true })} disabled={submitting || me?.answered} />;
  },
  PlayerAnswered: () => (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl bg-secondary text-center">
      <span className="text-6xl">👆</span>
      <span className="text-3xl font-black">Tapped!</span>
      <span className="text-muted-foreground">Results in a moment…</span>
    </div>
  ),
};
