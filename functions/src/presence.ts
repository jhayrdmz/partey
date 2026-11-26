import { onValueWritten } from "firebase-functions/v2/database";
import { logger } from "firebase-functions";
import { db, Timestamp, roomRef } from "./lib/admin";
import { expiryFields, isRoomLive, type ServerRoom } from "./lib/rooms";
import { hostRef, readHost, touchHostTx } from "./lib/hosts";
import { DATABASE_REGION } from "./config";

/**
 * Mirrors Realtime Database presence (/presence/{roomId}/{uid}) into Firestore,
 * then recomputes the room's connection counts and expiry.
 * The role is derived from Firestore — never trusted from the client.
 */
export const onPresenceWritten = onValueWritten({ ref: "/presence/{roomId}/{uid}", region: DATABASE_REGION }, async (event) => {
  const { roomId, uid } = event.params;
  // Re-read the latest value so out-of-order deliveries settle on the current state.
  // event.data.after.ref is bound to the database instance that fired the event.
  const latest = (await event.data.after.ref.get()).val() as { state?: string } | null;
  const online = latest?.state === "online";

  await db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(roomRef(roomId));
    if (!roomSnap.exists) return;
    const room = roomSnap.data() as ServerRoom;
    if (!isRoomLive(room)) return;

    const playerRef = roomRef(roomId).collection("players").doc(uid);
    const displayRef = roomRef(roomId).collection("displaySessions").doc(uid);
    const [playerSnap, displaySnap, onlinePlayers, connectedDisplays, hostSnap] = await Promise.all([
      tx.get(playerRef),
      tx.get(displayRef),
      tx.get(roomRef(roomId).collection("players").where("status", "==", "online")),
      tx.get(roomRef(roomId).collection("displaySessions").where("connected", "==", true)),
      room.hostId === uid ? tx.get(hostRef(uid)) : Promise.resolve(null),
    ]);
    const now = Timestamp.now();
    const patch: Partial<ServerRoom> = {};

    const onlineIds = new Set(onlinePlayers.docs.map((d) => d.id));
    const displayIds = new Set(connectedDisplays.docs.filter((d) => d.get("revoked") !== true).map((d) => d.id));

    if (room.hostId === uid) {
      // The host coming back is host activity: keep their slot alive.
      if (online && hostSnap) touchHostTx(tx, uid, readHost(hostSnap), now.toMillis());
      if (room.hostConnected !== online) {
        patch.hostConnected = online;
        patch.hostDisconnectedAt = online ? null : now;
      }
    } else if (playerSnap.exists) {
      const status = playerSnap.get("status");
      if (status === "online" || status === "offline") {
        const next = online ? "online" : "offline";
        if (status !== next) {
          tx.update(playerRef, { status: next, lastSeenAt: now, disconnectedAt: online ? null : now });
        }
        if (online) onlineIds.add(uid);
        else onlineIds.delete(uid);
      }
    } else if (displaySnap.exists && displaySnap.get("revoked") !== true) {
      if (displaySnap.get("connected") !== online) tx.update(displayRef, { connected: online, lastSeenAt: now });
      if (online) displayIds.add(uid);
      else displayIds.delete(uid);
    } else {
      logger.debug("Presence from non-member ignored", { roomId, uid });
      return;
    }

    patch.connectedPlayerCount = onlineIds.size;
    patch.connectedDisplayCount = displayIds.size;
    const hostConnected = patch.hostConnected ?? room.hostConnected;
    const anyone = hostConnected || onlineIds.size > 0 || displayIds.size > 0;
    patch.allDisconnectedAt = anyone ? null : room.allDisconnectedAt ?? now;
    // Reconnects count as activity and reset the applicable timers.
    patch.lastActivityAt = now;
    tx.update(roomRef(roomId), { ...patch, ...expiryFields(room, patch, now.toMillis()) });
  });
});
