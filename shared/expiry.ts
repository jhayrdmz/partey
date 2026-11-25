/**
 * Pure room-expiry policy. Given the room's current lifecycle facts, compute
 * when it should logically expire. `null` = no automatic expiry.
 *
 * Policy:
 *  - finished:                       finishedAt + 15 min
 *  - nobody connected (host+players+displays all offline):
 *                                    allDisconnectedAt + 8 h
 *  - waiting (lobby):                lastActivityAt + 30 min, but never sooner
 *                                    than the host grace when the host dropped
 *  - playing, host disconnected:     hostDisconnectedAt + 8 h
 *  - playing, someone connected:     null (no inactivity expiry)
 */
import { EXPIRY } from "./constants";
import type { RoomStatus } from "./types";

export interface ExpiryInput {
  status: RoomStatus;
  nowMs: number;
  lastActivityAtMs: number;
  hostConnected: boolean;
  hostDisconnectedAtMs: number | null;
  /** Players + displays currently online (host excluded). */
  connectedOthers: number;
  allDisconnectedAtMs: number | null;
  finishedAtMs: number | null;
}

export function computeExpiresAtMs(input: ExpiryInput): number | null {
  const { status } = input;
  if (status === "expired") return input.nowMs;

  if (status === "finished") {
    return (input.finishedAtMs ?? input.nowMs) + EXPIRY.finishedMs;
  }

  const anyoneConnected = input.hostConnected || input.connectedOthers > 0;
  if (!anyoneConnected) {
    const since = input.allDisconnectedAtMs ?? input.nowMs;
    const allGone = since + EXPIRY.allDisconnectedGraceMs;
    if (status === "waiting") {
      // An idle lobby still expires after 30 minutes of no activity.
      return Math.min(allGone, Math.max(input.lastActivityAtMs + EXPIRY.waitingInactivityMs, input.nowMs));
    }
    return allGone;
  }

  if (status === "waiting") {
    return input.lastActivityAtMs + EXPIRY.waitingInactivityMs;
  }

  // playing
  if (!input.hostConnected) {
    return (input.hostDisconnectedAtMs ?? input.nowMs) + EXPIRY.hostGraceMs;
  }
  return null;
}
