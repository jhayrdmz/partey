import { Crown, Trophy } from "lucide-react";
import { motion } from "motion/react";
import type { DisplayStateDoc } from "@shared/types";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import { RoomCode } from "@/components/shared/RoomCode";
import { getGame } from "@/features/games/registry";
import { cn } from "@/utils/cn";

interface Standing {
  playerId: string;
  nickname: string;
  avatar: string;
  score: number;
}

const podiumStyle = [
  { height: "h-56 lg:h-72", color: "from-mango to-[oklch(0.7_0.17_60)]", label: "1st" },
  { height: "h-40 lg:h-52", color: "from-slate-300 to-slate-500", label: "2nd" },
  { height: "h-28 lg:h-40", color: "from-[oklch(0.7_0.12_50)] to-[oklch(0.55_0.12_45)]", label: "3rd" },
];

/** Results / leaderboard / champion screens share one layout. */
export function DisplayStandings({ state, roomCode }: { state: DisplayStateDoc; roomCode: string }) {
  const standings = ((state.publicResults as { standings?: Standing[] } | null)?.standings ?? []) as Standing[];
  const champion = state.currentScreen === "champion";
  const game = state.gameId ? getGame(state.gameId) : null;
  const top = standings.slice(0, 3);
  const rest = standings.slice(3, 10);
  // Podium order: 2nd, 1st, 3rd
  const podium = [top[1], top[0], top[2]].map((s, i) => ({ s, place: [1, 0, 2][i] }));

  const title = champion ? "Champion!" : state.currentScreen === "leaderboard" ? "Overall leaderboard" : `${game?.meta.name ?? "Game"} results`;

  return (
    <div className="flex min-h-dvh flex-col gap-8 p-6 lg:p-12">
      <header className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {champion ? <Crown className="size-14 text-mango" /> : <Trophy className="size-12 text-sky" />}
          <div>
            <h1 className="text-4xl font-extrabold lg:text-6xl">{title}</h1>
            {champion && top[0] && (
              <p className="text-2xl font-bold text-mango lg:text-3xl">
                Congratulations, {top[0].nickname}! 🎉
              </p>
            )}
            {state.currentScreen === "leaderboard" && state.gameNumber && state.totalGames && (
              <p className="text-xl text-muted-foreground lg:text-2xl">
                After game {state.gameNumber} of {state.totalGames}
              </p>
            )}
          </div>
        </div>
        {!champion && (
          <div className="hidden items-center gap-4 md:flex">
            <span className="text-lg font-semibold text-muted-foreground">Join with</span>
            <RoomCode code={roomCode} size="sm" />
          </div>
        )}
      </header>

      {standings.length === 0 ? (
        <div className="grid flex-1 place-items-center text-3xl font-bold text-muted-foreground">No scores yet.</div>
      ) : (
        <div className={cn("grid flex-1 items-end gap-10", rest.length > 0 && "lg:grid-cols-[3fr_2fr]")}>
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
                  {place === 0 && <Crown className="size-12 text-mango" />}
                  <AvatarBubble avatar={s.avatar} size={place === 0 ? "xl" : "lg"} />
                  <p className="max-w-full truncate text-xl font-extrabold lg:text-3xl">{s.nickname}</p>
                  <div className={cn("flex w-full flex-col items-center justify-start rounded-t-3xl bg-gradient-to-b pt-4 text-black", podiumStyle[place].height, podiumStyle[place].color)}>
                    <span className="text-3xl font-black lg:text-5xl">{podiumStyle[place].label}</span>
                    <span className="text-xl font-extrabold tabular-nums lg:text-2xl">{s.score} pts</span>
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
                  className="glass flex items-center gap-4 rounded-2xl border px-5 py-3 text-xl lg:text-2xl"
                >
                  <span className="w-8 font-extrabold text-muted-foreground">{i + 4}</span>
                  <AvatarBubble avatar={s.avatar} size="sm" />
                  <span className="flex-1 truncate font-bold">{s.nickname}</span>
                  <span className="font-extrabold tabular-nums">{s.score}</span>
                </motion.li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
