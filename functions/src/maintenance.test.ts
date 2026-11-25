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
});
