import { Hourglass, Smartphone, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { PlayerDoc, RoomDoc } from "@shared/types";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import { JoinQr } from "@/components/shared/JoinQr";
import { RoomCode } from "@/components/shared/RoomCode";
import { getGame } from "@/features/games/registry";
import type { WithId } from "@/services/firebase";
import { joinUrlLabel } from "@/utils/urls";

export function DisplayLobby({ room, players }: { room: RoomDoc; players: WithId<PlayerDoc>[] }) {
  const isTournament = room.gameMode === "tournament";
  const nextEntry = room.lineup[isTournament ? room.currentGameIndex : 0];
  const next = nextEntry ? getGame(nextEntry.gameId) : null;
  return (
    <div className="grid min-h-dvh grid-rows-[1fr_auto] gap-6 p-6 lg:p-10 3xl:p-16">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        {/* Join panel */}
        <section className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
          <div>
            <p className="text-xl font-bold text-muted-foreground lg:text-2xl">Welcome to</p>
            <h1 className="text-4xl font-extrabold leading-tight lg:text-6xl 3xl:text-7xl">{room.roomName}</h1>
          </div>
          <div className="flex flex-col items-center gap-6 sm:flex-row lg:items-center">
            <JoinQr roomCode={room.roomCode} size={320} className="w-56 shrink-0 lg:w-64 3xl:w-80 3xl:p-4" />
            <div className="space-y-4">
              <p className="flex items-center gap-2 text-lg font-semibold text-muted-foreground lg:text-xl">
                <Smartphone className="size-6 text-calamansi" /> Scan to join, or go to
              </p>
              <p className="text-2xl font-extrabold text-sky lg:text-3xl">{joinUrlLabel()}</p>
              <RoomCode code={room.roomCode} size="lg" className="3xl:[&>span]:size-28 3xl:[&>span]:text-7xl" />
            </div>
          </div>
        </section>

        {/* Players */}
        <section className="glass flex h-full min-h-72 flex-col rounded-3xl border p-6 lg:p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-3 text-2xl font-extrabold lg:text-3xl">
              <Users className="size-8 text-mango" /> Players
            </h2>
            <span className="rounded-full bg-primary/20 px-4 py-1.5 text-2xl font-extrabold tabular-nums lg:text-3xl">{players.length}</span>
          </div>
          {players.length === 0 ? (
            <div className="grid flex-1 place-items-center text-center">
              <div className="space-y-3">
                <p className="text-6xl">📱</p>
                <p className="text-2xl font-bold text-muted-foreground">Grab your phone and join!</p>
              </div>
            </div>
          ) : (
            <ul className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 xl:grid-cols-5">
              <AnimatePresence>
                {players.map((p) => (
                  <motion.li
                    key={p.id}
                    layout
                    initial={{ scale: 0, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: p.status === "online" ? 1 : 0.45, y: 0 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 16 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <AvatarBubble avatar={p.avatar} size="lg" className="lg:size-28 lg:text-6xl 3xl:size-32 3xl:text-7xl" />
                    <span className="max-w-full truncate text-lg font-bold lg:text-2xl">{p.nickname}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>
      </div>

      <footer className="glass flex flex-wrap items-center justify-center gap-x-8 gap-y-2 rounded-2xl border px-6 py-4 text-lg font-semibold lg:text-xl">
        <span className="flex items-center gap-3">
          <Hourglass className="size-6 animate-pulse text-mango" /> Waiting for the host to start
        </span>
        {next && (
          <span className="text-muted-foreground">
            {isTournament ? `Game ${room.currentGameIndex + 1} of ${room.lineup.length}: ` : "Up next: "}
            <span className="text-foreground">
              {next.art.emoji} {next.meta.name}
            </span>
          </span>
        )}
      </footer>
    </div>
  );
}
