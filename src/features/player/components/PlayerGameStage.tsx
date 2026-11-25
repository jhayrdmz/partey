import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Hourglass, Lock, Pause, Trophy, XCircle } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import type { PlayerPrivateDoc } from "@shared/engine";
import type { DisplayStateDoc } from "@shared/types";
import { useGameViews } from "@/features/games/engine/useGameViews";
import { useAutoTick } from "@/features/games/engine/useAutoTick";
import { TimerBar } from "@/features/games/shared/TimerBar";
import { getGame } from "@/features/games/registry";
import { useLiveDoc } from "@/hooks/useFirestore";
import { call, errorMessage, refs } from "@/services/firebase";
import { playSound } from "@/utils/sound";
import { cn } from "@/utils/cn";
import { GetReady } from "./GetReady";

function RoundResult({ me, totalRounds }: { me: PlayerPrivateDoc; totalRounds: number }) {
  const r = me.lastRound;
  const good = r?.correct === true;
  useEffect(() => {
    if (r) playSound(good ? "win" : "pop");
  }, [r, good]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      {r ? (
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 14 }} className="flex flex-col items-center gap-3">
          {good ? <CheckCircle2 className="size-24 text-success" /> : <XCircle className="size-24 text-guava" />}
          <p className="text-5xl font-black">{r.points > 0 ? `+${r.points}` : "0"}</p>
          {r.detail && <p className="text-lg text-muted-foreground">{r.detail}</p>}
        </motion.div>
      ) : (
        <p className="text-xl text-muted-foreground">Round skipped</p>
      )}
      <div className="w-full rounded-2xl bg-card/70 p-5">
        <p className="flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground">
          <Trophy className="size-4 text-mango" /> This game
        </p>
        <p className="mt-1 text-3xl font-black tabular-nums">{me.gameScore} pts</p>
        {me.rank && <p className="text-muted-foreground">You're #{me.rank}</p>}
      </div>
      <p className="text-sm text-muted-foreground">{me.round >= totalRounds ? "Final results coming up…" : "Next round coming up…"}</p>
    </div>
  );
}

/** Phone side of a running game. Reads only public displayState + the player's own private doc. */
export function PlayerGameStage({ roomId, uid, state }: { roomId: string; uid: string; state: DisplayStateDoc }) {
  const game = state.game;
  const me = useLiveDoc<PlayerPrivateDoc>(refs.private(roomId, uid), `private:${roomId}:${uid}`);
  const views = useGameViews(state.gameId);
  const [submitting, setSubmitting] = useState(false);
  // Optimistic lock so a double tap never sends twice, even before the private doc updates.
  const lockedRound = useRef<string | null>(null);
  useAutoTick(roomId, game);

  if (!game) return null;
  const roundKey = `${state.gameId}:${game.round}`;
  if (game.phase === "intro") return <GetReady state={state} />;

  const mine = me.data;
  const inRound = mine?.gameId === state.gameId && mine?.round === game.round;
  const answered = (inRound && mine?.answered) || lockedRound.current === roundKey;

  async function submit(answer: unknown) {
    if (lockedRound.current === roundKey || !game) return;
    lockedRound.current = roundKey;
    setSubmitting(true);
    if (navigator.vibrate) navigator.vibrate(30);
    try {
      await call("submitAnswer", { roomId, round: game.round, answer });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between text-sm font-bold text-muted-foreground">
        <span>
          Round {game.round}/{game.totalRounds}
        </span>
        {mine && <span className="text-mango tabular-nums">{mine.gameScore} pts</span>}
      </div>
      {game.phase === "question" && state.gameId && getGame(state.gameId).showTimer !== false && (
        <TimerBar endsAtMs={game.phaseEndsAtMs} durationMs={game.phaseDurationMs} paused={game.paused} remainingMs={game.remainingMs} />
      )}

      {game.paused && game.phase !== "question" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Pause className="size-16 text-mango" />
          <p className="text-2xl font-black">Paused</p>
        </div>
      )}

      {game.phase === "question" && !views && <div className="flex-1" />}
      {game.phase === "question" && views && (
        !inRound && mine?.round !== game.round && me.status === "ready" && !mine?.gameId ? (
          <Waiting icon={Hourglass} title="You're in the next round" text="You joined mid-round. Hang tight!" />
        ) : answered ? (
          views.PlayerAnswered ? (
            <views.PlayerAnswered game={game} me={mine} submit={submit} submitting={submitting} />
          ) : (
            <Waiting icon={Lock} title="Answer locked in!" text="Watch the big screen…" />
          )
        ) : (
          <views.PlayerQuestion game={game} me={mine} submit={submit} submitting={submitting} />
        )
      )}

      {game.phase === "reveal" && !game.paused && mine && <RoundResult me={mine} totalRounds={game.totalRounds} />}
    </div>
  );
}

function Waiting({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className={cn("flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl bg-card/60 text-center")}>
      <Icon className="size-14 text-primary" />
      <p className="text-2xl font-black">{title}</p>
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}
