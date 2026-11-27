import { useEffect, useRef, useState } from "react";
import { Check, Eye, Feather, Flame, Lock, Search, Send, Trophy, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { AuthorAwards, AuthorGuessResult, AuthorGuessRound, AuthorReveal, AuthorRound, AuthorSecret, PlayerPick, PublicGameState } from "@shared/engine";
import { AUTHOR_CATEGORY_LABELS, AUTHOR_LIMITS, AUTHOR_POINTS, authorBonus } from "@shared/gameSettings";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import { Button } from "@/components/ui/button";
import { playSound } from "@/utils/sound";
import { cn } from "@/utils/cn";
import type { PlayerQuestionProps } from "../engine/views";

/* ─── Shared pieces ────────────────────────────────────────────────────── */

/** Paper card in the cover's style: cream paper, dark ink, chunky outline. */
const PAPER = "relative rounded-[1.75rem] border-[5px] border-[#1d1238] bg-[#fdf3df] text-[#1d1238] shadow-[0_8px_0_#1d1238]";

/** Streaks that get a bigger cheer (3, 5, 7, 10 in a row). */
const isMilestone = (streak: number) => [3, 5, 7, 10].includes(streak);

function CategoryChip({ category, className }: { category: AuthorRound["category"]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-mango px-3 py-1 text-sm font-black tracking-wide text-black uppercase", className)}>
      <Feather className="size-4" /> {AUTHOR_CATEGORY_LABELS[category]}
    </span>
  );
}

/** The question on a paper card. */
function QuestionCard({ round, size = "lg" }: { round: AuthorRound; size?: "sm" | "lg" }) {
  return (
    <div className={cn(PAPER, "w-full -rotate-1 px-6 py-5 text-center", size === "lg" ? "max-w-4xl lg:px-12 lg:py-10" : "max-w-md")}>
      <CategoryChip category={round.category} className="absolute -top-4 left-1/2 -translate-x-1/2" />
      <p className={cn("font-display font-black text-balance", size === "lg" ? "text-4xl lg:text-6xl" : "text-2xl")}>{round.prompt}</p>
    </div>
  );
}

/** An anonymous answer card: a random number, the answer, no name. */
export function AnswerCard({ card, answer, prompt, size = "lg", className }: { card: number; answer: string; prompt?: string; size?: "sm" | "lg"; className?: string }) {
  return (
    <div className={cn(PAPER, "w-full px-6 pt-8 pb-6 text-center", size === "lg" ? "max-w-4xl lg:px-12 lg:pt-12 lg:pb-10" : "max-w-md", className)} data-testid="answer-card">
      <span className="absolute -top-5 left-6 rounded-full border-4 border-[#1d1238] bg-[#ffd23f] px-3 py-0.5 font-display text-xl font-black" aria-label={`Card ${card}`}>
        #{card}
      </span>
      {prompt && <p className={cn("mb-3 font-bold opacity-70", size === "lg" ? "text-lg lg:text-2xl" : "text-sm")}>{prompt}</p>}
      <p className={cn("font-display font-black text-balance", size === "lg" ? "text-4xl leading-tight lg:text-6xl" : "text-2xl")}>“{answer}”</p>
    </div>
  );
}

function StreakFlame({ streak, className }: { streak: number; className?: string }) {
  if (streak < 2) return null;
  return (
    <motion.span
      animate={isMilestone(streak) ? { scale: [1, 1.25, 1] } : undefined}
      transition={isMilestone(streak) ? { repeat: Infinity, duration: 0.9 } : undefined}
      className={cn("inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-sm font-black", streak >= 5 ? "bg-guava text-white" : "bg-mango text-black", isMilestone(streak) && "ring-2 ring-white", className)}
      aria-label={`${streak} in a row`}
    >
      <Flame className="size-4 fill-current" />
      {streak}
    </motion.span>
  );
}

/* ─── Big screen ───────────────────────────────────────────────────────── */

export function DisplayAuthorRound({ game }: { game: PublicGameState }) {
  const round = game.round_data as AuthorRound;
  const prev = useRef(game.submitted);
  useEffect(() => {
    if (game.submitted > prev.current) playSound("pop");
    prev.current = game.submitted;
  }, [game.submitted]);

  if (round.kind === "write") {
    const pct = game.eligible ? (game.submitted / game.eligible) * 100 : 0;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[calc(2rem*var(--fit-c,1))] text-center">
        <p className="text-xl font-extrabold tracking-widest text-muted-foreground uppercase lg:text-3xl">
          Question {round.question} of {round.questions} · answer in secret
        </p>
        <motion.div initial={{ y: 30, opacity: 0, rotate: -4 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 160, damping: 14 }} className="flex w-full justify-center">
          <QuestionCard round={round} />
        </motion.div>
        <div className="w-full max-w-xl space-y-2">
          <p className="text-2xl font-black lg:text-4xl" data-testid="submitted-count">
            {game.submitted} / {game.eligible} answered
          </p>
          <div className="h-4 overflow-hidden rounded-full bg-card">
            <motion.div className="h-full rounded-full bg-mango" animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
          </div>
          <p className="text-lg font-semibold text-muted-foreground lg:text-xl">Answers stay anonymous. Nobody sees them until the guessing starts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[calc(1.5rem*var(--fit-c,1))] text-center">
      <p className="text-xl font-extrabold tracking-widest text-muted-foreground uppercase lg:text-3xl">
        Answer {round.index} of {round.count} · who wrote this?
      </p>
      <motion.div key={round.card} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 120, damping: 14 }} className="flex w-full justify-center">
        <AnswerCard card={round.card} answer={round.answer} prompt={round.prompt} />
      </motion.div>
      <ul className="flex flex-wrap justify-center gap-3" aria-label="Suspects">
        {round.candidates.map((c) => (
          <li key={c.playerId} className="flex flex-col items-center gap-1">
            <AvatarBubble avatar={c.avatar} size="md" />
            <span className="max-w-24 truncate text-sm font-extrabold lg:text-base">{c.nickname}</span>
          </li>
        ))}
      </ul>
      <p className="text-2xl font-black lg:text-3xl" data-testid="guessed-count">
        {game.submitted} / {game.eligible} guessed
      </p>
    </div>
  );
}

