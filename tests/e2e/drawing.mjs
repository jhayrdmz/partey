/**
 * Draw & Guess E2E: options, the prompt only on the artist's phone, live strokes on the TV (draw,
 * undo), wrong / near / right guesses, names-only live guessers, early close when everyone has it,
 * reveal + points, artist rotation, a round nobody guesses, pause/resume, skip, final results.
 * Host, TV and four phones (emulators + vite running).
 *   node tests/e2e/drawing.mjs [baseUrl] [screenshotDir]
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.argv[2] ?? "http://127.0.0.1:5173";
const OUT = process.argv[3] ?? "screenshots/drawing";
fs.mkdirSync(OUT, { recursive: true });
const NAMES = ["Ana", "Ben", "Cy", "Dee"];
const log = (...a) => console.log("•", ...a);
const expect = (c, m) => { if (!c) throw new Error("FAILED: " + m); log("ok:", m); };
const b = await chromium.launch();
const phone = () => b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }).then((c) => c.newPage());
const tv = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const host = await phone();
const players = await Promise.all(NAMES.map(() => phone()));
const byName = Object.fromEntries(NAMES.map((n, i) => [n, players[i]]));
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` });
const text = (p) => p.locator("body").innerText();
// On failure, capture every device for debugging.
const onFail = async (err) => {
  console.error(err);
  await Promise.all([["tv", tv], ["host", host], ...NAMES.map((n) => [n, byName[n]])].map(([n, p]) => shot(p, `fail-${n}`).catch(() => undefined)));
  process.exit(1);
};
process.on("unhandledRejection", onFail);
process.on("uncaughtException", onFail);

/** Painted (non-transparent) pixels in the first matching canvas. */
const inked = (p, label) =>
  p.locator(`canvas[aria-label*="${label}"]`).first().evaluate((c) => {
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });
const until = async (fn, ms = 10000, what = "condition") => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return; await new Promise((r) => setTimeout(r, 150)); }
  throw new Error(`timed out waiting for ${what}`);
};

/** Drag a squiggle across the artist's canvas (touch-capable phone, mouse pointer). */
async function scribble(p, from = 0.2, to = 0.8) {
  const box = await p.getByRole("img", { name: "Your drawing" }).boundingBox();
  await p.mouse.move(box.x + box.width * from, box.y + box.height * from);
  await p.mouse.down();
  for (let i = 1; i <= 20; i++) {
    const t = from + ((to - from) * i) / 20;
    await p.mouse.move(box.x + box.width * t, box.y + box.height * (from + Math.sin(i / 3) * 0.1 + (to - from) * 0.5));
  }
  await p.mouse.up();
}

await tv.goto(`${BASE}/display`); await tv.getByLabel(/^Pairing code /).waitFor({ timeout: 30000 });
const pair = (await tv.getByLabel(/^Pairing code /).getAttribute("aria-label")).replace("Pairing code ", "").replace(/ /g, "");
await host.goto(`${BASE}/host`); await host.getByLabel("Room name").fill("Draw night");
await host.getByRole("button", { name: "Continue" }).click(); await host.waitForURL(/\/mode$/, { timeout: 30000 });
const roomId = host.url().split("/host/")[1].split("/")[0];
await host.getByRole("button", { name: /Freestyle Mode/ }).click(); await host.waitForURL(/\/games$/);
await host.getByRole("button", { name: /Draw & Guess/ }).first().click();
await host.getByRole("button", { name: /Play Draw & Guess/ }).first().click();
await host.waitForURL(new RegExp(`/host/${roomId}$`));
await host.getByRole("button", { name: "Connect a display" }).click();
await host.getByLabel("Code shown on the display").fill(pair);
await tv.waitForURL(new RegExp(`/display/${roomId}$`), { timeout: 30000 }); await host.keyboard.press("Escape");

// Options: 3 rounds, 45 s, Animals only.
await host.getByText("6 rounds · 80s to draw · hint every 20s · All categories · max 12 players").waitFor({ timeout: 10000 });
expect(true, "lobby shows default options");
await host.getByRole("button", { name: "Draw & Guess options" }).click();
const dlg = host.getByRole("dialog");
for (let i = 0; i < 3; i++) await dlg.getByRole("button", { name: "Rounds: decrease" }).click();
await dlg.getByRole("radio", { name: "45s" }).click();
await dlg.getByRole("radio", { name: "A letter every 10 seconds" }).click();
await dlg.getByRole("button", { name: "Clear all" }).click();
expect(await dlg.getByRole("button", { name: "Save options" }).isDisabled(), "can't save with no categories");
await dlg.getByRole("checkbox", { name: "Animals" }).click();
await shot(host, "1-options");
await dlg.getByRole("button", { name: "Save options" }).click();
await dlg.waitFor({ state: "hidden" });
await host.getByText("3 rounds · 45s to draw · hint every 10s · Animals · max 12 players").waitFor({ timeout: 10000 });
expect(true, "options saved");

