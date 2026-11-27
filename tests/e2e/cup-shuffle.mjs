/**
 * Cup Shuffle E2E (emulators + vite running): options, the ball shown then shuffled on the TV, the TV's
 * cups ending where the server says the ball is, phones locked until the cups stop, picks on the phone
 * (one per round), server checks (too early, invalid, duplicates), reveal and points, more and faster
 * swaps each round ("Faster!" at 30/60/80% of the game), streak bonuses, pause freezing the shuffle, the phone
 * playing the same shuffle itself (no TV needed), and final results with balls found and tied players sharing a place.
 * Host + TV + 2 phone browsers + 2 API players.
 *   node tests/e2e/cup-shuffle.mjs [baseUrl] [screenshotDir]
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.argv[2] ?? "http://127.0.0.1:5173";
const OUT = process.argv[3] ?? "screenshots/cup-shuffle";
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
  const swaps = (pub?.swaps?.arrayValue?.values ?? []).map((s) => [num(s.mapValue.fields.a), num(s.mapValue.fields.b)]);
  return {
    round: num(f.round), phase: f.phase.stringValue, paused: f.paused?.booleanValue === true, scores,
    ballStart: num(pub?.ballStart), shuffleAtMs: num(pub?.shuffleAtMs), guessAtMs: num(pub?.guessAtMs), swapMs: num(pub?.swapMs), swaps,
    ballSlot: num(f.roundSecret?.mapValue?.fields?.ballSlot),
  };
};
const displayGame = async (roomId) => (await req(`${FS}/rooms/${roomId}/displayState/current`, { headers: owner })).body.fields.game.mapValue.fields;
const finalSlot = (start, swaps) => swaps.reduce((s, [a, b]) => (s === a ? b : s === b ? a : s), start);
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
await host.goto(`${BASE}/host`); await host.getByLabel("Room name").fill("Cup night");
await host.getByRole("button", { name: "Continue" }).click(); await host.waitForURL(/\/mode$/, { timeout: 30000 });
const roomId = host.url().split("/host/")[1].split("/")[0];
await host.getByRole("button", { name: /Freestyle Mode/ }).click(); await host.waitForURL(/\/games$/);
await host.getByRole("button", { name: /Cup Shuffle/ }).first().click();
await host.getByRole("button", { name: /Play Cup Shuffle/ }).first().click();
await host.waitForURL(new RegExp(`/host/${roomId}$`));
await host.getByText("5 rounds · max 24 players").waitFor({ timeout: 10000 });
expect(true, "default options: 5 rounds, 24 players");
await host.getByRole("button", { name: "Cup Shuffle options" }).click();
const dlg = host.getByRole("dialog");
await dlg.getByRole("radio", { name: "3" }).click();
await shot(host, "1-options");
await dlg.getByRole("button", { name: "Save options" }).click();
await host.getByText("3 rounds · max 24 players").waitFor({ timeout: 10000 });
expect(true, "options saved: 3 rounds");
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
const pickApi = (n, round, choice) => callable("submitAnswer", api[n], { roomId, round, answer: { choice } });
const cupBtn = (p, slot) => p.getByRole("button", { name: new RegExp(`^Cup ${slot + 1} `) });
const tvStage = () => tv.locator("[data-stage]").first().getAttribute("data-stage");
const waitStage = async (stage, timeout = 20000) => {
  const until = Date.now() + timeout;
  while (Date.now() < until) { if ((await tvStage().catch(() => null)) === stage) return; await sleep(50); }
  throw new Error(`TV never reached stage ${stage}`);
};
/** The TV's cups, left to right, by cup id (cup id = the slot it started in). */
const tvOrder = () => tv.locator("[data-cup]").evaluateAll((els) => els.map((el) => ({ cup: Number(el.dataset.cup), x: el.getBoundingClientRect().x })).sort((a, b) => a.x - b.x).map((c) => c.cup));
const tvXs = () => tv.locator("[data-cup]").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().x)));
/** Same, on a phone: it plays the shuffle itself. */
const phoneOrder = (p) => p.locator("[data-cup]").evaluateAll((els) => els.map((el) => ({ cup: Number(el.dataset.cup), x: el.getBoundingClientRect().x })).sort((a, b) => a.x - b.x).map((c) => c.cup));
const phoneXs = (p) => p.locator("[data-cup]").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().x)));
const untilAt = async (ms) => { const wait = ms - Date.now(); if (wait > 0) await sleep(wait); };

