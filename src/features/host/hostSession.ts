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
