/** Phone and display pieces for The Impostor (assembled in views.tsx). */
import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, Lock, Mic, Send, VenetianMask, Vote } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ImpostorClue, ImpostorReveal, ImpostorRound, ImpostorSecret, PlayerPick } from "@shared/engine";
import { categoryLabel } from "@shared/gameSettings";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { playSound } from "@/utils/sound";

const secretOf = (secret: unknown) => (secret && typeof secret === "object" && "role" in secret ? (secret as ImpostorSecret) : null);

/* ─── Shared bits ────────────────────────────────────────────────────── */

function CategoryChip({ category, className }: { category: ImpostorRound["category"]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 font-bold text-muted-foreground", className)}>
      Category · <span className="text-foreground">{categoryLabel(category)}</span>
    </span>
  );
}

/** Everyone's clues so far, in turn order. */
function ClueBoard({ clues, size = "md", highlight }: { clues: ImpostorClue[]; size?: "sm" | "md" | "lg"; highlight?: string }) {
  if (clues.length === 0) return null;
  return (
    <ol className={cn("grid gap-2", size === "lg" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 lg:gap-3" : "grid-cols-2")}>
      {clues.map((c, i) => (
        <motion.li
          key={`${c.playerId}-${c.clueRound}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i, 8) * 0.04 }}
          className={cn(
            "glass flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2",
            size === "lg" && "gap-3 rounded-2xl px-4 py-3",
            highlight === c.playerId && "border-mango ring-2 ring-mango/60",
          )}
        >
          <AvatarBubble avatar={c.avatar} size={size === "lg" ? "sm" : "xs"} />
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate font-semibold text-muted-foreground", size === "lg" ? "text-[length:calc(1rem*var(--fit-c,1))] lg:text-[length:calc(1.25rem*var(--fit-c,1))]" : "text-xs")}>{c.nickname}</span>
            <span className={cn("block truncate font-extrabold", size === "lg" ? "text-[length:calc(1.5rem*var(--fit-c,1))] lg:text-[length:calc(2.25rem*var(--fit-c,1))]" : "text-base", !c.clue && "font-semibold text-muted-foreground italic")}>
              {c.clue ?? "said aloud"}
            </span>
          </span>
        </motion.li>
      ))}
    </ol>
  );
}

/* ─── Phone: private role card ───────────────────────────────────────── */

const AUTO_HIDE_MS = 8_000;

/** Covered by default; tap to peek, tap (or wait) to hide, so nobody glimpses it over your shoulder. */
export function RoleCard({ me }: { me: { secret: unknown } | null }) {
  const secret = secretOf(me?.secret);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!shown) return;
    const t = window.setTimeout(() => setShown(false), AUTO_HIDE_MS);
    return () => window.clearTimeout(t);
  }, [shown]);
  if (!secret) return null;
  const impostor = secret.role === "impostor";

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-border bg-card/80">
      <AnimatePresence mode="wait" initial={false}>
        {shown ? (
          <motion.div
            key="shown"
            initial={{ rotateX: 80, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            exit={{ rotateX: -80, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn("flex items-center gap-3 p-4", impostor ? "bg-gradient-to-br from-guava/40 to-primary/30" : "bg-gradient-to-br from-calamansi/25 to-sky/20")}
          >
            <span className="text-4xl">{impostor ? "🕵️" : "🤫"}</span>
            <div className="min-w-0 flex-1">
              {impostor ? (
                <>
                  <p className="text-xl leading-tight font-black text-guava">You are the Impostor!</p>
                  <p className="text-sm text-foreground/80">
                    Category: <b>{categoryLabel(secret.category)}</b>. Listen and blend in.
                  </p>
                  {secret.partners.length > 0 && <p className="text-sm text-foreground/80">Also impostor: {secret.partners.map((p) => p.nickname).join(", ")}</p>}
                </>
              ) : (
                <>
                  <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Secret word · {categoryLabel(secret.category)}</p>
                  <p className="truncate text-3xl leading-tight font-black">{secret.word}</p>
                </>
              )}
            </div>
            <Button size="icon-sm" variant="secondary" className="rounded-md" onClick={() => setShown(false)} aria-label="Hide my role">
              <EyeOff />
            </Button>
          </motion.div>
        ) : (
          <motion.button
            key="hidden"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShown(true);
              if (navigator.vibrate) navigator.vibrate(20);
            }}
            className="flex w-full items-center gap-3 p-4 text-left"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/20 text-primary">
              <Lock className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold">Your secret role</span>
              <span className="block text-sm text-muted-foreground">Cover your screen, then tap to peek</span>
            </span>
            <Eye className="size-5 text-muted-foreground" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Phone: clue turn & vote ────────────────────────────────────────── */

export function ClueInput({ submit, submitting }: { submit: (answer: unknown) => void; submitting: boolean }) {
  const [clue, setClue] = useState("");
  const word = clue.trim();
  const oneWord = /^[\p{L}\p{N}][\p{L}\p{N}'’-]{0,23}$/u.test(word);
  useEffect(() => {
    playSound("pop");
    if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
  }, []);
  return (
    <form
      className="flex flex-1 flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (oneWord) submit({ clue: word });
      }}
    >
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-3xl bg-gradient-to-br from-mango/30 to-guava/30 p-5 text-center">
        <Mic className="mx-auto size-10 text-mango" />
        <p className="mt-2 text-3xl font-black">Your turn!</p>
        <p className="text-muted-foreground">Say one word out loud, then type it.</p>
      </motion.div>
      <input
        aria-label="Your one-word clue"
        value={clue}
        onChange={(e) => setClue(e.target.value.replace(/\s+/g, ""))}
        maxLength={24}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="One word…"
        className="h-16 w-full rounded-md border-2 border-input bg-background/60 px-4 text-center text-2xl font-extrabold outline-none focus:border-primary"
      />
      <div className="flex-1" />
      <Button type="submit" size="xl" variant="party" disabled={!oneWord || submitting} className="w-full">
        <Send /> Send clue
      </Button>
    </form>
  );
}

export function Listening({ pub }: { pub: Extract<ImpostorRound, { kind: "turn" }> }) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col items-center gap-2 rounded-3xl bg-card/60 p-5 text-center">
        <AvatarBubble avatar={pub.turnPlayer.avatar} size="lg" />
        <p className="text-2xl font-black">{pub.turnPlayer.nickname} is giving a clue</p>
        <p className="text-muted-foreground">Listen closely…</p>
      </div>
      <ClueBoard clues={pub.clues} size="sm" />
    </div>
  );
}

export function VotePicker({ pub, uid, submit, submitting }: { pub: Extract<ImpostorRound, { kind: "vote" }>; uid: string; submit: (a: unknown) => void; submitting: boolean }) {
  const [choice, setChoice] = useState<PlayerPick | null>(null);
  const options = pub.candidates.filter((c) => c.playerId !== uid);
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="text-center">
        <p className="text-2xl font-black">{pub.revote ? "Revote!" : "Who's the impostor?"}</p>
        <p className="text-sm text-muted-foreground">{pub.revote ? "Only the tied players are on the ballot." : "Votes stay secret until everyone has voted."}</p>
      </div>
      <div role="radiogroup" aria-label="Vote for a player" className="grid grid-cols-2 gap-2">
        {options.map((c) => {
          const selected = choice?.playerId === c.playerId;
          return (
            <button
              key={c.playerId}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setChoice(c)}
              className={cn(
                "relative flex flex-col items-center gap-1.5 rounded-2xl border-2 bg-card/70 p-3 transition-colors",
                selected ? "border-guava bg-guava/15" : "border-transparent",
              )}
            >
              {selected && <Check className="absolute top-2 right-2 size-5 text-guava" />}
              <AvatarBubble avatar={c.avatar} size="md" />
              <span className="max-w-full truncate font-bold">{c.nickname}</span>
            </button>
          );
        })}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-muted-foreground">Clues given</summary>
        <div className="mt-2">
          <ClueBoard clues={pub.clues} size="sm" />
        </div>
      </details>
      <div className="flex-1" />
      <Button size="xl" variant="party" className="w-full" disabled={!choice || submitting} onClick={() => choice && submit({ vote: choice.playerId })}>
        <Vote /> {choice ? `Vote for ${choice.nickname}` : "Pick a player"}
      </Button>
    </div>
  );
}

/* ─── Phone: results ─────────────────────────────────────────────────── */

export function PlayerOutcome({ r, mine }: { r: Extract<ImpostorReveal, { kind: "votes" }>; mine: { secret: unknown; lastRound: { points: number; correct: boolean | null } | null } }) {
  const secret = secretOf(mine.secret);
  const won = mine.lastRound?.correct === true;
  useEffect(() => {
    playSound(won ? "win" : "pop");
  }, [won]);
  if (!r.outcome) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span className="text-6xl">🤝</span>
        <p className="text-3xl font-black">It's a tie!</p>
        <p className="text-muted-foreground">{r.tied.map((t) => t.nickname).join(" vs ")}. The host decides: revote or reveal.</p>
      </div>
    );
  }
  const o = r.outcome;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <motion.div initial={{ scale: 0.3, rotate: -10, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 12 }} className="text-7xl">
        {won ? "🏆" : "💀"}
      </motion.div>
      <p className={cn("text-4xl font-black", won ? "text-calamansi" : "text-guava")}>{won ? "You win!" : "You lose!"}</p>
      <p className="text-lg font-bold">{o.winner === "crew" ? "The crew caught the impostor" : "The impostor got away"}</p>
      <div className="w-full space-y-1 rounded-2xl bg-card/70 p-4">
        <p className="text-sm text-muted-foreground">The secret word was</p>
        <p className="text-3xl font-black">{o.word}</p>
        <p className="text-sm text-muted-foreground">
          {o.impostors.length > 1 ? "Impostors" : "Impostor"}: <b className="text-foreground">{o.impostors.map((p) => p.nickname).join(", ")}</b>
          {secret?.role === "impostor" && " (you!)"}
        </p>
      </div>
      {mine.lastRound && <p className="text-3xl font-black tabular-nums">{mine.lastRound.points > 0 ? `+${mine.lastRound.points}` : "0"} pts</p>}
    </div>
  );
}

/* ─── Display ────────────────────────────────────────────────────────── */

export function DisplayTurn({ pub }: { pub: Extract<ImpostorRound, { kind: "turn" }> }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-[calc(1.5rem*var(--fit-c,1))]">
      {/* One row on wide screens (category · player · turn); wraps on narrow ones. */}
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-center lg:gap-x-12">
        <CategoryChip category={pub.category} className="text-base lg:text-xl" />
        <motion.div key={pub.turnPlayer.playerId} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 180, damping: 14 }} className="flex items-center gap-4">
          <AvatarBubble avatar={pub.turnPlayer.avatar} size="xl" className="max-sm:size-16 max-sm:text-3xl" />
          <div className="text-left">
            <p className="text-[length:calc(2.25rem*var(--fit-q,1))] leading-none font-black sm:text-[length:calc(3.75rem*var(--fit-q,1))] lg:text-[length:calc(6rem*var(--fit-q,1))]">{pub.turnPlayer.nickname}</p>
            <p className="mt-1 text-lg font-bold text-mango sm:text-2xl lg:text-3xl">your clue! 🎤</p>
          </div>
        </motion.div>
        <p className="text-base font-semibold text-muted-foreground sm:text-xl">
          {pub.clueRounds > 1 ? `Round ${pub.clueRound} of ${pub.clueRounds} · ` : ""}Turn {pub.turn} of {pub.turns}
        </p>
      </div>
      <ClueBoard clues={pub.clues} size="lg" />
    </div>
  );
}

export function DisplayVote({ pub }: { pub: Extract<ImpostorRound, { kind: "vote" }> }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-[calc(1.5rem*var(--fit-c,1))]">
      <div className="text-center">
        <p className="text-[length:calc(2.25rem*var(--fit-q,1))] font-black sm:text-[length:calc(3.75rem*var(--fit-q,1))] lg:text-[length:calc(4.5rem*var(--fit-q,1))]">
          {pub.revote ? "Revote!" : "Who's the impostor?"} <span aria-hidden>🕵️</span>
        </p>
        <p className="text-lg text-muted-foreground sm:text-2xl">Vote on your phone. Votes stay secret until everyone's in.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3 lg:gap-6">
        {pub.candidates.map((c, i) => (
          <motion.div key={c.playerId} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.05 }} className="flex w-24 flex-col items-center gap-2 sm:w-32 lg:w-40">
            <AvatarBubble avatar={c.avatar} size="lg" />
            <span className="max-w-full truncate text-lg font-bold sm:text-2xl">{c.nickname}</span>
          </motion.div>
        ))}
      </div>
      <ClueBoard clues={pub.clues} size="lg" />
    </div>
  );
}

export function DisplayClueReveal({ r }: { r: Extract<ImpostorReveal, { kind: "clue" }> }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="flex items-center gap-3">
        <AvatarBubble avatar={r.player.avatar} size="lg" />
        <span className="text-3xl font-black sm:text-5xl">{r.player.nickname}</span>
      </div>
      <motion.p
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 12 }}
        className={cn("max-w-full break-words", r.clue ? "text-[length:calc(4rem*var(--fit-q,1))] font-black text-mango sm:text-[length:calc(6rem*var(--fit-q,1))] lg:text-[length:calc(9rem*var(--fit-q,1))]" : "text-4xl font-bold text-muted-foreground sm:text-6xl")}
      >
        {r.clue ? `“${r.clue}”` : "🗣️ said it out loud"}
      </motion.p>
    </div>
  );
}

export function DisplayVotes({ r }: { r: Extract<ImpostorReveal, { kind: "votes" }> }) {
  const max = Math.max(1, ...r.tally.map((t) => t.votes));
  const o = r.outcome;
  const caught = o?.winner === "crew";
  useEffect(() => {
    if (o) playSound("win");
  }, [o]);
  return (
    <div className="flex flex-1 flex-col justify-center gap-[calc(1.25rem*var(--fit-c,1))] lg:flex-row lg:items-center lg:gap-10">
      <ol className="w-full space-y-2 lg:flex-1 lg:space-y-3">
        {r.tally.map((t, i) => {
          const isImp = o?.impostors.some((p) => p.playerId === t.playerId);
          const voters = r.ballots.filter((b) => b.targetId === t.playerId).map((b) => b.voterName);
          return (
            <motion.li
              key={t.playerId}
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              className={cn("glass relative flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-2.5 lg:px-6 lg:py-4", isImp && "border-guava ring-2 ring-guava")}
            >
              <motion.span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-primary/25"
                initial={{ width: 0 }}
                animate={{ width: `${(t.votes / max) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.3 + i * 0.08 }}
              />
              <AvatarBubble avatar={t.avatar} size="sm" className="relative" />
              <span className="relative min-w-0 flex-1">
                <span className="block truncate text-xl font-extrabold lg:text-3xl">
                  {t.nickname} {isImp && <span className="text-guava">🕵️</span>}
                </span>
                {voters.length > 0 && <span className="block truncate text-sm text-muted-foreground lg:text-lg">{voters.join(", ")}</span>}
              </span>
              <span className="relative text-3xl font-black tabular-nums lg:text-5xl">{t.votes}</span>
            </motion.li>
          );
        })}
      </ol>

      <div className="w-full text-center lg:max-w-xl lg:flex-1">
        {!o ? (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.6 }} className="space-y-2">
            <p className="text-6xl lg:text-8xl">🤝</p>
            <p className="text-4xl font-black lg:text-6xl">It's a tie!</p>
            <p className="text-xl text-muted-foreground lg:text-2xl">{r.tied.map((t) => t.nickname).join(" vs ")}. The host can call a revote or reveal the impostor.</p>
          </motion.div>
        ) : (
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.9, type: "spring", stiffness: 160, damping: 12 }} className="space-y-3">
            {o.accused ? (
              <p className="text-2xl font-bold lg:text-4xl">
                {o.accused.nickname} was{" "}
                <span className={cn("font-black", caught ? "text-calamansi" : "text-guava")}>{caught ? "the Impostor!" : "innocent!"}</span>
              </p>
            ) : (
              <p className="text-2xl font-bold lg:text-4xl">No decision: the tie stands.</p>
            )}
            <motion.p initial={{ scale: 0.4 }} animate={{ scale: [0.4, 1.15, 1] }} transition={{ delay: 1.3, duration: 0.6 }} className={cn("text-5xl font-black lg:text-7xl", caught ? "text-calamansi" : "text-guava")}>
              {caught ? "Crew wins! 🎉" : "Impostor wins! 😈"}
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.9 }} className="glass mx-auto inline-flex flex-col items-center gap-2 rounded-3xl border px-6 py-4">
              <span className="text-lg text-muted-foreground lg:text-2xl">The secret word was</span>
              <span className="text-4xl font-black lg:text-6xl">{o.word}</span>
              <span className="flex flex-wrap items-center justify-center gap-2 text-lg lg:text-2xl">
                <VenetianMask className="size-6 text-guava" />
                {o.impostors.map((p) => (
                  <span key={p.playerId} className="inline-flex items-center gap-1.5 font-bold">
                    <AvatarBubble avatar={p.avatar} size="xs" /> {p.nickname}
                  </span>
                ))}
              </span>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