await host.getByRole("button", { name: "Show room code" }).click();
const code = (await host.getByRole("dialog").getByLabel(/^Room code /).first().getAttribute("aria-label")).replace("Room code ", "").replace(/ /g, "");
await host.keyboard.press("Escape");
for (const [i, p] of players.entries()) { await p.goto(`${BASE}/play/${code}`); await p.getByLabel("Nickname").fill(NAMES[i]); await p.getByRole("button", { name: "Join the party" }).click(); }
await host.getByText("4/12").waitFor({ timeout: 20000 });
// Waiting for the host: the status is pinned to the bottom of each phone.
{
  const P = byName[NAMES[0]];
  await P.getByText("Waiting for the host to start…").waitFor({ timeout: 10000 });
  const bar = await P.getByText("Waiting for the host to start…").boundingBox();
  expect(bar.y > 844 - 120, `waiting status sticks to the bottom of the screen (y=${Math.round(bar.y)})`);
  await shot(P, "0-phone-waiting");
}

await host.getByRole("button", { name: /Start/ }).last().click();
await tv.getByText("Draw & Guess").first().waitFor({ timeout: 20000 });
// Intro: the countdown is pinned to the bottom of every phone, even while reading the rules.
{
  const P = byName[NAMES[0]];
  await P.getByText("Get ready! Starting in…").waitFor({ timeout: 20000 });
  await P.setViewportSize({ width: 375, height: 667 });
  await P.waitForTimeout(300);
  const timer = await P.getByRole("timer").boundingBox();
  expect(timer && timer.y + timer.height <= 667 && timer.y > 667 - 140, `intro countdown sticks to the bottom of the screen (y=${timer && Math.round(timer.y)})`);
  await shot(P, "0-phone-intro");
  await P.setViewportSize({ width: 390, height: 844 });
}
await host.getByRole("button", { name: "Start drawing" }).click({ timeout: 20000 });

/** The round's artist (from the TV's round label) and their prompt (only on their phone). */
async function roundInfo(round) {
  await tv.getByText(new RegExp(`Round ${round} of 3 · \\S+ draws`)).first().waitFor({ timeout: 20000 });
  const label = await tv.getByText(new RegExp(`Round ${round} of 3 · \\S+ draws`)).first().innerText();
  const artist = label.match(/· (\S+) draws/)[1];
  const p = byName[artist];
  await p.getByText(/^Draw this/).waitFor({ timeout: 15000 });
  const word = (await p.getByText(/^Draw this/).locator("xpath=following-sibling::p").innerText()).trim();
  return { artist, word, guessers: NAMES.filter((n) => n !== artist) };
}

/** Colours live behind one button: open the palette, pick one (it closes). */
const pickColor = async (p, name) => {
  await p.getByRole("button", { name: /^Brush color: / }).click();
  await p.getByRole("radio", { name, exact: true }).click();
  await p.getByRole("radiogroup", { name: "Brush color" }).waitFor({ state: "hidden" });
};
/** Everything on screen without scrolling. */
const fitsScreen = (p) => p.evaluate(() => document.scrollingElement.scrollHeight <= window.innerHeight + 1);

const guess = async (who, g) => {
  const p = byName[who];
  await p.getByLabel("Your guess").fill(g);
  await p.getByRole("button", { name: "Submit guess" }).click();
};

// ── Round 1: draw, undo, guesses, early close ─────────────────────────────
const r1 = await roundInfo(1);
expect(Boolean(r1.word), `round 1: ${r1.artist} draws "${r1.word}"`);
for (const n of r1.guessers) {
  expect((await byName[n].getByText(/^Draw this/).count()) === 0, `${n} doesn't see the prompt`);
  expect(!(await text(byName[n])).toLowerCase().includes(r1.word.toLowerCase()), `${n}'s phone never shows "${r1.word}"`);
  await byName[n].getByLabel("Your guess").waitFor();
}
expect(!(await text(tv)).toLowerCase().includes(r1.word.toLowerCase()), "the TV never shows the prompt during the round");
expect(!(await text(host)).toLowerCase().includes(r1.word.toLowerCase()), "the host screen never shows the prompt during the round");
expect((await byName[r1.artist].getByLabel("Your guess").count()) === 0, "the artist has no guess box");

