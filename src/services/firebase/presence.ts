import { onDisconnect, onValue, ref, serverTimestamp, set } from "firebase/database";
import type { PresenceRole } from "@shared/types";
import { firebase } from "./app";

/**
 * Realtime Database presence for one participant in one room.
 * `onDisconnect()` is (re)armed on every reconnect so the server marks us
 * offline even if the tab is killed. A Cloud Function mirrors this into Firestore.
 */
export function startPresence(
  roomId: string,
  uid: string,
  role: PresenceRole,
  onConnectionChange?: (connected: boolean) => void,
): () => void {
  const { database } = firebase();
  const node = ref(database, `presence/${roomId}/${uid}`);
  const connectedRef = ref(database, ".info/connected");
  let stopped = false;

  const unsubscribe = onValue(connectedRef, (snap) => {
    const connected = snap.val() === true;
    onConnectionChange?.(connected);
    if (!connected || stopped) return;
    onDisconnect(node)
      .set({ state: "offline", role, lastChanged: serverTimestamp() })
      .then(() => set(node, { state: "online", role, lastChanged: serverTimestamp() }))
      .catch((err) => console.warn("[presence] failed to register", err));
  });

  return () => {
    stopped = true;
    unsubscribe();
    set(node, { state: "offline", role, lastChanged: serverTimestamp() }).catch(() => undefined);
    onDisconnect(node).cancel().catch(() => undefined);
  };
}