await host.getByRole("button", { name: /Start/ }).last().click();
await host.getByRole("button", { name: "Start round 1" }).waitFor({ timeout: 20000 });
for (const [p, name] of [[tv, "tv"], [ana, "phone"]]) {
  const h1 = p.getByRole("heading", { name: "Cup Shuffle." });
  await h1.waitFor({ timeout: 15000 });
  const fits = await h1.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= window.innerWidth);
  expect(fits, `${name} rules screen: the title fits on one line, with the dot`);
  await shot(p, `0-${name}-rules`);
}
await host.getByRole("button", { name: "Start round 1" }).click();

// ── Round 1: ball, shuffle, picks ───────────────────────────────────────
await cupBtn(ana, 0).waitFor({ timeout: 20000 });
const r1 = await gameState(roomId);
expect(r1.round === 1 && r1.swaps.length >= 3 && r1.swaps.length <= 5, `round 1: ${r1.swaps.length} swaps (3–5)`);
expect(r1.swaps.every(([a, b]) => a !== b && [a, b].every((s) => s >= 0 && s <= 2)), "every swap moves two different cups");
expect(r1.ballSlot === finalSlot(r1.ballStart, r1.swaps), `the server's answer follows the ball (cup ${r1.ballStart + 1} → ${r1.ballSlot + 1})`);
const pubKeys = Object.keys((await displayGame(roomId)).round_data.mapValue.fields);
expect(!pubKeys.includes("ballSlot"), `the answer isn't in the public round data (${pubKeys.join(", ")})`);
expect(await cupBtn(ana, 0).isDisabled(), "phone cups are locked while the TV shows the ball");
expect((await ana.locator("[data-cup]").count()) === 3, "the phone shows the three cups too");

await waitStage("peek");
await tv.getByTestId("ball").waitFor({ timeout: 3000 });
expect(true, "TV lifts a cup and shows the ball");
await ana.getByTestId("ball").waitFor({ timeout: 3000 });
expect(true, "the phone lifts the same cup and shows the ball");
await shot(ana, "2-phone-ball");
await shot(tv, "2-tv-ball");
const early = await pickApi("Cy", 1, 0);
expect(!early.ok && /cups to stop/.test(early.error?.message), `a pick while the cups move is refused (${early.error?.message})`);

await waitStage("shuffle");
expect((await tv.getByTestId("ball").count()) === 0, "the ball is hidden during the shuffle");
await untilAt(r1.shuffleAtMs + r1.swapMs * 0.5);
const xsA = await tvXs(); await sleep(120); const xsB = await tvXs();
expect(xsA.some((x, i) => x !== xsB[i]), "cups move on the TV during the shuffle");
const pxA = await phoneXs(ana); await sleep(120); const pxB = await phoneXs(ana);
expect(pxA.some((x, i) => x !== pxB[i]), "cups move on the phone too (played on the phone from the round data)");
await shot(tv, "3-tv-shuffle");
await shot(ana, "3-phone-watch");

await waitStage("guess");
const order1 = await tvOrder();
expect(order1.indexOf(r1.ballStart) === r1.ballSlot, `the TV's cups end with the ball's cup at slot ${r1.ballSlot + 1} (${order1.join(",")})`);
await sleep(300);
const pOrder1 = await phoneOrder(ana);
expect(pOrder1.join() === order1.join(), `the phone's cups end in the same places as the TV's (${pOrder1.join(",")})`);
await tv.getByText(/\d+s · 0 \/ 4 picked/).waitFor({ timeout: 3000 });
expect(true, "TV shows the picking countdown and 0 / 4 picked");
await shot(tv, "4-tv-guess");
await cupBtn(ana, r1.ballSlot).waitFor({ state: "visible" });
for (let i = 0; i < 30 && (await cupBtn(ana, 0).isDisabled()); i++) await sleep(100);
expect(!(await cupBtn(ana, 0).isDisabled()), "phone cups open when the cups stop");
await shot(ana, "4-phone-pick");