/** Reveal timeline (ms): most-guessed spotlight → drumroll → author → everyone's points → (last) awards. */
const T = { drumroll: 1_800, author: 3_000, results: 4_200, awards: 9_500 };

export function DisplayAuthorReveal({ game }: { game: PublicGameState }) {
  const r = game.reveal as AuthorReveal | null;
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => setT(performance.now() - start), 100);
    return () => window.clearInterval(id);
  }, []);
  const step = t >= T.awards ? 4 : t >= T.results ? 3 : t >= T.author ? 2 : t >= T.drumroll ? 1 : 0;
  useEffect(() => {
    if (!r || r.kind !== "author") return;
    if (step === 1) playSound("tick");
    if (step === 2) playSound(r.correctCount > 0 ? "win" : "pop");
  }, [step, r]);
  if (!r) return null;

  if (r.kind === "collected") {
    if (r.awards && t >= 2_500) return <Awards awards={r.awards} />;
    return <Collected count={r.count} />;
  }
  if (r.awards && step === 4) return <Awards awards={r.awards} />;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[calc(1.25rem*var(--fit-c,1))] text-center">
      <AnswerCard card={r.card} answer={r.answer} prompt={r.prompt} className="max-w-3xl lg:pt-9 lg:pb-7 [&_p:last-child]:lg:text-5xl" />
      <div className="flex min-h-40 w-full flex-col items-center justify-center gap-3 lg:min-h-52">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="most" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex flex-col items-center gap-2" data-testid="most-guessed">
              <p className="text-xl font-extrabold tracking-widest text-muted-foreground uppercase lg:text-2xl">{r.mostGuessed ? (r.mostGuessed.tied ? "It's a tie! Most guessed…" : "Most guessed") : "Nobody guessed!"}</p>
              {r.mostGuessed && (
                <div className="flex items-center gap-3 rounded-full bg-card py-2 pr-6 pl-2 ring-4 ring-mango">
                  <AvatarBubble avatar={r.mostGuessed.player.avatar} size="lg" />
                  <span className="text-3xl font-black lg:text-4xl">{r.mostGuessed.player.nickname}</span>
                  <span className="rounded-full bg-mango px-3 py-1 text-xl font-black text-black">{r.mostGuessed.votes} {r.mostGuessed.votes === 1 ? "vote" : "votes"}</span>
                </div>
              )}
            </motion.div>
          )}
          {step === 1 && (
            <motion.p key="drum" initial={{ opacity: 0 }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 0.8 }} className="font-display text-4xl font-black lg:text-6xl">
              And the author is…
            </motion.p>
          )}
          {step >= 2 && (
            <motion.div key="author" initial={{ scale: 2.2, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: -2, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 12 }} className="flex flex-col items-center gap-2" data-testid="author">
              <div className="flex items-center gap-4 rounded-[2rem] border-[5px] border-[#1d1238] bg-mango py-2 pr-8 pl-2 text-black shadow-[0_8px_0_#1d1238]">
                <AvatarBubble avatar={r.author.avatar} size="xl" />
                <span className="text-left leading-tight">
                  <span className="block text-lg font-extrabold uppercase">Written by</span>
                  <span className="block font-display text-4xl font-black lg:text-6xl">{r.author.nickname}</span>
                </span>
              </div>
              <p className="text-2xl font-black lg:text-3xl" data-testid="found-count">
                {r.correctCount === 0 ? `Nobody found ${r.author.nickname}! 🕵️` : `${r.correctCount} of ${r.guessers} found ${r.author.nickname}`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <GuessResults results={r.results} show={step >= 3} />
    </div>
  );
}

/** Each guesser: right or wrong, base + bonus, streak. */
function GuessResults({ results, show }: { results: AuthorGuessResult[]; show: boolean }) {
  const compact = results.length > 8;
  return (
    <ul className={cn("grid w-full max-w-6xl gap-2", compact ? "grid-cols-3 lg:grid-cols-5" : "grid-cols-2 lg:grid-cols-4")} aria-label="Guesses" data-shown={show}>
      {results.map((p, i) => (
        <motion.li
          key={p.playerId}
          initial={{ opacity: 0, y: 12 }}
          animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ delay: show ? i * Math.min(0.06, 0.8 / results.length) : 0 }}
          className={cn("flex items-center gap-2 rounded-2xl border-2 px-2 py-1.5 text-left", p.correct ? "border-success bg-success/10" : "border-border bg-card")}
          data-player={p.nickname}
          data-correct={p.correct}
        >
          <AvatarBubble avatar={p.avatar} size={compact ? "xs" : "sm"} />
          {compact ? (
            // Narrow tiles: the name gets the whole line; the streak goes under it.
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-extrabold">{p.nickname}</span>
              {p.streak > 1 && (
                <span className={cn("inline-flex items-center text-xs font-black", isMilestone(p.streak) ? "text-guava" : "text-mango")} aria-label={`${p.streak} in a row`}>
                  <Flame className="size-3 fill-current" />
                  {p.streak} in a row
                </span>
              )}
            </span>
          ) : (
            <>
              <span className="min-w-0 flex-1 truncate font-extrabold">{p.nickname}</span>
              <StreakFlame streak={p.streak} />
            </>
          )}
          {p.correct ? (
            <span className="shrink-0 text-right leading-none font-black tabular-nums">
              <span className="block text-success">+{p.base}</span>
              {p.bonus > 0 && <span className="block text-xs text-mango">+{p.bonus} bonus</span>}
            </span>
          ) : (
            <X className={cn("size-5 shrink-0", p.guess ? "text-guava" : "text-muted-foreground")} aria-label={p.guess ? "Wrong" : "No guess"} />
          )}
        </motion.li>
      ))}
    </ul>
  );
}

