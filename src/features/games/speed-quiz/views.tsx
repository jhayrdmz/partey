import { Zap } from "lucide-react";
import { motion } from "motion/react";
import type { ChoiceQuestion, SpeedQuizReveal } from "@shared/engine";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import type { GameViews } from "../engine/views";
import { ChoiceButtons } from "../shared/ChoiceButtons";
import { DisplayChoices } from "../shared/DisplayChoices";

function Prompt({ q }: { q: ChoiceQuestion }) {
  return (
    <div className="space-y-3 text-center">
      {q.category && <p className="text-xl font-bold tracking-wide text-mango uppercase lg:text-2xl">{q.category}</p>}
      <h2 className="mx-auto max-w-5xl text-4xl leading-tight font-extrabold lg:text-6xl">{q.prompt}</h2>
    </div>
  );
}

export const views: GameViews = {
  DisplayQuestion: ({ game }) => {
    const q = game.round_data as ChoiceQuestion;
    return (
      <div className="flex flex-1 flex-col justify-center gap-10">
        <Prompt q={q} />
        <DisplayChoices options={q.options} />
      </div>
    );
  },
  DisplayReveal: ({ game }) => {
    const q = game.round_data as ChoiceQuestion;
    const r = game.reveal as SpeedQuizReveal | null;
    if (!r) return null;
    return (
      <div className="grid flex-1 items-center gap-10 xl:grid-cols-[3fr_1fr]">
        <div className="space-y-8">
          <Prompt q={q} />
          <DisplayChoices options={q.options} reveal={{ highlight: [r.correctIndex], counts: r.counts }} />
        </div>
        <div className="glass space-y-4 rounded-3xl border p-6">
          <h3 className="flex items-center gap-2 text-2xl font-extrabold">
            <Zap className="size-7 text-mango" /> Fastest
          </h3>
          {r.fastest.length === 0 ? (
            <p className="text-xl text-muted-foreground">Nobody got it! 😅</p>
          ) : (
            <ol className="space-y-3">
              {r.fastest.map((f, i) => (
                <motion.li key={f.playerId} initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 + i * 0.1 }} className="flex items-center gap-3 text-xl">
                  <AvatarBubble avatar={f.avatar} size="sm" />
                  <span className="flex-1 truncate font-bold">{f.nickname}</span>
                  <span className="text-muted-foreground tabular-nums">{(f.ms / 1000).toFixed(1)}s</span>
                </motion.li>
              ))}
            </ol>
          )}
        </div>
      </div>
    );
  },
  PlayerQuestion: ({ game, submit, submitting, me }) => {
    const q = game.round_data as ChoiceQuestion;
    return (
      <div className="flex flex-1 flex-col gap-4">
        <p className="text-center text-lg leading-snug font-bold">{q.prompt}</p>
        <ChoiceButtons options={q.options} onPick={(choice) => submit({ choice })} disabled={submitting || me?.answered || game.paused} />
      </div>
    );
  },
};
