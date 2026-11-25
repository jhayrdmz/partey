import { useMemo } from "react";
import { refs } from "@/services/firebase";
import type { PlayerDoc } from "@shared/types";
import type { WithId } from "@/services/firebase";
import { useLiveDoc, useLiveQuery } from "./useFirestore";

/** Live room document. `enabled` gates the listener until membership is established. */
export function useRoom(roomId: string | undefined, enabled = true) {
  const on = Boolean(roomId && enabled);
  return useLiveDoc(on ? refs.room(roomId!) : null, on ? `room:${roomId}` : "off");
}

export function useDisplayState(roomId: string | undefined, enabled = true) {
  const on = Boolean(roomId && enabled);
  return useLiveDoc(on ? refs.displayState(roomId!) : null, on ? `display:${roomId}` : "off");
}

const statusOrder: Record<PlayerDoc["status"], number> = { online: 0, offline: 1, left: 2, kicked: 3 };

/** Players still in the room (online or temporarily offline), ordered by join time. */
export function usePlayers(roomId: string | undefined, enabled = true) {
  const on = Boolean(roomId && enabled);
  const live = useLiveQuery(on ? refs.activePlayers(roomId!) : null, on ? `players:${roomId}` : "off");
  const players = useMemo(
    () =>
      [...live.data].sort(
        (a: WithId<PlayerDoc>, b: WithId<PlayerDoc>) =>
          (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0) || statusOrder[a.status] - statusOrder[b.status],
      ),
    [live.data],
  );
  return { ...live, data: players };
}
