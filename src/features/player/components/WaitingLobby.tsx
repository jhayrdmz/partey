import { Tv, Users } from "lucide-react";
import { motion } from "motion/react";
import type { RoomDoc } from "@shared/types";
import { AvatarBubble } from "@/components/shared/AvatarBubble";
import { getGame } from "@/features/games/registry";
import { WaitingBar } from "./WaitingBar";

export function WaitingLobby({ room, nickname, avatar }: { room: RoomDoc; nickname: string; avatar: string }) {
  const nextEntry = room.lineup[room.gameMode === "tournament" ? room.currentGameIndex : 0];
  const next = nextEntry ? getGame(nextEntry.gameId) : null;
  // At least this player (presence can lag behind the join).
  const connected = room.connectedPlayerCount || 1;
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}>
          <AvatarBubble avatar={avatar} size="xl" className="animate-float" />
        </motion.div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-success">You're in!</p>
          <h1 className="text-3xl font-extrabold">Hi, {nickname}!</h1>
          <p className="text-muted-foreground">
            Welcome to <span className="font-bold text-foreground">{room.roomName}</span>
          </p>
        </div>

        <div className="w-full space-y-3 rounded-2xl border bg-card/70 p-5 text-left">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Users className="size-5" /> {connected} player{connected === 1 ? "" : "s"} connected
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Tv className="size-5" /> Keep your eyes on the big screen — and this phone in your hand.
          </div>
          {next && (
            <div className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3 text-sm">
              <span className="text-2xl">{next.art.emoji}</span>
              <span>
                Up next: <span className="font-bold">{next.meta.name}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <WaitingBar label="Waiting for the host to start…" />
    </div>
  );
}