function Collected({ count }: { count: number }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div className="relative h-56 w-80 lg:h-72 lg:w-[26rem]" aria-hidden>
        {Array.from({ length: Math.min(count, 6) }, (_, i) => (
          <motion.div
            key={i}
            className={cn(PAPER, "absolute inset-0 grid place-items-center")}
            initial={{ x: (i - 2.5) * 70, rotate: (i - 2.5) * 8, opacity: 0 }}
            animate={{ x: [(i - 2.5) * 70, 0, (2.5 - i) * 10], rotate: [(i - 2.5) * 8, 0, (i - 2.5) * 3], opacity: 1 }}
            transition={{ duration: 1.6, delay: i * 0.08, ease: "easeInOut" }}
          >
            <Feather className="size-20 opacity-30" />
          </motion.div>
        ))}
      </div>
      <p className="font-display text-5xl font-black lg:text-7xl" data-testid="collected">
        {count === 0 ? "No answers this time!" : `${count} ${count === 1 ? "answer is" : "answers are"} in!`}
      </p>
      {count > 0 && <p className="text-2xl font-bold text-muted-foreground lg:text-3xl">Shuffled. Now… who wrote what?</p>}
    </div>
  );
}

/** Avatars + names; several when tied. Big ties: faces only (up to 8), then "+N more". */
function Winners({ players }: { players: PlayerPick[] }) {
  if (players.length > 3) {
    return (
      <span className="flex flex-col items-center gap-1.5">
        <span className="flex flex-wrap justify-center -space-x-2" aria-label={players.map((p) => p.nickname).join(", ")}>
          {players.slice(0, 8).map((p) => (
            <AvatarBubble key={p.playerId} avatar={p.avatar} size="sm" className="ring-2 ring-[#fdf3df]" />
          ))}
        </span>
        <span className="text-lg font-black">
          {players.length} players{players.length > 8 ? ` (+${players.length - 8} more)` : ""}
        </span>
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      {players.map((p) => (
        <span key={p.playerId} className="flex items-center gap-1.5">
          <AvatarBubble avatar={p.avatar} size="sm" />
          <span className="max-w-48 truncate text-2xl font-black">{p.nickname}</span>
        </span>
      ))}
    </span>
  );
}

/** End-of-game awards: always the same three cards; ties share one; "None" when nobody earned it. */
export function Awards({ awards }: { awards: AuthorAwards }) {
  const { bestDetective: d, mostObvious: o, longestStreak: s } = awards;
  const tied = (n: number) => (n > 1 ? `Tied · ` : "");
  const cards = [
    {
      key: "bestDetective",
      title: "Best Detective",
      icon: Search,
      body: d ? <Winners players={d.players} /> : null,
      stat: d ? `${tied(d.players.length)}${d.correct} ${d.correct === 1 ? "author" : "authors"} found` : null,
    },
    {
      key: "mostObvious",
      title: "Most Obvious",
      icon: Eye,
      // Just who wrote it (the same author once, even if several of their answers tie).
      body: o ? <Winners players={[...new Map(o.answers.map((x) => [x.author.playerId, x.author])).values()]} /> : null,
      stat: o ? `${tied(o.answers.length)}found by ${o.found} ${o.found === 1 ? "guesser" : "guessers"}` : null,
    },
    {
      key: "longestStreak",
      title: "Longest Streak",
      icon: Flame,
      body: s ? <Winners players={s.players} /> : null,
      stat: s ? `${tied(s.players.length)}${s.streak} in a row` : null,
    },
  ];
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center" data-testid="awards">
      <p className="font-display text-5xl font-black lg:text-7xl">And the awards go to…</p>
      <ul className="grid w-full max-w-6xl grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c, i) => (
          <motion.li
            key={c.key}
            initial={{ scale: 0.6, opacity: 0, rotate: -4 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ delay: 0.2 + i * 0.35, type: "spring", stiffness: 200, damping: 14 }}
            className={cn(PAPER, "flex flex-col items-center justify-center gap-3 px-4 py-5")}
            data-award={c.title}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1d1238] px-3 py-1 text-sm font-black tracking-wide text-[#ffd23f] uppercase">
              <c.icon className="size-4" /> {c.title}
            </span>
            {c.body ?? <span className="font-display text-3xl font-black opacity-40">None</span>}
            <span className="font-bold opacity-70">{c.stat ?? (c.key === "longestStreak" ? "Nobody got 2 in a row" : "Nobody found an author")}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Phone ────────────────────────────────────────────────────────────── */

function MyStreak({ round, uid }: { round: AuthorRound; uid: string }) {
  const streak = round.streaks[uid] ?? 0;
  const next = AUTHOR_POINTS.base + authorBonus(streak + 1);
  return (
    <div className="flex w-full items-center justify-between text-sm font-extrabold">
      {streak > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-mango px-3 py-1.5 text-black">
          <Flame className="size-4 fill-current" /> {streak} in a row
        </span>
      ) : (
        <span className="text-muted-foreground">No streak yet</span>
      )}
      <span className="rounded-full bg-card px-3 py-1.5 tabular-nums" aria-label={`A right guess is worth ${next} points`}>
        Right guess <span className="text-success">+{next}</span>
      </span>
    </div>
  );
}

export function AuthorPad(props: PlayerQuestionProps) {
  const round = props.game.round_data as AuthorRound;
  return round.kind === "write" ? <WritePad {...props} /> : <GuessPad {...props} />;
}

function WritePad({ game, submit, submitting }: PlayerQuestionProps) {
  const round = game.round_data as AuthorRound;
  const [text, setText] = useState("");
  const left = AUTHOR_LIMITS.answerMax - [...text].length;
  const ok = text.trim().length > 0 && left >= 0 && !game.paused && !submitting;
  return (
    <form
      className="flex flex-1 flex-col items-center justify-center gap-5 text-center"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) void submit({ text });
      }}
    >
      <QuestionCard round={round} size="sm" />
      <label className="w-full text-left">
        <span className="mb-1.5 block font-bold">Your answer (anonymous)</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={AUTHOR_LIMITS.answerMax}
          rows={3}
          placeholder="Be honest… or not."
          className="w-full resize-none rounded-2xl border-2 border-input bg-card px-4 py-3 text-lg outline-none focus:border-primary"
          aria-describedby="answer-left"
        />
        <span id="answer-left" className={cn("mt-1 block text-right text-sm font-bold tabular-nums", left < 15 ? "text-guava" : "text-muted-foreground")}>
          {left} left
        </span>
      </label>
      <Button type="submit" size="lg" disabled={!ok} className="w-full text-lg">
        <Send /> Submit answer
      </Button>
    </form>
  );
}

