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
    <div className="grid min-h-dvh grid-rows-[1fr_auto] gap-4 p-4 sm:gap-6 sm:p-6 lg:p-10 3xl:p-16">
      <div className="grid items-center gap-5 sm:gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        {/* Join panel */}
        <section className="flex flex-col items-center gap-4 text-center sm:gap-6 lg:items-start lg:text-left">
          <div>
            <p className="text-base font-bold text-muted-foreground sm:text-xl lg:text-2xl">Welcome to</p>
            <h1 className="text-3xl font-extrabold leading-tight break-words sm:text-4xl lg:text-6xl 3xl:text-7xl">{room.roomName}</h1>
          </div>
          {/* Side by side on portrait tablets; stacked in the two-column (lg+) layout, where the left column is too narrow for both. */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6 lg:flex-col lg:items-start lg:gap-5">
            <JoinQr roomCode={room.roomCode} size={320} className="w-40 shrink-0 p-2 sm:w-56 sm:p-3 3xl:w-64 3xl:p-4" />
            <div className="flex min-w-0 flex-col items-center space-y-2 sm:space-y-4 lg:items-start lg:space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground sm:text-lg lg:text-xl">
                <Smartphone className="size-5 text-calamansi sm:size-6" /> Scan to join, or go to
              </p>
              <p className="text-lg font-extrabold break-all text-sky sm:text-2xl lg:text-3xl">{joinUrlLabel()}</p>
              <RoomCode code={room.roomCode} size="lg" className="max-sm:[&>span]:size-14 max-sm:[&>span]:text-3xl lg:[&>span]:size-16 lg:[&>span]:text-4xl 3xl:[&>span]:size-24 3xl:[&>span]:text-6xl" />
            </div>
          </div>
        </section>

        {/* Players */}
        <section className="glass flex h-full min-h-40 flex-col rounded-3xl border p-4 sm:min-h-72 sm:p-6 lg:p-8">
          <div className="mb-4 flex items-center justify-between sm:mb-6">
            <h2 className="flex items-center gap-3 text-xl font-extrabold sm:text-2xl lg:text-3xl">
              <Users className="size-6 text-mango sm:size-8" /> Players
            </h2>
            <span className="rounded-md bg-primary/20 px-3 py-1 text-xl font-extrabold tabular-nums sm:px-4 sm:py-1.5 sm:text-2xl lg:text-3xl">{players.length}</span>
          </div>
          {players.length === 0 ? (
            <div className="grid flex-1 place-items-center text-center">
              <div className="space-y-3">
                <p className="text-4xl sm:text-6xl">📱</p>
                <p className="text-lg font-bold text-muted-foreground sm:text-2xl">Grab your phone and join!</p>
              </div>
            </div>
          ) : (
            <ul className="grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-4 sm:gap-x-4 sm:gap-y-6 xl:grid-cols-5">
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
                    <AvatarBubble avatar={p.avatar} size="lg" className="max-sm:size-14 max-sm:text-3xl lg:size-28 lg:text-6xl 3xl:size-32 3xl:text-7xl" />
                    <span className="max-w-full truncate text-sm font-bold sm:text-lg lg:text-2xl">{p.nickname}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>
      </div>

      <footer className="glass flex flex-wrap items-center justify-center gap-x-8 gap-y-1 rounded-2xl border px-4 py-3 text-center text-sm font-semibold sm:gap-y-2 sm:px-6 sm:py-4 sm:text-lg lg:text-xl">
        <span className="flex items-center gap-2 sm:gap-3">
          <Hourglass className="size-5 animate-pulse text-mango sm:size-6" /> Waiting for the host to start
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
