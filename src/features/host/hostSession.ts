import { getDoc } from "firebase/firestore";
import { refs } from "@/services/firebase";

/** Remembers the last room this device hosted, so the host can jump back in after closing the tab. */
const KEY = "partey.last-hosted-room";

export interface LastHostedRoom {
  roomId: string;
  roomName: string;
  roomCode: string;
  savedAt: number;
}

export function saveLastHostedRoom(room: Omit<LastHostedRoom, "savedAt">) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...room, savedAt: Date.now() }));
  } catch {
    /* storage unavailable */
  }
}

export function loadLastHostedRoom(): LastHostedRoom | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastHostedRoom;
    // Hosts get an 8h reconnection grace period; don't offer older rooms.
    if (Date.now() - parsed.savedAt > 8 * 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLastHostedRoom() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Forget the saved room only if it's the given one (e.g. it turned out to be unavailable). */
export function forgetHostedRoom(roomId: string | undefined) {
  if (roomId && loadLastHostedRoom()?.roomId === roomId) clearLastHostedRoom();
}

/**
 * The saved room, but only if the server confirms it still exists and this user hosts it.
 * Rooms expire well before the 8h local limit (idle lobby: 30 min, finished: 15 min), so the
 * local record alone isn't enough. Rules deny reads of expired rooms and of rooms the caller
 * doesn't host, so "permission-denied" means gone. Network trouble keeps the offer.
 */
export async function verifyLastHostedRoom(uid: string): Promise<LastHostedRoom | null> {
  const saved = loadLastHostedRoom();
  if (!saved) return null;
  try {
    const snap = await getDoc(refs.room(saved.roomId));
    const room = snap.data();
    if (room && room.hostId === uid && room.status !== "expired") return saved;
    clearLastHostedRoom();
    return null;
  } catch (err) {
    if ((err as { code?: string }).code === "permission-denied") {
      clearLastHostedRoom();
      return null;
    }
    return saved; // offline or transient: can't tell, so keep offering it
  }
}
