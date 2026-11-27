import { Crown, Medal } from "lucide-react";
import type { DisplayStateDoc } from "@shared/types";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import { cn } from "@/utils/cn";
import { WaitingBar } from "./WaitingBar";

import { sharedPlaces, type StandingEntry as Standing } from "@shared/engine";

export function PlayerResults({ state, playerId }: { state: DisplayStateDoc; playerId: string }) {
  const standings: Standing[] = state.publicResults?.standings ?? [];
  const places = sharedPlaces(standings);
  const index = standings.findIndex((s) => s.playerId === playerId);
  const me = standings[index];
  const champion = state.currentScreen === "champion";
  return (
    <div className="flex flex-1 flex-col items-center gap-6 text-center">
      <div className="space-y-2 pt-4">
        {champion ? <Crown className="mx-auto size-12 text-mango" /> : <Medal className="mx-auto size-12 text-sky" />}
        <h1 className="text-3xl font-extrabold">{champion ? "Final results" : state.currentScreen === "leaderboard" ? "Leaderboard" : "Game over"}</h1>
        {me && (
          <p className="text-lg">
            You're <span className="font-extrabold text-mango">#{places[index]}</span> with{" "}
            <span className="font-extrabold">{me.score} pts</span>
            {me.delta !== undefined && <span className="text-calamansi"> (+{me.delta})</span>}
          </p>
        )}
      </div>
      <ol className="w-full space-y-2">
        {standings.slice(0, 5).map((s, i) => (
          <li
            key={s.playerId}
            className={cn("flex items-center gap-3 rounded-2xl bg-card p-3 text-left", s.playerId === playerId && "ring-2 ring-primary")}
          >
            <span className="w-6 text-center font-extrabold text-muted-foreground">{places[i]}</span>
            <AvatarBubble avatar={s.avatar} size="sm" />
            <span className="min-w-0 flex-1 truncate font-bold">
              {s.nickname}
              {s.detail && <span className="block truncate text-xs font-semibold text-muted-foreground">{s.detail}</span>}
            </span>
            {s.delta !== undefined && <span className="text-sm font-bold text-calamansi tabular-nums">+{s.delta}</span>}
            <span className="font-extrabold tabular-nums">{s.score}</span>
          </li>
        ))}
      </ol>
      <WaitingBar label={champion ? "Thanks for playing! Salamat!" : "Waiting for the host to continue…"} waiting={!champion} />
    </div>
  );
}
