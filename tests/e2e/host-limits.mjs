/**
 * Free-tier limits + activity E2E (emulators + vite running, functions/.env defaults:
 * MAX_ACTIVE_HOSTS=30, MAX_ROOMS_PER_HOST=3, ROOM_INACTIVITY_MINUTES=60):
 *   rooms per host · keepAlive extends an active lobby · the host limit (+ popup with a new-tab link)
 *   · paid hosts skip both · a room ending sends players to the code screen and the TV to pairing.
 * Clears hosts/* before and after, so other suites aren't held up by the hosts it creates.
 *   node tests/e2e/host-limits.mjs [baseUrl] [screenshotDir]
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.argv[2] ?? "http://127.0.0.1:5173";
const OUT = process.argv[3] ?? "screenshots/host-limits";
fs.mkdirSync(OUT, { recursive: true });
const AUTH = "http://127.0.0.1:9099";
const FN = "http://127.0.0.1:5001/demo-partey/asia-southeast1";
const FS = "http://127.0.0.1:8080/v1/projects/demo-partey/databases/(default)/documents";
const MAX_HOSTS = 30, MAX_ROOMS = 3;
const log = (...a) => console.log("•", ...a);
const expect = (c, m) => { if (!c) throw new Error("FAILED: " + m); log("ok:", m); };

async function req(url, init) {
  const res = await fetch(url, init);
  return { ok: res.ok, body: await res.json().catch(() => ({})) };
}
const owner = { authorization: "Bearer owner", "content-type": "application/json" };
const signUp = async () => {
  const { body } = await req(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, { method: "POST", headers: { "content-type": "application/json" }, body: '{"returnSecureToken":true}' });
  return { token: body.idToken, uid: body.localId };
};
/** Callable over HTTP: { ok, result } or { ok: false, error: { message, status, details } }. */
const callable = async (name, user, data) => {
  const { ok, body } = await req(`${FN}/${name}`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${user.token}` }, body: JSON.stringify({ data }) });
  return ok ? { ok, result: body.result } : { ok, error: body.error };
};
const ts = (ms) => ({ timestampValue: new Date(ms).toISOString() });
const getDoc = (path) => req(`${FS}/${path}`, { headers: owner }).then((r) => r.body);
const patchDoc = (path, fields) => req(`${FS}/${path}?${Object.keys(fields).map((f) => `updateMask.fieldPaths=${f}`).join("&")}`, { method: "PATCH", headers: owner, body: JSON.stringify({ fields }) });
const msOf = (field) => Date.parse(field.timestampValue);
async function clearHosts() {
  const { body } = await req(`${FS}/hosts?pageSize=300`, { headers: owner });
  for (const d of body.documents ?? []) await req(`http://127.0.0.1:8080/v1/${d.name}`, { method: "DELETE", headers: owner });
}
let n = 0;
const createRoom = (user) => callable("createRoom", user, { roomName: `Limit test ${++n}` });

// Hosts from earlier test files can still be touched by their last presence updates for a moment
// (presence → host activity), so clear, let those settle, and clear again.
await clearHosts();
await new Promise((r) => setTimeout(r, 3000));
await clearHosts();

// ── Rooms per host ──────────────────────────────────────────────────────
const alice = await signUp();
const aliceRooms = [];
for (let i = 0; i < MAX_ROOMS; i++) {
  const r = await createRoom(alice);
  expect(r.ok, `host opens room ${i + 1} of ${MAX_ROOMS}`);
  aliceRooms.push(r.result);
}
const fourth = await createRoom(alice);
expect(!fourth.ok && fourth.error.status === "RESOURCE_EXHAUSTED" && fourth.error.details?.reason === "room-limit" && fourth.error.details.max === MAX_ROOMS, `room ${MAX_ROOMS + 1} is refused (room-limit): "${fourth.error?.message}"`);

// ── Activity keeps a lobby alive ────────────────────────────────────────
const lobby = aliceRooms[0];
const almostIdle = Date.now() - 50 * 60_000;
await patchDoc(`rooms/${lobby.roomId}`, { lastActivityAt: ts(almostIdle), expiresAt: ts(almostIdle + 60 * 60_000) });
const before = msOf((await getDoc(`rooms/${lobby.roomId}`)).fields.expiresAt);
expect(before - Date.now() < 11 * 60_000, `an idle lobby is ~10 min from expiring`);
expect((await callable("keepAlive", alice, { roomId: lobby.roomId })).ok, "host's keepAlive accepted");
const after = msOf((await getDoc(`rooms/${lobby.roomId}`)).fields.expiresAt);
expect(after - Date.now() > 59 * 60_000, `activity pushes expiry a full hour out (${Math.round((after - Date.now()) / 60_000)} min)`);
const stranger = await signUp();
const denied = await callable("keepAlive", stranger, { roomId: lobby.roomId });
expect(!denied.ok && denied.error.status === "PERMISSION_DENIED", "a non-member's keepAlive is refused");
const aliceHost = (await getDoc(`hosts/${alice.uid}`)).fields;
expect(aliceHost.tier.stringValue === "free" && aliceHost.status.stringValue === "active", "the host has an active free slot");
expect(msOf(aliceHost.expiresAt) - Date.now() > 179 * 60_000, "a host slot lasts 3 hours from the last activity");

// ── Host limit ──────────────────────────────────────────────────────────
for (let i = 1; i < MAX_HOSTS; i++) {
  const r = await createRoom(await signUp());
  if (!r.ok) throw new Error(`host ${i + 1} refused early: ${r.error.message}`);
}
expect(true, `${MAX_HOSTS} hosts active`);
const extra = await createRoom(await signUp());
expect(!extra.ok && extra.error.details?.reason === "host-limit", `host ${MAX_HOSTS + 1} is refused (host-limit)`);
expect(/limiting the number of hosts for free tiers/.test(extra.error.message), `message: "${extra.error.message}"`);
const contactUrl = extra.error.details.contactUrl;
expect(typeof contactUrl === "string" && contactUrl.startsWith("http"), `contact link from HOST_LIMIT_CONTACT_URL (${contactUrl})`);
expect((await createRoom(alice)).error?.details?.reason === "room-limit", "an existing host isn't blocked by the host limit (only by their room limit)");

// ── Paid hosts skip both limits ─────────────────────────────────────────
const paid = await signUp();
await patchDoc(`hosts/${paid.uid}`, { tier: { stringValue: "paid" }, status: { stringValue: "active" }, expiresAt: { nullValue: null }, note: { stringValue: "e2e" } });
for (let i = 0; i < MAX_ROOMS + 1; i++) {
  const r = await createRoom(paid);
  expect(r.ok, `paid host, over both limits: room ${i + 1} created`);
}
expect((await getDoc(`hosts/${paid.uid}`)).fields.expiresAt.nullValue === null, "a paid host never expires");

// ── Browser: the host-limit popup ───────────────────────────────────────
const b = await chromium.launch();
const ctx = (opts) => b.newContext(opts).then((c) => c.newPage());
const host = await ctx({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await host.goto(`${BASE}/host`);
await host.getByLabel("Room name").fill("One too many");
await host.getByRole("button", { name: "Continue" }).click();
const dlg = host.getByRole("dialog");
await dlg.getByText("Host limit reached").waitFor({ timeout: 20000 });
expect(await dlg.getByText(/limiting the number of hosts for free tiers/).isVisible(), "popup explains the free-tier host limit");
const link = dlg.getByRole("link", { name: /Contact us/ });
expect((await link.getAttribute("href")) === contactUrl && (await link.getAttribute("target")) === "_blank" && /noopener/.test(await link.getAttribute("rel")), "popup links to the contact page in a new tab");
await host.screenshot({ path: `${OUT}/1-host-limit-popup.png` });
expect(/\/host$/.test(host.url()), "the host stays on the create screen");

// ── A room ending sends players to the code screen and the TV to pairing ─
const tv = await ctx({ viewport: { width: 1280, height: 720 } });
await tv.goto(`${BASE}/display`);
await tv.getByLabel(/^Pairing code /).waitFor({ timeout: 30000 });
const pair = (await tv.getByLabel(/^Pairing code /).getAttribute("aria-label")).replace("Pairing code ", "").replace(/ /g, "");
expect((await callable("claimDisplayPairing", alice, { roomId: lobby.roomId, code: pair })).ok, "TV paired to the lobby");
await tv.waitForURL(new RegExp(`/display/${lobby.roomId}$`), { timeout: 20000 });
const phone = await ctx({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await phone.goto(`${BASE}/play/${lobby.roomCode}`);
await phone.getByLabel("Nickname").fill("Olym");
await phone.getByRole("button", { name: "Join the party" }).click();
await phone.getByText("Hi, Olym!").waitFor({ timeout: 20000 });
expect((await callable("closeRoom", alice, { roomId: lobby.roomId })).ok, "the room ends");
await phone.waitForURL(/\/play$/, { timeout: 20000 });
expect(true, "the player is sent back to the code screen");
await phone.getByText("This room has ended").first().waitFor({ timeout: 5000 });
await phone.screenshot({ path: `${OUT}/2-player-back-to-code.png` });
await tv.waitForURL(/\/display$/, { timeout: 20000 });
await tv.getByLabel(/^Pairing code /).waitFor({ timeout: 30000 });
expect(true, "the TV is sent back to pairing, with a fresh code");
await tv.screenshot({ path: `${OUT}/3-tv-back-to-pairing.png` });

await b.close();
await clearHosts();
log("Host limits E2E passed");
