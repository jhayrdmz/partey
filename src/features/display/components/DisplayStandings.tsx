import { Crown, Trophy } from "lucide-react";
import { motion } from "motion/react";
import type { DisplayStateDoc } from "@shared/types";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import { RoomCode } from "@/components/shared/RoomCode";
import { getGame } from "@/features/games/registry";
import { cn } from "@/utils/cn";
import { FitToScreen } from "./FitToScreen";

import type { StandingEntry as Standing } from "@shared/engine";

const podiumStyle = [
  { height: "h-36 sm:h-56 lg:h-72", color: "from-mango to-[oklch(0.7_0.17_60)]", label: "1st" },
  { height: "h-28 sm:h-40 lg:h-52", color: "from-slate-300 to-slate-500", label: "2nd" },
  { height: "h-24 sm:h-32 lg:h-40", color: "from-[oklch(0.7_0.12_50)] to-[oklch(0.55_0.12_45)]", label: "3rd" },
];

/** Results / leaderboard / champion screens share one layout. */
export function DisplayStandings({ state, roomCode }: { state: DisplayStateDoc; roomCode: string }) {
  const standings: Standing[] = state.publicResults?.standings ?? [];
  const champion = state.currentScreen === "champion";
  const game = state.gameId ? getGame(state.gameId) : null;
  const top = standings.slice(0, 3);
  const rest = standings.slice(3, 10);
  // Podium order: 2nd, 1st, 3rd
  const podium = [top[1], top[0], top[2]].map((s, i) => ({ s, place: [1, 0, 2][i] }));

  const title = champion ? "Champion!" : state.currentScreen === "leaderboard" ? "Overall leaderboard" : `${game?.meta.name ?? "Game"} results`;

  return (
    // One screen tall; FitToScreen scales the content down if it doesn't fit (no scrolling on a TV).
    <div className="flex h-dvh flex-col overflow-hidden p-4 sm:p-6 lg:p-12 short:p-3">
      <FitToScreen>
      <div className="flex flex-1 flex-col gap-6 sm:gap-8">
      <header className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          {champion ? <Crown className="size-10 shrink-0 text-mango sm:size-14" /> : <Trophy className="size-9 shrink-0 text-sky sm:size-12" />}
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold sm:text-4xl lg:text-6xl">{title}</h1>
            {champion && top[0] && (
              <p className="text-lg font-bold text-mango sm:text-2xl lg:text-3xl">
                Congratulations, {top[0].nickname}! 🎉
              </p>
            )}
            {state.currentScreen === "leaderboard" && state.gameNumber && state.totalGames && (
              <p className="text-base text-muted-foreground sm:text-xl lg:text-2xl">
                After game {state.gameNumber} of {state.totalGames}
              </p>
            )}
          </div>
        </div>
        {!champion && (
          <div className="hidden flex-col items-end gap-1.5 md:flex">
            <span className="text-lg font-semibold text-muted-foreground">Join with</span>
            <RoomCode code={roomCode} size="sm" />
          </div>
        )}
      </header>

      {standings.length === 0 ? (
        <div className="grid flex-1 place-items-center text-3xl font-bold text-muted-foreground">No scores yet.</div>
      ) : (
        <div className={cn("grid flex-1 content-center items-end gap-6 sm:content-normal sm:gap-10", rest.length > 0 && "lg:grid-cols-[3fr_2fr] short:grid-cols-[3fr_2fr]")}>
          <div className="flex items-end justify-center gap-3 lg:gap-6">
            {podium.map(({ s, place }) =>
              s ? (
                <motion.div
                  key={s.playerId}
                  initial={{ y: 80, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 + (2 - place) * 0.35, type: "spring", stiffness: 120 }}
                  className="flex w-1/3 max-w-60 flex-col items-center gap-3"
                >
                  {place === 0 && <Crown className="size-9 text-mango sm:size-12" />}
                  <AvatarBubble avatar={s.avatar} size={place === 0 ? "xl" : "lg"} className={place === 0 ? "max-sm:size-20 max-sm:text-4xl" : "max-sm:size-14 max-sm:text-3xl"} />
                  <p className="max-w-full truncate text-base font-extrabold sm:text-xl lg:text-3xl">{s.nickname}</p>
                  <div className={cn("flex w-full flex-col items-center justify-start rounded-t-3xl bg-gradient-to-b pt-4 text-black", podiumStyle[place].height, podiumStyle[place].color)}>
                    <span className="text-2xl font-black sm:text-3xl lg:text-5xl">{podiumStyle[place].label}</span>
                    <span className="text-sm font-extrabold tabular-nums sm:text-xl lg:text-2xl">{s.score} pts</span>
                    {s.delta !== undefined && <span className="mt-1 rounded-full bg-black/15 px-2 text-sm font-bold sm:px-3 sm:text-lg">+{s.delta}</span>}
                  </div>
                </motion.div>
              ) : (
                <div key={place} className="w-1/3 max-w-60" />
              ),
            )}
          </div>
          {rest.length > 0 && (
            <ol className="space-y-3 self-center" start={4}>
              {rest.map((s, i) => (
                <motion.li
                  key={s.playerId}
                  initial={{ x: 40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 1.4 + i * 0.08 }}
                  className="glass flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-base sm:gap-4 sm:px-5 sm:py-3 sm:text-xl lg:text-2xl"
                >
                  <span className="w-8 font-extrabold text-muted-foreground">{i + 4}</span>
                  <AvatarBubble avatar={s.avatar} size="sm" />
                  <span className="flex-1 truncate font-bold">{s.nickname}</span>
                  {s.delta !== undefined && <span className="text-lg font-bold text-calamansi tabular-nums">+{s.delta}</span>}
                  <span className="font-extrabold tabular-nums">{s.score}</span>
                </motion.li>
              ))}
            </ol>
          )}
        </div>
      )}
      </div>
      </FitToScreen>
    </div>
  );
}
