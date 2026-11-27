/**
 * Perfectly Hold E2E (emulators + vite running): options, the target on the TV only, HOLD locked until
 * GO, a real press-and-hold on a phone timed on the device (a centred button, no rings or clock), Waiting /
 * Locked in on the * TV, taps and interrupted holds, server checks (holds before GO, too long, duplicates), ranking and
 * points, the phone's result, and final results with each player's best.
 * Host + TV + 2 phone browsers + 2 API players.
 *   node tests/e2e/perfectly-hold.mjs [baseUrl] [screenshotDir]
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.argv[2] ?? "http://127.0.0.1:5173";
const OUT = process.argv[3] ?? "screenshots/perfectly-hold";
fs.mkdirSync(OUT, { recursive: true });
const AUTH = "http://127.0.0.1:9099";
const FN = "http://127.0.0.1:5001/demo-partey/asia-southeast1";
const FS = "http://127.0.0.1:8080/v1/projects/demo-partey/databases/(default)/documents";
const owner = { authorization: "Bearer owner", "content-type": "application/json" };
const log = (...a) => console.log("•", ...a);
const expect = (c, m) => { if (!c) throw new Error("FAILED: " + m); log("ok:", m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function req(url, init) { const res = await fetch(url, init); return { ok: res.ok, body: await res.json().catch(() => ({})) }; }
const signUp = async () => (await req(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, { method: "POST", headers: { "content-type": "application/json" }, body: '{"returnSecureToken":true}' })).body;
const callable = async (name, user, data) => {
  const { ok, body } = await req(`${FN}/${name}`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${user.idToken}` }, body: JSON.stringify({ data }) });
  return ok ? { ok, result: body.result } : { ok, error: body.error };
};
const num = (v) => Number(v?.integerValue ?? v?.doubleValue);
/** The authoritative game state (server-only; read here with emulator admin access). */
const gameState = async (roomId) => {
  const f = (await req(`${FS}/rooms/${roomId}/gameState/current`, { headers: owner })).body.fields;
  const scores = Object.fromEntries(Object.entries(f.scores.mapValue.fields ?? {}).map(([k, v]) => [k, num(v)]));
  const pub = f.roundPublic?.mapValue?.fields;
  return { round: num(f.round), phase: f.phase.stringValue, targetMs: num(pub?.targetMs), goAtMs: num(pub?.goAtMs), maxHoldMs: num(pub?.maxHoldMs), scores };
};
/** The public reveal on displayState: [{ playerId, holdMs, diffMs, rank, points }]. */
const reveal = async (roomId) => {
  const g = (await req(`${FS}/rooms/${roomId}/displayState/current`, { headers: owner })).body.fields.game.mapValue.fields;
  const results = g.reveal.mapValue.fields.results.arrayValue.values ?? [];
  return results.map((v) => {
    const r = v.mapValue.fields;
    return { playerId: r.playerId.stringValue, nickname: r.nickname.stringValue, holdMs: "nullValue" in r.holdMs ? null : num(r.holdMs), diffMs: "nullValue" in r.diffMs ? null : num(r.diffMs), rank: "nullValue" in r.rank ? null : num(r.rank), points: num(r.points) };
  });
};
const clearHosts = async () => {
  const { body } = await req(`${FS}/hosts?pageSize=300`, { headers: owner });
  for (const d of body.documents ?? []) await req(`http://127.0.0.1:8080/v1/${d.name}`, { method: "DELETE", headers: owner });
};
await clearHosts();