const A = byName[r1.artist];
await A.getByText("Getting your canvas ready…").waitFor({ state: "hidden", timeout: 15000 });
expect(true, "server granted the artist's canvas");
await scribble(A);
await until(async () => (await inked(tv, "drawing")) > 500, 10000, "strokes on the TV");
expect(true, "the artist's stroke appears on the TV");
await until(async () => (await inked(host, "Preview")) > 100, 10000, "strokes on the host preview");
expect(true, "the host sees a live preview");
{
  const G = byName[r1.guessers[0]];
  await until(async () => (await inked(G, "drawing")) > 100, 10000, "strokes on a guesser's phone");
  const box = await G.getByRole("img", { name: `${r1.artist}'s drawing` }).boundingBox();
  expect(box.width >= 390 * 0.4 && box.width <= 390 * 0.55, `guessers see a small live copy (${Math.round(box.width)}px of 390)`);
}
await pickColor(A, "Red");
expect((await A.getByRole("button", { name: "Brush color: Red" }).count()) === 1, "the colour button shows the picked colour");
await A.getByRole("button", { name: /^Brush size: / }).click();
await A.getByRole("radio", { name: "Huge brush" }).click();
await A.getByRole("radiogroup", { name: "Brush size" }).waitFor({ state: "hidden" });
expect((await A.getByRole("button", { name: "Brush size: Huge" }).count()) === 1, "the pencil button picks the brush size");
await scribble(A, 0.3, 0.6);
const twoStrokes = await inked(tv, "drawing");
await A.getByRole("button", { name: "Undo" }).click();
await until(async () => (await inked(tv, "drawing")) < twoStrokes, 10000, "undo on the TV");
expect(true, "undo removes the stroke from the TV");
await A.getByRole("button", { name: "Reset board" }).click();
await A.getByRole("dialog").getByRole("button", { name: "Keep drawing" }).click();
await A.getByRole("dialog").waitFor({ state: "hidden" });
expect((await inked(tv, "drawing")) > 0, "cancelling the reset keeps the drawing");
await A.getByRole("button", { name: "Reset board" }).click();
await shot(A, "2d-phone-reset-confirm");
await A.getByRole("dialog").getByRole("button", { name: "Reset board" }).click();
await until(async () => (await inked(tv, "drawing")) === 0, 10000, "reset on the TV");
expect(true, "reset (after confirming) empties the TV canvas");
await scribble(A);
await pickColor(A, "Blue");
await scribble(A, 0.1, 0.5);
await until(async () => (await inked(tv, "drawing")) > 500, 10000, "redrawn strokes");
expect(await fitsScreen(A), "artist screen fits a 390×844 phone without scrolling");
await A.getByRole("button", { name: /^Brush color: / }).click();
await shot(A, "2b-phone-artist-colors");
await A.keyboard.press("Escape");
await A.getByRole("button", { name: /^Brush size: / }).click();
await shot(A, "2e-phone-artist-sizes");
await A.keyboard.press("Escape");
await A.setViewportSize({ width: 375, height: 667 });
await A.waitForTimeout(300);
expect(await fitsScreen(A), "...and a small 375×667 phone");
const canvasBox = await A.getByRole("img", { name: "Your drawing" }).boundingBox();
const barBox = await A.getByRole("button", { name: "Undo" }).boundingBox();
expect(canvasBox.width > 200 && canvasBox.y + canvasBox.height <= barBox.y, `canvas (${Math.round(canvasBox.width)}px) sits above the tools`);
await shot(A, "2c-phone-artist-small");
await A.setViewportSize({ width: 390, height: 844 });
await shot(A, "2-phone-artist");

// Letter hints: one letter of the prompt every 10 s, in its right place, on the TV and phones.
const hintOf = async (p) => (await p.getByRole("img", { name: /^Hint: / }).first().getAttribute("aria-label")).replace("Hint: ", "");
const wordPattern = r1.word.split(/\s+/).map((w) => [...w.replace(/[^\p{L}\p{N}]/gu, "")].join(" ")).join("   ");
await until(async () => /[^_ ]/.test(await hintOf(tv)), 20000, "a letter hint on the TV");
const tvHint = await hintOf(tv);
expect(tvHint.length === wordPattern.length && [...tvHint].every((ch, i) => ch === "_" || ch === wordPattern[i]), `TV hint "${tvHint}" shows real letters in place`);
expect([...tvHint].filter((ch) => /[^_ ]/.test(ch)).length < [...wordPattern].filter((ch) => ch !== " ").length, "hint never shows the whole word");
await until(async () => (await hintOf(byName[r1.guessers[0]])) === tvHint || /[^_ ]/.test(await hintOf(byName[r1.guessers[0]])), 10000, "hint on a guesser's phone");
expect(true, "guessers' phones show the hint too");
await shot(tv, "4a-display-hint");

