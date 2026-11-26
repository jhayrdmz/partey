/**
 * Regenerates the README screenshots in docs/screenshots/ against the local emulators + dev server.
 *   node scripts/screenshots.mjs [baseUrl] [outDir]
 *
 *   landing.png             landing page, desktop 1440×900
 *   display-pairing.png     TV waiting to be paired (code + QR), 1920×1080
 *   host-lobby.png          host lobby with 10 players, landscape tablet 1180×820 @2x (visible area)
 *   player-speed-quiz.png   a player answering Speed Quiz, phone 390×844 @2x
 *
 * Nine players join straight through the Auth + Functions emulators (fast); the tenth is a
 * real phone browser, used for the Speed Quiz shot. The local emulators never fire the RTDB
 * presence trigger (its region differs from the emulated database's), so for the lobby shot the
 * seeded players are marked online directly in the Firestore emulator. Local emulators only.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.argv[2] ?? "http://127.0.0.1:5173";
const OUT = process.argv[3] ?? "docs/screenshots";
const PROJECT = "demo-partey";
const REGION = "asia-southeast1";
const AUTH = "http://127.0.0.1:9099";
const FUNCTIONS = `http://127.0.0.1:5001/${PROJECT}/${REGION}`;
const FIRESTORE = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log("•", ...a);

const ROOM_NAME = "StealthDev Year-end Party";
const PLAYERS = [
  ["Mac", "mango"], ["Jolo", "carabao"], ["Penpen", "jeep"], ["Mayk", "eagle"], ["Benj", "turtle"],
  ["Ralph", "fish"], ["Aeizen", "rooster"], ["Albert", "cat"], ["Norman", "octopus"],
];
const PHONE_PLAYER = ["Olym", "rocket"];

async function json(url, init) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${url} → ${res.status} ${JSON.stringify(body)}`);
  return body;
}
/** A new anonymous user (Auth emulator) → ID token. */
const signUp = () => json(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }),
}).then((r) => r.idToken);
const callable = (name, token, data) => json(`${FUNCTIONS}/${name}`, {
  method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ data }),
});
/** Admin write in the Firestore emulator ("owner" bypasses the security rules). */
const patchDoc = (path, fields) => {
  const mask = Object.keys(fields).map((f) => `updateMask.fieldPaths=${f}`).join("&");
  return json(`${FIRESTORE}/${path}?${mask}`, {
    method: "PATCH", headers: { "content-type": "application/json", authorization: "Bearer owner" }, body: JSON.stringify({ fields }),
  });
};

const b = await chromium.launch();
const page = (opts) => b.newContext({ deviceScaleFactor: 1, ...opts }).then((c) => c.newPage());

// ── 1. Landing ──────────────────────────────────────────────────────────
const landing = await page({ viewport: { width: 1440, height: 900 } });
await landing.goto(BASE);
await landing.getByText("Host a Game").waitFor();
await landing.waitForTimeout(1500); // entrance animations
await landing.screenshot({ path: `${OUT}/landing.png` });
log("landing.png");

// ── 2. Display waiting to pair ──────────────────────────────────────────
const tv = await page({ viewport: { width: 1920, height: 1080 } });
await tv.goto(`${BASE}/display`);
await tv.getByLabel(/^Pairing code /).waitFor({ timeout: 30000 });
await tv.waitForTimeout(1500);
await tv.screenshot({ path: `${OUT}/display-pairing.png` });
log("display-pairing.png");
const pairCode = (await tv.getByLabel(/^Pairing code /).getAttribute("aria-label")).replace("Pairing code ", "").replace(/ /g, "");

// ── 3. Host lobby, 10 players, tablet ───────────────────────────────────
const host = await page({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true });
await host.goto(`${BASE}/host`);
await host.getByLabel("Room name").fill(ROOM_NAME);
await host.getByRole("button", { name: "Continue" }).click();
await host.waitForURL(/\/mode$/, { timeout: 30000 });
const roomId = host.url().split("/host/")[1].split("/")[0];
await host.getByRole("button", { name: /Tournament Mode/ }).click();
await host.waitForURL(/games$/);
for (const g of ["Speed Quiz", "Draw & Guess", "The Impostor", "Reflex Battle"]) await host.getByRole("button", { name: `Add ${g} to lineup` }).click();
await host.getByRole("button", { name: /Continue with 4 games/ }).first().click();
await host.getByText("Tournament lineup").waitFor();
await host.getByRole("button", { name: "Show room code" }).click();
const roomCode = (await host.getByRole("dialog").getByLabel(/^Room code /).first().getAttribute("aria-label")).replace("Room code ", "").replace(/ /g, "");
await host.keyboard.press("Escape");
await host.getByRole("button", { name: "Connect a display" }).click();
await host.getByLabel("Code shown on the display").fill(pairCode);
await tv.waitForURL(new RegExp(`/display/${roomId}$`), { timeout: 30000 });
await host.keyboard.press("Escape");
log("room", roomCode, "with the TV paired");

for (const [nickname, avatar] of PLAYERS) await callable("joinRoom", await signUp(), { roomCode, nickname, avatar });
const phone = await page({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await phone.goto(`${BASE}/play/${roomCode}`);
await phone.getByLabel("Nickname").fill(PHONE_PLAYER[0]);
await phone.getByRole("radio", { name: /Rocket/ }).click();
await phone.getByRole("button", { name: "Join the party" }).click();
await phone.getByText(`Hi, ${PHONE_PLAYER[0]}!`).waitFor();
log(`${PLAYERS.length + 1} players joined`);

// Mark everyone online (see the note at the top) so the lobby shows them connected.
const players = await json(`${FIRESTORE}/rooms/${roomId}/players?pageSize=50`, { headers: { authorization: "Bearer owner" } });
for (const d of players.documents ?? []) await patchDoc(d.name.split("/documents/")[1], { status: { stringValue: "online" } });
await patchDoc(`rooms/${roomId}`, { connectedPlayerCount: { integerValue: String(players.documents.length) }, connectedDisplayCount: { integerValue: "1" } });
const sessions = await json(`${FIRESTORE}/rooms/${roomId}/displaySessions`, { headers: { authorization: "Bearer owner" } });
for (const d of sessions.documents ?? []) await patchDoc(d.name.split("/documents/")[1], { connected: { booleanValue: true } });

await host.getByText(`${PLAYERS.length + 1} online`).waitFor({ timeout: 15000 });
await host.waitForTimeout(1200);
// What a landscape tablet shows without scrolling. Hide leftover toasts (e.g. "display connected").
await host.addStyleTag({ content: "[data-sonner-toaster]{display:none!important}" });
await host.waitForTimeout(300);
await host.screenshot({ path: `${OUT}/host-lobby.png` });
log("host-lobby.png");

// ── 4. A player answering Speed Quiz, phone ─────────────────────────────
await host.getByRole("button", { name: "Start tournament" }).first().click();
await phone.getByText(/Starting in/).waitFor({ timeout: 20000 });
await host.getByRole("button", { name: "Start round 1" }).first().click();
await phone.getByRole("group", { name: "Answers" }).waitFor({ timeout: 20000 });
await phone.waitForTimeout(1500);
await phone.screenshot({ path: `${OUT}/player-speed-quiz.png` });
log("player-speed-quiz.png");

await host.getByRole("button", { name: "End", exact: true }).click();
await host.getByRole("dialog").getByRole("button", { name: "End game" }).click();
await b.close();
log("done →", OUT);
