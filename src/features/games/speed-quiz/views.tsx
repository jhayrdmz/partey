import { Zap } from "lucide-react";
import { motion } from "motion/react";
import type { ChoiceQuestion, SpeedQuizReveal } from "@shared/engine";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import type { GameViews } from "../engine/views";
import { ChoiceButtons } from "../shared/ChoiceButtons";
import { DisplayChoices } from "../shared/DisplayChoices";
import { DisplayPrompt } from "../shared/DisplayPrompt";

function Prompt({ q }: { q: ChoiceQuestion }) {
  return <DisplayPrompt prompt={q.prompt} hint={q.category} hintClassName="text-mango" />;
}

export const views: GameViews = {
  DisplayQuestion: ({ game }) => {
    const q = game.round_data as ChoiceQuestion;
    return (
      <div className="flex flex-1 flex-col justify-center gap-5 sm:gap-8 lg:gap-10">
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
      <div className="grid flex-1 content-center items-center gap-4 sm:gap-6 xl:grid-cols-[3fr_1fr] xl:gap-10 short:grid-cols-[3fr_1fr]">
        <div className="space-y-4 sm:space-y-6 lg:space-y-8">
          <Prompt q={q} />
          <DisplayChoices options={q.options} reveal={{ highlight: [r.correctIndex], counts: r.counts }} />
        </div>
        <div className="glass space-y-3 rounded-2xl border p-4 sm:space-y-4 sm:rounded-3xl sm:p-6">
          <h3 className="flex items-center gap-2 text-lg font-extrabold sm:text-2xl">
            <Zap className="size-5 text-mango sm:size-7" /> Fastest
          </h3>
          {r.fastest.length === 0 ? (
            <p className="text-base text-muted-foreground sm:text-xl">Nobody got it! 😅</p>
          ) : (
            <ol className="grid grid-cols-2 gap-x-4 gap-y-2 sm:gap-y-3 xl:grid-cols-1 short:grid-cols-1">
              {r.fastest.map((f, i) => (
                <motion.li key={f.playerId} initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 + i * 0.1 }} className="flex min-w-0 items-center gap-2 text-base sm:gap-3 sm:text-xl">
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
