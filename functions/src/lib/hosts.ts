/**
 * Free-tier host slots (hosts/{uid}). A host claims a slot when they create a room; the slot stays
 * active while they're active (any host action, keepAlive, reconnect) and expires after
 * HOST_INACTIVITY_MINUTES of nothing, which also ends their rooms (see maintenance.ts).
 * Hosts tagged `tier: "paid"` never expire and skip every limit.
 */
import type { DocumentSnapshot, Transaction } from "firebase-admin/firestore";
import { KEEPALIVE_WRITE_MIN_MS, MINUTE_MS } from "../../../shared/constants";
import type { HostDoc, HostTier } from "../../../shared/types";
import { HOSTS, SYSTEM, Timestamp, db } from "./admin";
import { hostInactivityMinutes } from "../config";

export const hostRef = (uid: string) => db.collection(HOSTS).doc(uid);
/** Every slot claim reads and writes this doc, so concurrent claims serialize (no overshoot). */
export const hostSlotLockRef = () => db.collection(SYSTEM).doc("hostSlots");
/** Active free hosts (paid hosts have expiresAt null, so the range filter leaves them out). */
export const activeFreeHostsQuery = (now: Timestamp) => db.collection(HOSTS).where("status", "==", "active").where("expiresAt", ">", now);

type StoredHost = Omit<HostDoc, "createdAt" | "lastActiveAt" | "expiresAt"> & {
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
  expiresAt: Timestamp | null;
};

export function readHost(snap: DocumentSnapshot): StoredHost | null {
  return snap.exists ? (snap.data() as StoredHost) : null;
}

export const isPaid = (host: Pick<StoredHost, "tier"> | null) => host?.tier === "paid";

/** The host holds a live slot right now (paid hosts always do). */
export function hasActiveSlot(host: StoredHost | null, nowMs: number): boolean {
  if (!host || host.status !== "active") return false;
  return isPaid(host) || (host.expiresAt !== null && host.expiresAt.toMillis() > nowMs);
}

/** Fields that (re)activate a slot as of now. */
export function activeHostFields(tier: HostTier, nowMs: number) {
  return {
    tier,
    status: "active" as const,
    lastActiveAt: Timestamp.fromMillis(nowMs),
    expiresAt: tier === "paid" ? null : Timestamp.fromMillis(nowMs + hostInactivityMinutes.value() * MINUTE_MS),
  };
}

/**
 * Mark the host active (extends a free slot). Only extends a slot that's still live, never
 * re-opens an expired one (that takes a new room, which checks the limit). Throttled.
 * Write-only: pass the host snapshot read earlier in the transaction.
 */
export function touchHostTx(tx: Transaction, uid: string, host: StoredHost | null, nowMs: number): void {
  if (!hasActiveSlot(host, nowMs)) return;
  if (nowMs - host!.lastActiveAt.toMillis() < KEEPALIVE_WRITE_MIN_MS) return;
  tx.update(hostRef(uid), activeHostFields(host!.tier, nowMs));
}