const [g1, g2, g3] = r1.guessers;
await guess(g1, "zzzz nope");
await byName[g1].getByText("“zzzz nope” isn't it. Keep guessing!").waitFor({ timeout: 10000 });
expect(true, "a wrong guess gets feedback and the box stays open");
const near = r1.word.length >= 4 ? r1.word.slice(0, -1) + (r1.word.at(-1) === "x" ? "y" : "x") : null;
if (near) {
  await guess(g1, near);
  await byName[g1].getByText(/So close!/).waitFor({ timeout: 10000 });
  expect(true, `"${near}" is flagged as close`);
}
await shot(byName[g1], "3-phone-guess-wrong");
expect(await fitsScreen(byName[g1]), "guesser screen fits without scrolling (submit pinned at the bottom)");
// On-screen keyboard (simulated: Playwright can't open one). Like iOS, the visual viewport shrinks
// and scrolls while the layout viewport stays full height: the Guess button must sit on the keyboard.
{
  const G = byName[g1];
  const keyboard = (height, offsetTop) => G.evaluate(([h, top]) => {
    const vv = window.visualViewport;
    if (h === null) { delete vv.height; delete vv.offsetTop; }
    else {
      Object.defineProperty(vv, "height", { configurable: true, get: () => h });
      Object.defineProperty(vv, "offsetTop", { configurable: true, get: () => top });
    }
    vv.dispatchEvent(new Event("resize"));
    vv.dispatchEvent(new Event("scroll"));
  }, [height, offsetTop]);
  const buttonBottom = async () => { const b = await G.getByRole("button", { name: "Submit guess" }).boundingBox(); return b.y + b.height; };
  const keyboardTop = (h, top) => top + h; // in layout-viewport coordinates
  await keyboard(480, 0);
  await G.waitForTimeout(150);
  let bottom = await buttonBottom();
  expect(bottom <= keyboardTop(480, 0) && bottom >= keyboardTop(480, 0) - 30, `keyboard up: Guess button sits on top of the keyboard (${Math.round(bottom)} vs ${keyboardTop(480, 0)})`);
  await keyboard(480, 150); // the page scrolled under the keyboard
  await G.waitForTimeout(150);
  bottom = await buttonBottom();
  expect(bottom <= keyboardTop(480, 150) && bottom >= keyboardTop(480, 150) - 30, `page scrolled: the button follows the keyboard (${Math.round(bottom)} vs ${keyboardTop(480, 150)})`);
  await keyboard(null);
  await G.waitForTimeout(150);
  bottom = await buttonBottom();
  expect(bottom >= 844 - 60, `keyboard down: back at the bottom of the screen (${Math.round(bottom)})`);
}
await guess(g1, `the ${r1.word.toUpperCase()}`);
await byName[g1].getByText("You got it!").waitFor({ timeout: 10000 });
expect(true, `${g1} guesses right (case and article ignored)`);
await byName[g1].getByText(/1st to guess · \+100/).waitFor();
expect((await byName[g1].getByLabel("Your guess").count()) === 0, "a correct guesser can't guess again");
await tv.getByText("Guessed it · 1 of 3").waitFor({ timeout: 10000 });
expect((await tv.getByText(g1, { exact: true }).count()) > 0, "the TV names the correct guesser");
expect(!(await text(tv)).toLowerCase().includes(r1.word.toLowerCase()), "...without revealing the answer");
await shot(tv, "4-display-drawing");
await shot(host, "5-host-live");
await guess(g2, r1.word);
await byName[g2].getByText(/2nd to guess · \+80/).waitFor({ timeout: 10000 });
await guess(g3, r1.word.toLowerCase());
// Everyone has it: the round closes early.
await tv.getByText("It was…").waitFor({ timeout: 15000 });
expect(true, "round closes early once everyone has guessed");
await tv.getByText(r1.word, { exact: true }).first().waitFor();
expect(true, "the TV reveals the answer");
const tvReveal = await text(tv);
expect(tvReveal.includes("Everyone guessed it!") && tvReveal.includes("+100") && tvReveal.includes("+80") && tvReveal.includes("+60"), "reveal lists 100 / 80 / 60");
expect(tvReveal.includes(`Drawn by ${r1.artist}`) && tvReveal.includes("+50"), "artist bonus +50");
expect((await inked(tv, "finished drawing")) > 500, "the completed drawing stays on the reveal");
await tv.getByText("Top scores").waitFor();
await shot(tv, "6-display-reveal");
await host.getByText(`The answer: ${r1.word}`).waitFor({ timeout: 10000 });
expect(true, "host sees the answer after the round");
await A.getByText("+50").waitFor({ timeout: 10000 });
expect(true, "artist phone shows +50");
await shot(A, "7-phone-artist-result");
await shot(byName[g1], "8-phone-guesser-result");