const b = await chromium.launch();
const phone = () => b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }).then((c) => c.newPage());
const tv = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const host = await phone();
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` });
process.on("unhandledRejection", async (e) => { console.error(e); await shot(tv, "fail-tv").catch(() => {}); process.exit(1); });

// ── Room, options, display ──────────────────────────────────────────────
await tv.goto(`${BASE}/display`); await tv.getByLabel(/^Pairing code /).waitFor({ timeout: 30000 });
const pair = (await tv.getByLabel(/^Pairing code /).getAttribute("aria-label")).replace("Pairing code ", "").replace(/ /g, "");
await host.goto(`${BASE}/host`); await host.getByLabel("Room name").fill("Hold night");
await host.getByRole("button", { name: "Continue" }).click(); await host.waitForURL(/\/mode$/, { timeout: 30000 });
const roomId = host.url().split("/host/")[1].split("/")[0];
await host.getByRole("button", { name: /Freestyle Mode/ }).click(); await host.waitForURL(/\/games$/);
await host.getByRole("button", { name: /Perfectly Hold/ }).first().click();
await host.getByRole("button", { name: /Play Perfectly Hold/ }).first().click();
await host.waitForURL(new RegExp(`/host/${roomId}$`));
await host.getByText("5 rounds · Mixed targets (5–15s) · max 24 players").waitFor({ timeout: 10000 });
expect(true, "default options: 5 rounds, Mixed 5–15s, 24 players");
await host.getByRole("button", { name: "Perfectly Hold options" }).click();
const dlg = host.getByRole("dialog");
await dlg.getByRole("radio", { name: "3" }).click();
await dlg.getByRole("radio", { name: /Short/ }).click();
await shot(host, "1-options");
await dlg.getByRole("button", { name: "Save options" }).click();
await host.getByText("3 rounds · Short targets (5–8s) · max 24 players").waitFor({ timeout: 10000 });
expect(true, "options saved: 3 rounds, Short targets");
await host.getByRole("button", { name: "Connect a display" }).click();
await host.getByLabel("Code shown on the display").fill(pair);
await tv.waitForURL(new RegExp(`/display/${roomId}$`), { timeout: 30000 }); await host.keyboard.press("Escape");
await host.getByRole("button", { name: "Show room code" }).click();
const code = (await host.getByRole("dialog").getByLabel(/^Room code /).first().getAttribute("aria-label")).replace("Room code ", "").replace(/ /g, "");
await host.keyboard.press("Escape");

// ── Players: 2 phones + 2 API clients ───────────────────────────────────
const [ana, ben] = [await phone(), await phone()];
for (const [p, n] of [[ana, "Ana"], [ben, "Ben"]]) {
  await p.goto(`${BASE}/play/${code}`); await p.getByLabel("Nickname").fill(n); await p.getByRole("button", { name: "Join the party" }).click();
  await p.getByText(`Hi, ${n}!`).waitFor({ timeout: 20000 });
}
const api = {};
for (const [n, avatar] of [["Cy", "jeep"], ["Dee", "fish"]]) {
  api[n] = await signUp();
  expect((await callable("joinRoom", api[n], { roomCode: code, nickname: n, avatar })).ok, `${n} joins (API)`);
}
const hold = (n, round, holdMs) => callable("submitAnswer", api[n], { roomId, round, answer: { holdMs } });
const holdBtn = (p) => p.getByRole("button", { name: /^Hold/ });
/** Press and hold the phone's HOLD button with a real pointer for `ms`, then let go. */
async function pressAndHold(p, ms, during) {
  const box = await holdBtn(p).boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await during?.();
  await p.waitForTimeout(ms);
  await p.mouse.up();
}
const tvStatus = (name) => tv.getByRole("list", { name: "Players" }).getByRole("listitem").filter({ hasText: name }).getAttribute("data-status");
/** An API player's hold, sent once that much time has really passed since GO (the server checks). */
const holdAfter = async (n, r, holdMs) => { const wait = r.goAtMs + holdMs + 200 - Date.now(); if (wait > 0) await sleep(wait); return hold(n, r.round, holdMs); };
const waitGo = async (r) => { const wait = r.goAtMs - Date.now() + 300; if (wait > 0) await sleep(wait); };

await host.getByRole("button", { name: /Start/ }).last().click();
await host.getByRole("button", { name: "Start round 1" }).waitFor({ timeout: 20000 });
// The rules screen: the game's name on one line, with the logo's dot.
for (const [p, name] of [[tv, "tv"], [ana, "phone"]]) {
  const h1 = p.getByRole("heading", { name: "Perfectly Hold." });
  await h1.waitFor({ timeout: 15000 });
  const lines = await h1.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight || "0") || 1));
  const fits = await h1.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= window.innerWidth);
  expect(fits && lines <= 1, `${name} rules screen: the title fits on one line, with the dot`);
  await shot(p, `0-${name}-rules`);
}
await host.getByRole("button", { name: "Start round 1" }).click();

// ── Round 1 ─────────────────────────────────────────────────────────────
await holdBtn(ana).waitFor({ timeout: 20000 });
const r1 = await gameState(roomId);
const t1 = r1.targetMs / 1000;
expect(r1.round === 1 && t1 >= 5 && t1 <= 8 && r1.targetMs % 1000 === 0, `round 1 target ${t1}s (Short: 5–8s, whole seconds)`);
await tv.getByLabel(`Target: ${t1} seconds`).waitFor({ timeout: 10000 });
expect(true, "the TV shows the target");
expect(await holdBtn(ana).isDisabled(), "HOLD is disabled before GO");
await ana.getByLabel(`Target: ${t1} seconds`).waitFor({ timeout: 5000 });
expect(true, "the phone shows the target time too");
const btnColor = (p) => holdBtn(p).evaluate((el) => ({ state: el.dataset.state, bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color, image: getComputedStyle(el).backgroundImage }));
const idle = await btnColor(ana);
expect(idle.state === "idle" && idle.bg === "rgb(239, 59, 79)" && idle.color === "rgb(0, 0, 0)", `HOLD is red with black text before it's pressed (${idle.bg}, ${idle.color})`);
await shot(tv, "2-tv-target");

