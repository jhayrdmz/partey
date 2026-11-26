/**
 * Integration test for the expiry sweep. Requires the Firestore + RTDB emulators:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000 npm test
 * Skipped automatically when the emulators aren't configured.
 */
import { beforeAll, describe, expect, it } from "vitest";

const hasEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_DATABASE_EMULATOR_HOST);
process.env.GCLOUD_PROJECT ??= "demo-partey";
process.env.FIREBASE_CONFIG ??= JSON.stringify({ projectId: "demo-partey", databaseURL: "http://127.0.0.1:9000?ns=demo-partey-default-rtdb" });

describe.skipIf(!hasEmulators)("runExpirySweep", () => {
  let mod: typeof import("./maintenance");
  let admin: typeof import("./lib/admin");

  beforeAll(async () => {
    admin = await import("./lib/admin");
    mod = await import("./maintenance");
  });

  it("expires overdue rooms, deletes subcollections and frees the room code", async () => {
    const { db, Timestamp } = admin;
    const ref = db.collection("rooms").doc();
    const code = `T${Math.floor(Math.random() * 1e6)}`;
    await ref.set({ roomCode: code, status: "waiting", expiresAt: Timestamp.fromMillis(Date.now() - 1000), playerCount: 1 });
    await ref.collection("players").doc("p1").set({ nickname: "A", status: "online" });
    await ref.collection("displayState").doc("current").set({ currentScreen: "lobby" });
    await ref.collection("history").doc("h1").set({ standings: [] });
    await db.collection("roomCodes").doc(code).set({ roomId: ref.id });

    const live = db.collection("rooms").doc();
    await live.set({ roomCode: "LIVE", status: "playing", expiresAt: null });

    const result = await mod.runExpirySweep();
    expect(result.rooms).toBeGreaterThanOrEqual(1);

    const room = await ref.get();
    expect(room.get("status")).toBe("expired");
    expect(room.get("ttlAt")).toBeTruthy(); // Firestore TTL removes the tombstone later
    expect((await ref.collection("players").get()).empty).toBe(true);
    expect((await ref.collection("displayState").get()).empty).toBe(true);
    expect((await ref.collection("history").get()).empty).toBe(true);
    expect((await db.collection("roomCodes").doc(code).get()).exists).toBe(false);
    expect((await live.get()).get("status")).toBe("playing");
  });

  it("moves players past their 8h reconnection grace to 'left' without touching others", async () => {
    const { db, Timestamp } = admin;
    const ref = db.collection("rooms").doc();
    await ref.set({ roomCode: "GRACE", status: "playing", expiresAt: null, playerCount: 2 });
    await ref.collection("players").doc("stale").set({ status: "offline", disconnectedAt: Timestamp.fromMillis(Date.now() - 9 * 3600_000), score: 120 });
    await ref.collection("players").doc("recent").set({ status: "offline", disconnectedAt: Timestamp.fromMillis(Date.now() - 3600_000), score: 80 });

    await mod.runExpirySweep();

    const stale = await ref.collection("players").doc("stale").get();
    expect(stale.get("status")).toBe("left");
    expect(stale.get("score")).toBe(120); // scores preserved
    expect((await ref.collection("players").doc("recent").get()).get("status")).toBe("offline");
    expect((await ref.get()).get("playerCount")).toBe(1);
    expect((await ref.get()).get("status")).toBe("playing"); // one player leaving never expires the room
  });

  it("expires idle free hosts with all their rooms; paid and active hosts are untouched", async () => {
    const { db, Timestamp } = admin;
    const past = Timestamp.fromMillis(Date.now() - 1000);
    const future = Timestamp.fromMillis(Date.now() + 3600_000);
    const id = () => `h${Math.floor(Math.random() * 1e9)}`;
    const idle = id(), paid = id(), busy = id();
    await db.collection("hosts").doc(idle).set({ tier: "free", status: "active", expiresAt: past, lastActiveAt: past });
    await db.collection("hosts").doc(paid).set({ tier: "paid", status: "active", expiresAt: null, lastActiveAt: past });
    await db.collection("hosts").doc(busy).set({ tier: "free", status: "active", expiresAt: future, lastActiveAt: past });
    const room = async (hostId: string, status = "waiting") => {
      const ref = db.collection("rooms").doc();
      await ref.set({ roomCode: `R${Math.floor(Math.random() * 1e6)}`, hostId, status, expiresAt: status === "waiting" ? future : null });
      await ref.collection("players").doc("p1").set({ nickname: "A", status: "online" });
      return ref;
    };
    const idleLobby = await room(idle);
    const idleGame = await room(idle, "playing");
    const paidLobby = await room(paid);
    const busyLobby = await room(busy);

    const result = await mod.runExpirySweep();
    expect(result.hosts).toBeGreaterThanOrEqual(1);

    expect((await db.collection("hosts").doc(idle).get()).get("status")).toBe("expired");
    for (const r of [idleLobby, idleGame]) {
      expect((await r.get()).get("status")).toBe("expired"); // even a game in progress ends
      expect((await r.collection("players").get()).empty).toBe(true); // players are disconnected
    }
    expect((await db.collection("hosts").doc(paid).get()).get("status")).toBe("active");
    expect((await paidLobby.get()).get("status")).toBe("waiting");
    expect((await db.collection("hosts").doc(busy).get()).get("status")).toBe("active");
    expect((await busyLobby.get()).get("status")).toBe("waiting");
  });
});
