import { useEffect, useState } from "react";
import type { PresenceRole } from "@shared/types";
import { startPresence } from "@/services/firebase";

/** Registers RTDB presence while mounted. Returns whether the realtime link is up. */
export function usePresence(roomId: string | undefined, uid: string | undefined, role: PresenceRole, enabled = true) {
  const [connected, setConnected] = useState(true);
  useEffect(() => {
    if (!roomId || !uid || !enabled) return;
    return startPresence(roomId, uid, role, setConnected);
  }, [roomId, uid, role, enabled]);
  return connected;
}