function GuessPad({ game, me, uid, submit, submitting }: PlayerQuestionProps) {
  const round = game.round_data as AuthorGuessRound;
  const [picked, setPicked] = useState<string | null>(null);
  const mine = (me?.secret as AuthorSecret)?.yourAnswer === true;
  if (mine) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <AnswerCard card={round.card} answer={round.answer} size="sm" />
        <p className="text-3xl font-black">That's yours! 🤫</p>
        <p className="font-bold text-muted-foreground">Keep a straight face while everyone guesses.</p>
      </div>
    );
  }
  const options = round.candidates.filter((c) => c.playerId !== uid);
  return (
    <div className="flex flex-1 flex-col items-center gap-4 text-center">
      <MyStreak round={round} uid={uid} />
      <AnswerCard card={round.card} answer={round.answer} size="sm" />
      <p className="text-xl font-black">Who wrote this?</p>
      <div className="grid w-full grid-cols-2 gap-2" role="radiogroup" aria-label="Who wrote this?">
        {options.map((c) => (
          <button
            key={c.playerId}
            type="button"
            role="radio"
            aria-checked={picked === c.playerId}
            disabled={game.paused || submitting}
            onClick={() => setPicked(c.playerId)}
            className={cn(
              "flex min-h-14 items-center gap-2 rounded-2xl border-2 px-3 py-2 text-left font-extrabold transition-colors",
              picked === c.playerId ? "border-mango bg-mango/15" : "border-border bg-card",
            )}
          >
            <AvatarBubble avatar={c.avatar} size="sm" />
            <span className="min-w-0 truncate">{c.nickname}</span>
          </button>
        ))}
      </div>
      {/* Stays in reach under a long list of names. */}
      <div className="sticky bottom-0 -mx-1 w-[calc(100%+0.5rem)] bg-background px-1 pt-2 pb-3">
        <Button size="lg" className="w-full text-lg" disabled={!picked || game.paused || submitting} onClick={() => picked && void submit({ author: picked })}>
          <Lock /> Lock in guess
        </Button>
      </div>
    </div>
  );
}