const wrong = (r1.ballSlot + 1) % 3;
await cupBtn(ana, r1.ballSlot).click();
await ana.getByText(`Cup ${r1.ballSlot + 1} locked in!`).waitFor({ timeout: 10000 });
expect(true, "Ana picks the right cup and sees it locked in");
await shot(ana, "5-phone-locked");
await cupBtn(ben, wrong).click();
await ben.getByText(`Cup ${wrong + 1} locked in!`).waitFor({ timeout: 10000 });
expect(true, "Ben picks a wrong cup");
const bad = await pickApi("Cy", 1, 3);
expect(!bad.ok && /Pick a cup/.test(bad.error?.message), "an invalid cup is refused");
expect((await pickApi("Cy", 1, r1.ballSlot)).result?.accepted === true, "Cy picks the right cup (API)");
expect((await pickApi("Cy", 1, wrong)).result?.accepted === false, "a second pick in the same round is ignored");
await tv.getByText(/3 \/ 4 picked/).waitFor({ timeout: 10000 });
expect(true, "TV counts the picks");

await host.getByRole("button", { name: "Reveal the ball" }).click();
await tv.getByText(`Cup ${r1.ballSlot + 1}!`).waitFor({ timeout: 15000 });
await tv.getByTestId("ball").waitFor({ timeout: 3000 });
const found = await tv.getByRole("list", { name: "Found the ball" }).innerText();
expect(found.includes("Ana") && found.includes("Cy") && !found.includes("Ben") && !found.includes("Dee"), "TV reveal: the ball's cup lifts, Ana and Cy found it");
expect((await tv.locator(`[data-picks="${r1.ballSlot}"]`).innerText()) === "2 picks" && (await tv.locator(`[data-picks="${wrong}"]`).innerText()) === "1 pick", "TV shows the picks under each cup");
await shot(tv, "6-tv-reveal");
const s1 = (await gameState(roomId)).scores;
expect(s1[api.Cy.localId] === 100 && s1[api.Dee.localId] === 0, "Cy +100, Dee (no pick) 0");
expect(Object.values(s1).filter((v) => v === 100).length === 2 && Object.values(s1).filter((v) => v === 0).length === 2, "round 1: two players on 100, two on 0");
await ana.getByText("Found it!").waitFor({ timeout: 10000 });
await ben.getByText("Missed!").waitFor({ timeout: 10000 });
await ben.getByText(`The ball was under cup ${r1.ballSlot + 1}`).waitFor();
expect(true, "phones: Ana 'Found it!', Ben 'Missed!' with where the ball was");
await shot(ana, "6-phone-found"); await shot(ben, "6-phone-missed");

