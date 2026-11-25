import type { ChoiceQuestion, MajorityReveal } from "@shared/engine";
import type { GameViews } from "../engine/views";
import { ChoiceButtons } from "../shared/ChoiceButtons";
import { DisplayChoices } from "../shared/DisplayChoices";

function Prompt({ q, hint }: { q: ChoiceQuestion; hint: string }) {
  return (
    <div className="space-y-3 text-center">
      <p className="text-xl font-bold tracking-wide text-sky uppercase lg:text-2xl">{hint}</p>
      <h2 className="mx-auto max-w-5xl text-4xl leading-tight font-extrabold lg:text-6xl">{q.prompt}</h2>
    </div>
  );
}

export const views: GameViews = {
  DisplayQuestion: ({ game }) => {
    const q = game.round_data as ChoiceQuestion;
    return (
      <div className="flex flex-1 flex-col justify-center gap-10">
        <Prompt q={q} hint="What will MOST people pick?" />
        <DisplayChoices options={q.options} />
      </div>
    );
  },
  DisplayReveal: ({ game }) => {
    const q = game.round_data as ChoiceQuestion;
    const r = game.reveal as MajorityReveal | null;
    if (!r) return null;
    return (
      <div className="flex flex-1 flex-col justify-center gap-10">
        <Prompt q={q} hint={r.majority.length === 0 ? "Nobody answered!" : r.majority.length > 1 ? "It's a tie!" : "The crowd has spoken"} />
        <DisplayChoices
          options={q.options}
          reveal={{ highlight: r.majority, counts: r.counts, picks: q.options.map((_, i) => r.picks.filter((p) => p.choice === i)) }}
        />
      </div>
    );
  },
  PlayerQuestion: ({ game, submit, submitting, me }) => {
    const q = game.round_data as ChoiceQuestion;
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div className="text-center">
          <p className="text-sm font-bold text-sky uppercase">Pick what most people will pick</p>
          <p className="mt-1 text-lg leading-snug font-bold">{q.prompt}</p>
        </div>
        <ChoiceButtons options={q.options} onPick={(choice) => submit({ choice })} disabled={submitting || me?.answered || game.paused} />
      </div>
    );
  },
};
