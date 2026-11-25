import { Crown, Medal } from "lucide-react";
import type { DisplayStateDoc } from "@shared/types";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import { cn } from "@/utils/cn";

interface Standing {
  playerId: string;
  nickname: string;
  avatar: string;
  score: number;
}

export function PlayerResults({ state, playerId }: { state: DisplayStateDoc; playerId: string }) {
  const standings = ((state.publicResults as { standings?: Standing[] } | null)?.standings ?? []) as Standing[];
  const rank = standings.findIndex((s) => s.playerId === playerId);
  const me = standings[rank];
  const champion = state.currentScreen === "champion";
  return (
    <div className="flex flex-1 flex-col items-center gap-6 text-center">
      <div className="space-y-2 pt-4">
        {champion ? <Crown className="mx-auto size-12 text-mango" /> : <Medal className="mx-auto size-12 text-sky" />}
        <h1 className="text-3xl font-extrabold">{champion ? "Final results" : state.currentScreen === "leaderboard" ? "Leaderboard" : "Game over"}</h1>
        {me && (
          <p className="text-lg">
            You placed <span className="font-extrabold text-mango">#{rank + 1}</span> with{" "}
            <span className="font-extrabold">{me.score} pts</span>
          </p>
        )}
      </div>
      <ol className="w-full space-y-2">
        {standings.slice(0, 5).map((s, i) => (
          <li
            key={s.playerId}
            className={cn("flex items-center gap-3 rounded-2xl bg-card/70 p-3 text-left", s.playerId === playerId && "ring-2 ring-primary")}
          >
            <span className="w-6 text-center font-extrabold text-muted-foreground">{i + 1}</span>
            <AvatarBubble avatar={s.avatar} size="sm" />
            <span className="flex-1 truncate font-bold">{s.nickname}</span>
            <span className="font-extrabold tabular-nums">{s.score}</span>
          </li>
        ))}
      </ol>
      <p className="mt-auto text-sm text-muted-foreground">{champion ? "Thanks for playing! Salamat!" : "Waiting for the host to continue…"}</p>
    </div>
  );
}