export function AuthorLocked({ game, me }: PlayerQuestionProps) {
  const round = game.round_data as AuthorRound;
  const answer = me?.answer as { text?: string; author?: string } | null;
  const who = round.kind === "guess" ? round.candidates.find((c) => c.playerId === answer?.author) : undefined;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 12 }}>
        <Lock className="size-14 text-success" />
      </motion.span>
      {round.kind === "write" ? (
        <>
          <p className="text-3xl font-black">Answer locked in!</p>
          {answer?.text && <p className="max-w-sm font-display text-xl font-bold italic">“{answer.text}”</p>}
          <p className="text-muted-foreground">It'll show up with no name. {game.submitted} / {game.eligible} answered</p>
        </>
      ) : (
        <>
          <p className="text-3xl font-black">Guess locked in!</p>
          {who && (
            <span className="flex items-center gap-2 rounded-full bg-card py-1.5 pr-4 pl-1.5 text-xl font-black">
              <AvatarBubble avatar={who.avatar} size="sm" /> {who.nickname}
            </span>
          )}
          <p className="text-muted-foreground">
            {game.submitted} / {game.eligible} guessed
          </p>
        </>
      )}
    </div>
  );
}

export function AuthorResult({ game, me, uid }: { game: PublicGameState; me: { gameScore: number; rank: number | null; round: number }; uid: string }) {
  const r = game.reveal as AuthorReveal | null;
  const mine = r?.kind === "author" ? r.results.find((x) => x.playerId === uid) : undefined;
  useEffect(() => {
    if (mine) playSound(mine.correct ? "win" : "pop");
  }, [mine]);
  if (!r) return null;
  const last = me.round >= game.totalRounds;

  let body: React.ReactNode;
  if (r.kind === "collected") {
    body = (
      <div className="space-y-2">
        <p className="text-3xl font-black">{r.count === 0 ? "No answers this time" : `${r.count} answers are in!`}</p>
        <p className="font-bold text-muted-foreground">{r.count > 0 ? "Get ready to guess who wrote what." : ""}</p>
      </div>
    );
  } else if (r.author.playerId === uid) {
    body = (
      <div className="space-y-2">
        <Feather className="mx-auto size-14 text-mango" />
        <p className="text-3xl font-black">Your answer!</p>
        <p className="text-lg font-bold text-muted-foreground" data-testid="fooled">
          You fooled {r.guessers - r.correctCount} of {r.guessers}
        </p>
      </div>
    );
  } else {
    body = (
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 14 }} className="flex flex-col items-center gap-2">
        <span className={cn("grid size-16 place-items-center rounded-full", mine?.correct ? "bg-success text-white" : "bg-guava/20 text-guava")}>
          {mine?.correct ? <Check className="size-10" strokeWidth={3} /> : <X className="size-10" strokeWidth={3} />}
        </span>
        <p className={cn("text-3xl font-black", mine?.correct ? "text-success" : "text-guava")}>{!mine?.guess ? "No guess" : mine.correct ? "You found the author!" : "Not quite!"}</p>
        <p className="flex items-center gap-2 text-lg font-bold">
          It was <AvatarBubble avatar={r.author.avatar} size="xs" /> {r.author.nickname}
        </p>
        {mine?.correct && (
          <p className="text-4xl font-black tabular-nums">
            +{mine.base}
            {mine.bonus > 0 && <span className="ml-2 text-2xl text-mango">+{mine.bonus} bonus</span>}
          </p>
        )}
        {mine && mine.streak > 1 && (
          <p className={cn("inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-lg font-black", isMilestone(mine.streak) ? "bg-guava text-white" : "bg-mango text-black")} data-testid="streak">
            <Flame className="size-5 fill-current" /> {mine.streak} in a row!
          </p>
        )}
        {mine && !mine.correct && <p className="font-bold text-muted-foreground">Streak reset.</p>}
      </motion.div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      {body}
      <div className="w-full rounded-2xl bg-card p-5">
        <p className="flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground">
          <Trophy className="size-4 text-mango" /> This game
        </p>
        <p className="mt-1 text-3xl font-black tabular-nums">{me.gameScore} pts</p>
        {me.rank && <p className="text-muted-foreground">You're #{me.rank}</p>}
      </div>
      <p className="text-sm text-muted-foreground">{last ? "Awards on the big screen, then final results…" : r.kind === "collected" ? "Guessing starts now…" : "Next up…"}</p>
    </div>
  );
}
