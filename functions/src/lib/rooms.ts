/** Room access checks and the bookkeeping every room mutation shares (activity + expiry). */
import type { DocumentSnapshot, Transaction } from "firebase-admin/firestore";
import { EXPIRY, MINUTE_MS } from "../../../shared/constants";
import { roomInactivityMinutes } from "../config";
import { computeExpiresAtMs } from "../../../shared/expiry";
import type { RoomDoc } from "../../../shared/types";
import { Timestamp, roomRef } from "./admin";
import { fail } from "./errors";

type TimestampKeys = "createdAt" | "lastActivityAt" | "hostDisconnectedAt" | "allDisconnectedAt" | "finishedAt" | "expiresAt" | "ttlAt";

/** rooms/{roomId} as stored by the Admin SDK. */
export type ServerRoom = Omit<RoomDoc, TimestampKeys> & {
  createdAt: Timestamp;
  lastActivityAt: Timestamp;
  hostDisconnectedAt: Timestamp | null;
  allDisconnectedAt: Timestamp | null;
  finishedAt: Timestamp | null;
  expiresAt: Timestamp | null;
  ttlAt: Timestamp | null;
};

/** Not tombstoned and not past its logical expiry (the sweep may not have run yet). */
export function isRoomLive(room: Pick<ServerRoom, "status" | "expiresAt">, nowMs = Date.now()): boolean {
  if (room.status === "expired") return false;
  return !room.expiresAt || room.expiresAt.toMillis() > nowMs;
}

export function readLiveRoom(snap: DocumentSnapshot): ServerRoom {
  const room = snap.data() as ServerRoom | undefined;
  if (!snap.exists || !room || !isRoomLive(room)) fail("not-found", "This room has ended or doesn't exist.");
  return room;
}

/** Read a live room inside a transaction. Call before any transaction write. */
export async function getLiveRoomTx(tx: Transaction, roomId: string): Promise<ServerRoom> {
  return readLiveRoom(await tx.get(roomRef(roomId)));
}

export function assertHost(room: Pick<ServerRoom, "hostId">, uid: string): void {
  if (room.hostId !== uid) fail("permission-denied", "Only the host can do that.");
}

/**
 * Recompute `expiresAt`/`ttlAt` for the room with `patch` applied.
 * `ttlAt` (Firestore TTL) trails logical expiry by a buffer so the sweep cleans up first.
 */
export function expiryFields(room: ServerRoom, patch: Partial<ServerRoom>, nowMs: number): { expiresAt: Timestamp | null; ttlAt: Timestamp | null } {
  const r = { ...room, ...patch };
  const expiresAtMs = computeExpiresAtMs({
    status: r.status,
    nowMs,
    lastActivityAtMs: r.lastActivityAt?.toMillis() ?? nowMs,
    hostConnected: r.hostConnected,
    hostDisconnectedAtMs: r.hostDisconnectedAt?.toMillis() ?? null,
    connectedOthers: (r.connectedPlayerCount ?? 0) + (r.connectedDisplayCount ?? 0),
    allDisconnectedAtMs: r.allDisconnectedAt?.toMillis() ?? null,
    finishedAtMs: r.finishedAt?.toMillis() ?? null,
    waitingInactivityMs: roomInactivityMinutes.value() * MINUTE_MS,
  });
  if (expiresAtMs === null) return { expiresAt: null, ttlAt: null };
  return { expiresAt: Timestamp.fromMillis(expiresAtMs), ttlAt: Timestamp.fromMillis(expiresAtMs + EXPIRY.ttlBufferMs) };
}

/** Apply `patch` to the room, mark it active now and refresh its expiry. Write-only (no reads). */
export function touchRoomTx(tx: Transaction, roomId: string, room: ServerRoom, patch: Partial<ServerRoom>): void {
  const now = Timestamp.now();
  const full: Partial<ServerRoom> = { ...patch, lastActivityAt: now };
  tx.update(roomRef(roomId), { ...full, ...expiryFields(room, full, now.toMillis()) });
}
