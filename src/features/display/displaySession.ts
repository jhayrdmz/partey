const KEY = "partey.display-room";

export function rememberDisplayRoom(roomId: string) {
  try {
    localStorage.setItem(KEY, roomId);
  } catch {
    /* ignore */
  }
}
export function lastDisplayRoom(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export function forgetDisplayRoom() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