// ── Round 2: a different artist; nobody guesses; pause/resume ─────────────
await host.getByRole("button", { name: "Next artist" }).click();
const r2 = await roundInfo(2);
expect(r2.artist !== r1.artist, `round 2: a different artist (${r2.artist})`);
expect(r2.word.toLowerCase() !== r1.word.toLowerCase(), `round 2: a new prompt ("${r2.word}")`);
await byName[r2.artist].getByText("Getting your canvas ready…").waitFor({ state: "hidden", timeout: 15000 });
await scribble(byName[r2.artist]);
await host.getByRole("button", { name: "Pause" }).click();
await tv.getByText("Paused", { exact: true }).first().waitFor({ timeout: 10000 });
await byName[r2.artist].getByText("Paused", { exact: true }).first().waitFor({ timeout: 10000 });
expect(true, "pause freezes the artist's canvas");
await shot(host, "8b-host-paused");
await byName[r2.guessers[0]].getByText("The host will resume the game shortly.").waitFor({ timeout: 10000 });
expect(true, "guessers' phones get the same paused cover as the TV");
await shot(byName[r2.guessers[0]], "8a-phone-paused");
await host.getByRole("button", { name: "Resume" }).click();
await tv.getByText("Paused", { exact: true }).first().waitFor({ state: "hidden", timeout: 10000 });
await byName[r2.artist].getByText("Paused", { exact: true }).first().waitFor({ state: "hidden", timeout: 10000 });
await byName[r2.guessers[0]].getByText("The host will resume the game shortly.").waitFor({ state: "hidden", timeout: 10000 });
expect(true, "resume unfreezes it");
await host.getByRole("button", { name: "End round" }).click();
await tv.getByText("Nobody guessed it! 😅").waitFor({ timeout: 15000 });
expect(true, "host ends the round; nobody guessed");
await byName[r2.guessers[0]].getByText(`It was “${r2.word}”`).waitFor({ timeout: 10000 });
expect(true, "guessers' phones show the answer");

// ── Round 3: skip → final results ─────────────────────────────────────────
await host.getByRole("button", { name: "Next artist" }).click();
const r3 = await roundInfo(3);
expect(r3.artist !== r2.artist, `round 3: not the same artist twice in a row (${r3.artist})`);
expect(new Set([r1.word, r2.word, r3.word].map((w) => w.toLowerCase())).size === 3, "no prompt repeated");
await host.getByRole("button", { name: "Skip round" }).click();
await tv.getByText(/wins|Champion|Results/i).first().waitFor({ timeout: 20000 });
await shot(tv, "9-display-final");
const final = await text(tv);
expect(final.includes(g1), "final standings on the TV");
{
  const P = byName[g1];
  await P.getByText("Waiting for the host to continue…").waitFor({ timeout: 15000 });
  const bar = await P.getByText("Waiting for the host to continue…").boundingBox();
  expect(bar.y > 844 - 120, `game over: "waiting for the host" sticks to the bottom (y=${Math.round(bar.y)})`);
  await shot(P, "11-phone-game-over");
}
await host.getByRole("button", { name: /Replay/ }).waitFor({ timeout: 15000 });
expect(true, "host can replay or choose another game");
await shot(host, "10-host-final");
// "Change" (small, beside Replay) asks before leaving for the game library.
await host.getByRole("button", { name: "Choose another game" }).click();
const changeDlg = host.getByRole("dialog");
await changeDlg.getByText("Choose another game?").waitFor();
await shot(host, "10b-host-change-confirm");
await changeDlg.getByRole("button", { name: "Keep this game" }).click();
await changeDlg.waitFor({ state: "hidden" });
expect(host.url().endsWith(`/host/${roomId}`), "cancelling keeps the host in the lobby");
await host.getByRole("button", { name: "Choose another game" }).click();
await host.getByRole("dialog").getByRole("button", { name: "Choose another", exact: true }).click();
await host.waitForURL(/\/games$/, { timeout: 10000 });
expect(true, "confirming opens the game library");

await b.close();
log("Draw & Guess E2E passed");
