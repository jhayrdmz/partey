/**
 * Firestore security rules tests (runs against the Firestore + Auth emulators).
 *   npm run test:rules   (emulators must be running)
 *
 * Seeds data with the Admin SDK (bypasses rules), then reads as real
 * anonymous client users through the v13 web SDK so the deployed rules apply.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { initializeApp as initClient, deleteApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getDocs, collection, getFirestore, setDoc, query, where } from "firebase/firestore";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
const PROJECT = "demo-partey";
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp: initAdmin } = require("firebase-admin/app");
const { getFirestore: getAdminDb, Timestamp } = require("firebase-admin/firestore");

const admin = getAdminDb(initAdmin({ projectId: PROJECT }, "rules-test-admin"));
const clients = [];

async function user(name) {
  const app = initClient({ apiKey: "demo-key", projectId: PROJECT }, `${name}-${Math.random()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const cred = await signInAnonymously(auth);
  clients.push(app);
  return { uid: cred.user.uid, db };
}

const allowed = (p) => p.then(() => true, (e) => (e.code === "permission-denied" ? false : Promise.reject(e)));

let host, player, kicked, display, revokedDisplay, stranger, roomId, expiredRoomId;

before(async () => {
  [host, player, kicked, display, revokedDisplay, stranger] = await Promise.all(
    ["host", "player", "kicked", "display", "revoked", "stranger"].map(user),
  );
  const now = Timestamp.now();
  const future = Timestamp.fromMillis(Date.now() + 3600_000);
  const room = { roomCode: "TEST", hostId: host.uid, roomName: "Rules", status: "waiting", expiresAt: future, gameMode: "tournament", lineup: [] };
  const ref = admin.collection("rooms").doc();
  roomId = ref.id;
  await ref.set(room);
  await ref.collection("players").doc(player.uid).set({ nickname: "P", status: "online", score: 0, joinedAt: now });
  await ref.collection("players").doc(kicked.uid).set({ nickname: "K", status: "kicked", score: 0, joinedAt: now });
  await ref.collection("displaySessions").doc(display.uid).set({ label: "TV", revoked: false, connected: true });
  await ref.collection("displaySessions").doc(revokedDisplay.uid).set({ label: "Old TV", revoked: true, connected: false });
  await ref.collection("displayState").doc("current").set({ currentScreen: "lobby" });
  await ref.collection("gameState").doc("current").set({ phase: "intro", gameData: { answer: "secret" } });
  await ref.collection("private").doc(player.uid).set({ secretWord: "mango" });
  await ref.collection("submissions").doc("s1").set({ playerId: player.uid, answer: "x" });
  await admin.collection("roomCodes").doc("TEST").set({ roomId });
  await admin.collection("displayPairings").doc("p1").set({ roomId, hostId: host.uid, requesterUid: display.uid, status: "approved", expiresAt: future });
  // A code still showing on a display: no room or host yet.
  await admin.collection("displayPairings").doc("p-open").set({ code: "482913", roomId: null, hostId: null, requesterUid: display.uid, status: "open", expiresAt: future });

  const expired = admin.collection("rooms").doc();
  expiredRoomId = expired.id;
  await expired.set({ ...room, expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
  await expired.collection("players").doc(player.uid).set({ nickname: "P", status: "online" });
  await expired.collection("displayState").doc("current").set({ currentScreen: "lobby" });
});

after(async () => {
  await Promise.all(clients.map((a) => deleteApp(a)));
});

const roomDoc = (u, id = roomId) => getDoc(doc(u.db, "rooms", id));
const sub = (u, name, id, rid = roomId) => getDoc(doc(u.db, "rooms", rid, name, id));

describe("rooms", () => {
  test("host, player and paired display can read the room", async () => {
    assert.equal(await allowed(roomDoc(host)), true);
    assert.equal(await allowed(roomDoc(player)), true);
    assert.equal(await allowed(roomDoc(display)), true);
  });
  test("strangers, kicked players and revoked displays cannot", async () => {
    assert.equal(await allowed(roomDoc(stranger)), false);
    assert.equal(await allowed(roomDoc(kicked)), false);
    assert.equal(await allowed(roomDoc(revokedDisplay)), false);
  });
  test("rooms cannot be listed or written by clients", async () => {
    assert.equal(await allowed(getDocs(collection(host.db, "rooms"))), false);
    assert.equal(await allowed(setDoc(doc(host.db, "rooms", roomId), { status: "playing" }, { merge: true })), false);
  });
  test("an expired room is inaccessible immediately, even to its host", async () => {
    assert.equal(await allowed(roomDoc(host, expiredRoomId)), false);
    assert.equal(await allowed(sub(player, "displayState", "current", expiredRoomId)), false);
  });
});

describe("players", () => {
  test("members can list player profiles; strangers cannot", async () => {
    assert.equal(await allowed(getDocs(collection(display.db, "rooms", roomId, "players"))), true);
    assert.equal(await allowed(getDocs(collection(stranger.db, "rooms", roomId, "players"))), false);
  });
  test("a kicked player can still read their own record (to learn they were removed)", async () => {
    assert.equal(await allowed(sub(kicked, "players", kicked.uid)), true);
    assert.equal(await allowed(sub(kicked, "players", player.uid)), false);
  });
  test("players cannot change their own score", async () => {
    assert.equal(await allowed(setDoc(doc(player.db, "rooms", roomId, "players", player.uid), { score: 9999 }, { merge: true })), false);
  });
});

describe("separation of public, private and authoritative data", () => {
  test("display state is readable by members only", async () => {
    assert.equal(await allowed(sub(display, "displayState", "current")), true);
    assert.equal(await allowed(sub(stranger, "displayState", "current")), false);
    assert.equal(await allowed(setDoc(doc(host.db, "rooms", roomId, "displayState", "current"), { currentScreen: "champion" })), false);
  });
  test("authoritative game state (answers) is server-only", async () => {
    assert.equal(await allowed(sub(host, "gameState", "current")), false);
    assert.equal(await allowed(sub(player, "gameState", "current")), false);
    assert.equal(await allowed(sub(display, "gameState", "current")), false);
  });
  test("private player data is readable only by that player", async () => {
    assert.equal(await allowed(sub(player, "private", player.uid)), true);
    assert.equal(await allowed(sub(display, "private", player.uid)), false);
    assert.equal(await allowed(sub(host, "private", player.uid)), false);
  });
  test("raw submissions are server-only", async () => {
    assert.equal(await allowed(sub(host, "submissions", "s1")), false);
    assert.equal(await allowed(sub(player, "submissions", "s1")), false);
  });
  test("display sessions: host sees all, a display sees only itself", async () => {
    assert.equal(await allowed(getDocs(collection(host.db, "rooms", roomId, "displaySessions"))), true);
    assert.equal(await allowed(sub(display, "displaySessions", display.uid)), true);
    assert.equal(await allowed(sub(display, "displaySessions", revokedDisplay.uid)), false);
    assert.equal(await allowed(sub(revokedDisplay, "displaySessions", revokedDisplay.uid)), true);
  });
});

describe("lookup tables and pairing", () => {
  test("room codes and pairing codes cannot be enumerated", async () => {
    assert.equal(await allowed(getDoc(doc(stranger.db, "roomCodes", "TEST"))), false);
    assert.equal(await allowed(getDocs(collection(stranger.db, "pairingCodes"))), false);
  });
  test("pairing records are visible to the host and the requesting display only", async () => {
    assert.equal(await allowed(getDoc(doc(host.db, "displayPairings", "p1"))), true);
    assert.equal(await allowed(getDoc(doc(display.db, "displayPairings", "p1"))), true);
    assert.equal(await allowed(getDoc(doc(stranger.db, "displayPairings", "p1"))), false);
    assert.equal(
      await allowed(getDocs(query(collection(host.db, "displayPairings"), where("roomId", "==", roomId), where("hostId", "==", host.uid)))),
      true,
    );
    assert.equal(await allowed(getDocs(collection(stranger.db, "displayPairings"))), false);
  });
  test("an unclaimed display code is visible only to the display showing it", async () => {
    assert.equal(await allowed(getDoc(doc(display.db, "displayPairings", "p-open"))), true);
    assert.equal(await allowed(getDoc(doc(host.db, "displayPairings", "p-open"))), false);
    assert.equal(await allowed(getDoc(doc(stranger.db, "displayPairings", "p-open"))), false);
  });
});