// Server checks: a hold that must have started before GO, a tap, one over the limit.
const early = await hold("Cy", 1, 3000);
expect(!early.ok && early.error.status === "INVALID_ARGUMENT", "a hold sent before GO is rejected by the server");
await waitGo(r1);
await ana.waitForFunction(() => !document.querySelector('[aria-label="Hold"]')?.disabled, null, { timeout: 10000 });
expect(true, "HOLD is enabled on GO");
const tap = await hold("Cy", 1, 50);
expect(!tap.ok && /tap/i.test(tap.error.message), `a tap is rejected: "${tap.error?.message}"`);
const tooLong = await hold("Cy", 1, r1.maxHoldMs + 10);
expect(!tooLong.ok, "a hold over the limit is rejected");

// A quick tap on the phone doesn't count.
await holdBtn(ben).click();
await ben.getByText("That was a tap. Press and hold!").waitFor({ timeout: 5000 });
expect(true, "a tap on the phone: 'That was a tap. Press and hold!', nothing sent");

// Ana holds for the target time with a real pointer; the TV shows her locked in once she lets go.
await pressAndHold(ana, r1.targetMs - 400, async () => {
  await ana.getByText("Keep holding…").waitFor({ timeout: 3000 });
  const holdingText = await ana.locator("body").innerText();
  expect(!/\d+\.\d+s/.test(holdingText), "while holding the phone shows no running clock");
  const held = await btnColor(ana);
  expect(held.state === "holding" && held.bg === "rgb(22, 163, 74)" && held.color === "rgb(255, 255, 255)" && held.image === "none", `HOLD is solid green with white text while held, no gradient (${held.bg}, ${held.color})`);
  expect((await tvStatus("Ana")) === "waiting" && (await tvStatus("Ben")) === "waiting", "TV: no live 'holding' status (nothing is sent until release)");
  // The button is centred in the screen, and holding shows a swirl, not a pulsing ring.
  const btn = await holdBtn(ana).boundingBox();
  const vw = ana.viewportSize().width;
  expect(Math.abs(btn.x + btn.width / 2 - vw / 2) < 2, `the HOLD button is centred (${Math.round(btn.x + btn.width / 2)} of ${vw})`);
  expect(Math.abs(btn.width - btn.height) < 1, "the HOLD button is round");
  expect((await ana.locator(".animate-ping, .rounded-full.border-mango").count()) === 0, "no beating rings while holding");
  expect(!(await ana.locator("body").innerText()).includes("No clock here"), "no hint text under the button");
  await shot(ana, "3-phone-holding");
  await shot(tv, "4-tv-holding");
});
await ana.getByText("Time locked!").waitFor({ timeout: 10000 });
expect(true, "Ana let go: 'Time locked!'");
for (let i = 0; i < 30 && (await tvStatus("Ana")) !== "locked"; i++) await sleep(100);
expect((await tvStatus("Ana")) === "locked", "TV: Ana is Locked in");

// Ben holds 2 s short; Cy is 250 ms long; Dee sends twice at once (only one counts).
await pressAndHold(ben, r1.targetMs - 2000);
await ben.getByText("Time locked!").waitFor({ timeout: 10000 });
const cy = await hold("Cy", 1, r1.targetMs + 250);
expect(cy.ok && cy.result.accepted, "Cy's hold (API) is accepted");
const [d1, d2] = await Promise.all([hold("Dee", 1, r1.targetMs + 900), hold("Dee", 1, r1.targetMs + 900)]);
expect([d1, d2].filter((x) => x.ok && x.result.accepted).length === 1, "duplicate submissions: only one is stored");