// ── Round 2: more and faster swaps; pause freezes the shuffle ───────────
await host.getByRole("button", { name: "Next round" }).click();
for (let i = 0; i < 50 && (await gameState(roomId)).round !== 2; i++) await sleep(200);
const r2 = await gameState(roomId);
expect(r2.swaps.length >= 6 && r2.swaps.length <= 8 && r2.swapMs < r1.swapMs && r2.swapMs === 500, `round 2: ${r2.swaps.length} swaps (6–8), faster (${r2.swapMs} < ${r1.swapMs} ms)`);
await tv.getByTestId("speed-up").waitFor({ timeout: 5000 });
await ana.getByTestId("speed-up").waitFor({ timeout: 5000 });
expect(true, "round 2 is past 30% of the game: TV and phone show 'Faster!'");
await shot(ana, "6b-phone-faster");
await waitStage("shuffle");
await untilAt(r2.shuffleAtMs + r2.swapMs * 2.4);
await host.getByRole("button", { name: /^Pause/ }).click();
for (let i = 0; i < 50 && !(await gameState(roomId)).paused; i++) await sleep(100);
await sleep(600);
const p1 = await tvXs(); await sleep(500); const p2 = await tvXs();
expect(p1.every((x, i) => x === p2[i]), "pause freezes the cups on the TV");
await ana.getByRole("status").getByText("Paused").waitFor({ timeout: 5000 });
expect(true, "phone shows Paused");
await host.getByRole("button", { name: /Resume/ }).click();
for (let i = 0; i < 50 && (await gameState(roomId)).paused; i++) await sleep(100);
const r2b = await gameState(roomId);
expect(r2b.guessAtMs > r2.guessAtMs && r2b.swaps.length === r2.swaps.length, `resume shifts the shuffle (${r2b.guessAtMs - r2.guessAtMs} ms later), same swaps`);
await waitStage("guess", 30000);
const order2 = await tvOrder();
expect(order2.indexOf(r2b.ballStart) === r2b.ballSlot, "after the pause, the TV's cups still end where the ball is");
expect((await pickApi("Dee", 2, r2b.ballSlot)).ok, "Dee picks right in round 2");
expect((await pickApi("Cy", 2, r2b.ballSlot)).ok, "Cy picks right again in round 2");
await host.getByRole("button", { name: "Reveal the ball" }).click();
await tv.getByText(`Cup ${r2b.ballSlot + 1}!`).waitFor({ timeout: 15000 });
await ana.getByText("No pick this round").waitFor({ timeout: 10000 });
expect(true, "Ana's phone: 'No pick this round'");
await tv.getByTestId("streak-line").filter({ hasText: "Cy: 2 in a row · +25 bonus" }).waitFor({ timeout: 5000 });
expect(true, "TV reveal: Cy's streak (2 in a row, +25)");
await shot(tv, "6c-tv-streak");
expect((await gameState(roomId)).scores[api.Cy.localId] === 225, "Cy: 100 + 125 (streak bonus +25)");

// ── Round 3 → final results ─────────────────────────────────────────────
await host.getByRole("button", { name: "Next round" }).click();
for (let i = 0; i < 50 && (await gameState(roomId)).round !== 3; i++) await sleep(200);
const r3 = await gameState(roomId);
expect(r3.swaps.length >= 9 && r3.swaps.length <= 11 && r3.swapMs === 380, `round 3: ${r3.swaps.length} swaps (9–11), faster again (${r3.swapMs} ms)`);
await untilAt(r3.guessAtMs + 100);
expect((await pickApi("Cy", 3, r3.ballSlot)).ok, "Cy picks right in round 3");
await host.getByRole("button", { name: "Reveal the ball" }).click();
for (let i = 0; i < 50 && (await gameState(roomId)).phase !== "reveal"; i++) await sleep(200);
const fin = (await gameState(roomId)).scores;
expect(fin[api.Cy.localId] === 375 && fin[api.Dee.localId] === 100, `totals: Cy 375 (100 + 125 + 150, 3 in a row), Dee 100`);
await host.getByRole("button", { name: "Show results" }).click();
await tv.getByText(/results/i).first().waitFor({ timeout: 20000 });
await tv.waitForTimeout(2500);
const finalText = await tv.locator("body").innerText();
expect(finalText.includes("3 balls found") && finalText.includes("1 ball found"), "final results show balls found");
const places = await tv.locator("[data-place]").evaluateAll((els) => els.map((el) => Number(el.dataset.place)).sort());
expect(places.join() === "1,2,2", `Ana and Dee tie on 100 and share 2nd place on the podium (${places.join(",")})`);
await shot(tv, "7-tv-final");
await host.getByRole("button", { name: /Replay/ }).waitFor({ timeout: 15000 });
expect(true, "host can play again");

await b.close();
