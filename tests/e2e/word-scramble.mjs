/**
 * Word Scramble E2E (emulators + vite running): options, the 5-second guess cooldown (UI and server,
 * including a client trying to skip it), wrong guesses, simultaneous correct answers scored by server
 * time, lock-out after solving, hints, timer expiry, the cooldown resetting each round, a reconnect,
 * and final results with words solved. Host + TV + 2 phone browsers + 3 API players.
 *   node tests/e2e/word-scramble.mjs [baseUrl] [screenshotDir]
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.argv[2] ?? "http://127.0.0.1:5173";
const OUT = process.argv[3] ?? "screenshots/word-scramble";
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
/** The authoritative game state (server-only; read here with emulator admin access). */
const gameState = async (roomId) => {
  const f = (await req(`${FS}/rooms/${roomId}/gameState/current`, { headers: owner })).body.fields;
  const scores = Object.fromEntries(Object.entries(f.scores.mapValue.fields ?? {}).map(([k, v]) => [k, Number(v.integerValue ?? v.doubleValue)]));
  return { round: Number(f.round.integerValue), phase: f.phase.stringValue, word: f.roundSecret?.mapValue?.fields?.word?.stringValue, scores };
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
await host.goto(`${BASE}/host`); await host.getByLabel("Room name").fill("Scramble night");
await host.getByRole("button", { name: "Continue" }).click(); await host.waitForURL(/\/mode$/, { timeout: 30000 });
const roomId = host.url().split("/host/")[1].split("/")[0];
await host.getByRole("button", { name: /Freestyle Mode/ }).click(); await host.waitForURL(/\/games$/);
await host.getByRole("button", { name: /Word Scramble/ }).first().click();
await host.getByRole("button", { name: /Play Word Scramble/ }).first().click();
await host.waitForURL(new RegExp(`/host/${roomId}$`));
await host.getByText("10 words · 30s each · Mixed · Random · hints").waitFor({ timeout: 10000 });
expect(true, "default options: 10 words, 30s, Mixed, Random, hints on");
await host.getByRole("button", { name: "Word Scramble options" }).click();
const dlg = host.getByRole("dialog");
await dlg.getByRole("radio", { name: "Custom" }).click();
for (let i = 0; i < 7; i++) await dlg.getByRole("button", { name: "Custom rounds: decrease" }).click(); // 10 → 3
await dlg.getByRole("radio", { name: "20s" }).click();
await dlg.getByRole("radio", { name: "Easy" }).click();
await dlg.getByRole("radio", { name: "Animals" }).click();
await shot(host, "1-options");
await dlg.getByRole("button", { name: "Save options" }).click();
await host.getByText("3 words · 20s each · Easy · Animals · hints").waitFor({ timeout: 10000 });
expect(true, "options saved: 3 custom rounds, 20s, Easy, Animals");
await host.getByRole("button", { name: "Connect a display" }).click();
await host.getByLabel("Code shown on the display").fill(pair);
await tv.waitForURL(new RegExp(`/display/${roomId}$`), { timeout: 30000 }); await host.keyboard.press("Escape");
await host.getByRole("button", { name: "Show room code" }).click();
const code = (await host.getByRole("dialog").getByLabel(/^Room code /).first().getAttribute("aria-label")).replace("Room code ", "").replace(/ /g, "");
await host.keyboard.press("Escape");

// ── Players: 2 phones + 3 API clients ───────────────────────────────────
const [ana, ben] = [await phone(), await phone()];
for (const [p, n] of [[ana, "Ana"], [ben, "Ben"]]) {
  await p.goto(`${BASE}/play/${code}`); await p.getByLabel("Nickname").fill(n); await p.getByRole("button", { name: "Join the party" }).click();
  await p.getByText(`Hi, ${n}!`).waitFor({ timeout: 20000 });
}
const api = {};
for (const [n, avatar] of [["Cy", "jeep"], ["Dee", "fish"], ["Eve", "cat"]]) {
  api[n] = await signUp();
  expect((await callable("joinRoom", api[n], { roomCode: code, nickname: n, avatar })).ok, `${n} joins (API)`);
}
const guess = (n, round, g) => callable("submitAnswer", api[n], { roomId, round, answer: { guess: g } });
/** Spell a word on a phone by tapping its letter tiles in order (the last tap sends the guess). */
async function spell(p, word) {
  for (const ch of word) await p.locator(`[aria-label="Letter ${ch}"]:not([disabled])`).first().click();
}
const tilesLocked = (p) => p.getByRole("group", { name: "Letters" }).getByRole("button").evaluateAll((bs) => bs.every((b) => b.disabled));

await host.getByRole("button", { name: /Start/ }).last().click();
await host.getByRole("button", { name: "Start round 1" }).click({ timeout: 20000 });

// ── Round 1 ─────────────────────────────────────────────────────────────
await ana.getByLabel("Your answer").waitFor({ timeout: 20000 });
const r1 = await gameState(roomId);
const word1 = r1.word;
expect(word1 && word1.length <= 5, `round 1 word "${word1}" (easy: ≤5 letters)`);
const tiles = (await tv.getByRole("img", { name: /^Letters: / }).first().getAttribute("aria-label")).replace("Letters: ", "").replace(/ /g, "");
expect(tiles !== word1 && [...tiles].sort().join("") === [...word1].sort().join(""), `TV shows the scramble "${tiles}", never the word`);
const anaTiles = (await ana.getByRole("group", { name: "Letters" }).getByRole("button").evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label").replace("Letter ", "")))).join("");
expect(anaTiles === tiles, "phones get the same scramble as the TV");
expect(!(await tv.locator("body").innerText()).includes(word1), "the word is never on the TV during the round");

// A wrong guess on a phone: feedback + visible cooldown, button disabled.
// Tap-to-spell: tapping a letter fills the next slot; tapping a placed letter (or Undo) sends it back.
expect((await ana.getByRole("textbox").count()) === 0, "phones have no text box: letters are tapped");
await ana.locator(`[aria-label="Letter ${tiles[0]}"]:not([disabled])`).first().click();
await ana.locator(`[aria-label="Letter ${tiles[1]}"]:not([disabled])`).first().click();
expect((await ana.getByRole("button", { name: /^Remove / }).count()) === 2, "two tapped letters fill the first two slots");
await ana.getByRole("button", { name: `Remove ${tiles[1]}` }).click();
await ana.getByRole("button", { name: "Undo last letter" }).click();
expect((await ana.getByRole("button", { name: /^Remove / }).count()) === 0, "tapping a placed letter and Undo send letters back");
await shot(ana, "2a-phone-tiles");
// The scramble's own order is never the word: a wrong guess, sent when the last slot fills.
await spell(ana, tiles);
await ana.getByText("Incorrect! Try again.").waitFor({ timeout: 10000 });
await ana.getByText(/Next guess available in \ds/).waitFor();
expect(await tilesLocked(ana), "wrong guess (sent automatically): 'Incorrect! Try again.', cooldown shown, tiles locked");
await shot(ana, "2-phone-cooldown");

// The server enforces the cooldown even if a client skips the UI.
const w1 = await guess("Cy", 1, "nope");
expect(w1.ok && w1.result.correct === false && w1.result.retryAtMs > Date.now() - 1000, "Cy's wrong guess (API) is accepted as wrong, with a retry time");
const tooSoon = await guess("Cy", 1, word1);
expect(!tooSoon.ok && tooSoon.error.status === "RESOURCE_EXHAUSTED" && tooSoon.error.details?.retryAtMs, `a second guess within 5s is refused by the server: "${tooSoon.error?.message}"`);
const other = await guess("Dee", 1, "nope");
expect(other.ok, "one player's cooldown doesn't affect another");
await sleep(5200);
// Cy and Dee answer at the same instant: both count, in a distinct, consistent order.
const [c, d] = await Promise.all([guess("Cy", 1, word1.toLowerCase()), guess("Dee", 1, `  ${word1}  `)]);
expect(c.ok && c.result.accepted && d.ok && d.result.accepted, "simultaneous correct answers both accepted (case/space-insensitive)");
const again = await guess("Cy", 1, word1);
expect(again.ok && again.result.accepted === false, "a solved player can't score twice");
await ana.waitForFunction(() => [...document.querySelectorAll('[aria-label^="Letter "]')].some((b) => !b.disabled), null, { timeout: 10000 });
expect((await ana.getByRole("button", { name: /^Remove / }).count()) === 0, "after the cooldown the letters are back in the pool");
await spell(ana, word1);
await ana.getByText(/Correct! \+50 points!/).waitFor({ timeout: 10000 });
await ana.getByText("3rd to solve it").waitFor();
await ana.getByText("Waiting for the next round…").waitFor();
expect((await ana.getByLabel("Your answer").count()) === 0, "Ana: 'Correct! +50 points!', 3rd, locked until the next round");
await shot(ana, "3-phone-solved");
await tv.getByText("Solved it · 3/5").waitFor({ timeout: 10000 });
expect(true, "TV counts correct answers live (3/5) and names them");
await tv.getByText(/Starts with [A-Z]/).waitFor({ timeout: 15000 });
expect(true, "hint revealed halfway: the first letter");
await shot(tv, "4-display-round");
// Eve guesses wrong just before the round ends; Ben never answers: the timer ends the round.
await guess("Eve", 1, "nope");
await tv.getByText("The word was").waitFor({ timeout: 25000 });
expect(true, "timer expiry ends the round");
const after1 = await gameState(roomId);
const pts = [after1.scores[api.Cy.localId], after1.scores[api.Dee.localId]].sort((a, b) => b - a);
expect(pts[0] === 100 && pts[1] === 75, `the two simultaneous answers got 100 and 75 (server time order), no duplicate`);
expect(Object.values(after1.scores).filter((v) => v === 50).length === 1, "Ana (3rd) got 50");
const tvReveal = await tv.locator("body").innerText();
expect(tvReveal.includes("+100") && tvReveal.includes("+75") && tvReveal.includes("+50") && tvReveal.includes("3 of 5 solved it"), "reveal shows the word, positions and points");
await shot(tv, "5-display-reveal");
await ben.getByText(`Time's up! It was ${word1}`).waitFor({ timeout: 10000 });
expect(true, "Ben (didn't answer): 'Time's up! It was …'");

// ── Round 2: cooldown reset, reconnect ──────────────────────────────────
await host.getByRole("button", { name: "Next word" }).click();
await ana.getByLabel("Your answer").waitFor({ timeout: 20000 });
const r2 = await gameState(roomId);
expect(r2.round === 2 && r2.word !== word1, `round 2: a new word`);
const eve2 = await guess("Eve", 2, "nope");
expect(eve2.ok && eve2.result.correct === false, "the cooldown resets each round (Eve guesses at once)");
const anaScore = await ana.getByText(/^\d+ pts$/).first().innerText();
await ana.reload();
await ana.getByLabel("Your answer").waitFor({ timeout: 20000 });
expect((await ana.getByText(/^\d+ pts$/).first().innerText()) === anaScore, `Ana reconnects mid-round with her score (${anaScore})`);
await spell(ben, r2.word);
await ben.getByText(/Correct! \+100 points!/).waitFor({ timeout: 10000 });
expect(true, "Ben solves round 2 first: +100");
await host.getByRole("button", { name: "Reveal word" }).click();
await tv.getByText("The word was").waitFor({ timeout: 15000 });

// ── Round 3 → final results ─────────────────────────────────────────────
await host.getByRole("button", { name: "Next word" }).click();
await ana.getByLabel("Your answer").waitFor({ timeout: 20000 });
const r3 = await gameState(roomId);
const cy3 = await guess("Cy", 3, r3.word);
expect(cy3.ok && cy3.result.accepted, `Cy solves round 3 (${JSON.stringify(cy3.error ?? cy3.result)}, round ${r3.round} ${r3.phase})`);
await host.getByRole("button", { name: "Reveal word" }).click();
// Wait on the server (the TV may still show the previous reveal for a moment).
for (let i = 0; i < 50 && (await gameState(roomId)).phase !== "reveal"; i++) await sleep(200);
const finalScores = (await gameState(roomId)).scores;
await host.getByRole("button", { name: "Show results" }).click();
await tv.getByText(/results/i).first().waitFor({ timeout: 20000 });
await tv.waitForTimeout(2500);
const finalText = await tv.locator("body").innerText();
expect(finalText.includes("2 words solved") && finalText.includes("1 word solved"), "final results show words solved per player");
expect(finalScores[api.Cy.localId] === 100 + 100 || finalScores[api.Cy.localId] === 75 + 100, `Cy's total is right (${finalScores[api.Cy.localId]})`);
await shot(tv, "6-display-final");
await ana.getByText(/word(s)? solved/).first().waitFor({ timeout: 10000 });
expect(true, "phones show words solved on the final leaderboard");
await shot(ana, "7-phone-final");
await host.getByRole("button", { name: /Replay/ }).waitFor({ timeout: 15000 });
expect(true, "host can play again");

await b.close();
await clearHosts();
log("Word Scramble E2E passed");