// Everyone has held: the round ends by itself.
await tv.getByRole("list", { name: "Results" }).waitFor({ timeout: 15000 });
expect(true, "the round ends as soon as everyone has held");
const res1 = await reveal(roomId);
const byName = Object.fromEntries(res1.map((r) => [r.nickname, r]));
const sorted = [...res1].sort((a, b) => a.diffMs - b.diffMs);
expect(res1.every((r, i) => r.nickname === sorted[i].nickname), "results ranked by distance from the target");
expect(res1.every((r) => r.diffMs === Math.abs(r.holdMs - r1.targetMs)), "difference = |held − target|");
expect(byName.Cy.holdMs === r1.targetMs + 250 && byName.Dee.holdMs === r1.targetMs + 900, "API holds stored as sent");
expect(res1.every((r) => r.holdMs % 10 === 0), "holds are kept to the hundredth of a second (as shown)");
expect(Math.abs(byName.Ana.holdMs - (r1.targetMs - 400)) < 600, `Ana's phone measured ${byName.Ana.holdMs} ms for a ~${r1.targetMs - 400} ms hold`);
expect(JSON.stringify(res1.map((r) => r.points)) === "[100,75,50,25]", `points by rank: ${res1.map((r) => `${r.nickname} ${r.points}`).join(", ")}`);
// The reveal starts in round order, then re-arranges by result.
await tv.locator('[aria-label="Results"][data-sorted="true"]').waitFor({ timeout: 5000 });
await tv.waitForTimeout(1200);
const shown = await tv.getByRole("list", { name: "Results" }).getByRole("listitem").evaluateAll((lis) =>
  lis.map((li) => ({ text: li.innerText, top: li.getBoundingClientRect().top })).sort((a, b) => a.top - b.top).map((x) => x.text),
);
expect(res1.every((r, i) => shown[i].includes(r.nickname)), `TV re-arranges players by result: ${shown.map((t) => t.split("\n").find((l) => /[A-Za-z]/.test(l))).join(", ")}`);
expect(!/Almost there|Good try|Too early|Too late|Perfect!/.test(shown.join(" ")), "no verdict text under the players' names");
const tvReveal = await tv.locator("body").innerText();
expect(tvReveal.includes("wins!") && tvReveal.includes(`${t1}.00s`), "TV reveal: target and the round winner");
await shot(tv, "5-tv-reveal");
await ana.getByText("You held").waitFor({ timeout: 10000 });
const anaRes = await ana.locator("body").innerText();
expect(anaRes.includes(`${(byName.Ana.holdMs / 1000).toFixed(2)}s`) && anaRes.includes(`${t1}.00s`) && /off by/i.test(anaRes), "Ana's phone: her time, the target and the difference");
await shot(ana, "6-phone-result");

// ── Round 2: an interrupted hold, the host ends the round ───────────────
await host.getByRole("button", { name: "Next round" }).click();
await holdBtn(ben).waitFor({ timeout: 20000 });
const r2 = await gameState(roomId);
await waitGo(r2);
await ben.waitForFunction(() => !document.querySelector('[aria-label="Hold"]')?.disabled, null, { timeout: 10000 });
const box = await holdBtn(ben).boundingBox();
await ben.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await ben.mouse.down();
await ben.getByText("Keep holding…").waitFor();
// The app goes to the background mid-hold.
await ben.evaluate(() => {
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});
await ben.mouse.up();
await ben.getByText("Hold interrupted. Press and hold again.").waitFor({ timeout: 5000 });
expect(true, "an interrupted hold is cancelled, nothing sent");
expect((await tvStatus("Ben")) === "waiting", "TV: Ben is still Waiting");
expect((await holdAfter("Cy", r2, r2.targetMs + 30)).ok, "Cy holds round 2 (API)");
await host.getByRole("button", { name: "Reveal results" }).click();
await tv.getByRole("list", { name: "Results" }).waitFor({ timeout: 15000 });
const res2 = await reveal(roomId);
expect(res2[0].nickname === "Cy" && res2[0].points === 100 && res2.filter((r) => r.holdMs === null).every((r) => r.points === 0), "round 2: Cy wins, players without a hold score 0");
await ana.getByText("No hold this round").waitFor({ timeout: 10000 });
expect(true, "Ana's phone: 'No hold this round'");

// ── Round 3 → final results ─────────────────────────────────────────────
await host.getByRole("button", { name: "Next round" }).click();
await holdBtn(ana).waitFor({ timeout: 20000 });
const r3 = await gameState(roomId);
await waitGo(r3);
for (const n of ["Cy", "Dee"]) expect((await holdAfter(n, r3, r3.targetMs + 500)).ok, `${n} holds round 3`);
await host.getByRole("button", { name: "Reveal results" }).click();
for (let i = 0; i < 50 && (await gameState(roomId)).phase !== "reveal"; i++) await sleep(200);
const finalScores = (await gameState(roomId)).scores;
const cyBest = Math.min(250, 30, 500);
expect(finalScores[api.Cy.localId] === byName.Cy.points + 100 + 100, `Cy's total is right (${finalScores[api.Cy.localId]})`);
await host.getByRole("button", { name: "Show results" }).click();
await tv.getByText(/results/i).first().waitFor({ timeout: 20000 });
await tv.waitForTimeout(2500);
const finalText = await tv.locator("body").innerText();
expect(finalText.includes(`Best: ${(cyBest / 1000).toFixed(2)}s off`), "final results show each player's best hold");
await shot(tv, "7-tv-final");
await host.getByRole("button", { name: /Replay/ }).waitFor({ timeout: 15000 });
expect(true, "host can play again");

await b.close();
