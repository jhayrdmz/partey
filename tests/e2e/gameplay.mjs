/**
 * Gameplay E2E: plays Speed Quiz, Guess the Majority and Reflex Battle in a
 * tournament across a host, a TV and three phones (emulators + vite running).
 *   node tests/e2e/gameplay.mjs [baseUrl] [screenshotDir]
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.argv[2] ?? "http://127.0.0.1:5173";
const SHOTS = process.argv[3] ?? "screenshots";
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch();
const log = (...a) => console.log("✓", ...a);
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png` });
const errors = [];
const pages = [];

async function ctx(options) {
  const c = await browser.newContext(options);
  const p = await c.newPage();
  pages.push(p);
  p.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
  return p;
}

try {
  // ── Setup: tournament with the three playable games ───────────────────
  const host = await ctx({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  await host.goto(`${BASE}/host`);
  await host.getByLabel("Room name").fill("Game Engine Night");
  await host.getByRole("button", { name: "Continue" }).click();
  await host.getByRole("button", { name: /Tournament Mode/ }).click();
  await host.waitForURL(/games$/);
  // Unplayable games can't be added.
  if (!(await host.getByRole("button", { name: "The Impostor (coming soon)" }).isDisabled())) throw new Error("Impostor should be disabled");
  for (const g of ["Speed Quiz", "Guess the Majority", "Reflex Battle"]) await host.getByRole("button", { name: `Add ${g} to lineup` }).click();
  await host.getByRole("button", { name: /Continue with 3 games/ }).first().click();
  await host.getByText("Tournament lineup").waitFor();
  const roomId = host.url().split("/host/")[1];
  // Room code lives in the "Code" pop-up (bottom bar, beside Start).
  await host.getByRole("button", { name: "Show room code" }).click();
  const roomCode = (await host.getByRole("dialog").getByLabel(/^Room code /).first().getAttribute("aria-label")).replace("Room code ", "").replace(/ /g, "");
  await host.keyboard.press("Escape");
  log("tournament created", roomCode, "(unplayable games disabled)");

  const tv = await ctx({ viewport: { width: 1920, height: 1080 } });
  await tv.goto(`${BASE}/display`);
  await tv.getByLabel(/^Pairing code /).waitFor({ timeout: 15000 });
  const code = (await tv.getByLabel(/^Pairing code /).getAttribute("aria-label")).replace("Pairing code ", "").replace(/ /g, "");
  await host.getByRole("button", { name: "Connect a display" }).click();
  await host.getByLabel("Code shown on the display").fill(code); // submits on the 6th digit
  await tv.waitForURL(new RegExp(`/display/${roomId}$`));
  await host.keyboard.press("Escape");

  const names = ["Juan", "Maria", "Pedro"];
  const phones = [];
  for (const [i, n] of names.entries()) {
    const p = await ctx({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });
    await p.goto(`${BASE}/play/${roomCode}`);
    await p.getByLabel("Nickname").fill(n);
    await p.getByRole("radio").nth(i * 3).click();
    await p.getByRole("button", { name: "Join the party" }).click();
    await p.getByText(`Hi, ${n}!`).waitFor();
    phones.push(p);
  }
  const [juan, maria, pedro] = phones;
  log("display paired, 3 players joined");

  const answerOn = async (phone, index) => {
    const group = phone.getByRole("group", { name: "Answers" });
    await group.waitFor();
    await group.getByRole("button").nth(index).click();
    await phone.getByText("Answer locked in!").waitFor();
  };

  // ── Game 1: Speed Quiz ─────────────────────────────────────────────────
  await host.getByRole("button", { name: "Start tournament" }).first().click();
  await tv.getByRole("heading", { level: 1, name: "Speed Quiz" }).waitFor();
  await juan.getByText(/Starting in/).waitFor();
  log("intro with server-synced countdown");
  await host.getByRole("button", { name: "Start round 1" }).first().click();
  await tv.getByText("Round 1 of 8").waitFor();
  await juan.getByRole("group", { name: "Answers" }).waitFor();
  await tv.waitForTimeout(600);
  await shot(tv, "g01-tv-quiz-question");
  await shot(juan, "g02-phone-quiz-question");
  await answerOn(juan, 0);
  await answerOn(maria, 1);
  await tv.getByText("2/3").waitFor();
  log("submissions counted live on TV (2/3)");
  await shot(juan, "g03-phone-locked");
  await answerOn(pedro, 2);
  await tv.getByText("Fastest").waitFor(); // everyone answered → closes early
  await juan.getByText("This game").waitFor();
  await tv.waitForTimeout(1200);
  await shot(tv, "g04-tv-quiz-reveal");
  await shot(juan, "g05-phone-round-result");
  log("all answered → round closed early, reveal + per-player result");

  await host.getByRole("button", { name: "Next round" }).first().click();
  await tv.getByText("Round 2 of 8").waitFor();
  await host.getByRole("button", { name: "Pause" }).first().click();
  await tv.getByText("The host will resume the game shortly.").waitFor();
  await shot(tv, "g06-tv-paused");
  // Answering while paused is blocked.
  if (!(await juan.getByRole("group", { name: "Answers" }).getByRole("button").first().isDisabled())) throw new Error("answers should be disabled while paused");
  await host.getByRole("button", { name: "Resume" }).first().click();
  await tv.getByText("The host will resume the game shortly.").waitFor({ state: "hidden" });
  log("pause / resume");
  await host.getByRole("button", { name: "Skip round" }).first().click();
  await tv.getByText("Round 3 of 8").waitFor();
  log("skip round");
  await shot(host, "g07-host-live-controls");
  await host.getByRole("button", { name: "End game" }).first().click();
  await tv.getByText("Overall leaderboard").waitFor();
  await tv.getByText("+100").first().waitFor();
  await juan.getByText("Leaderboard").first().waitFor();
  await tv.waitForTimeout(2200);
  await shot(tv, "g08-tv-leaderboard");
  log("game ended early → placement points on leaderboard");

  // ── Game 2: Guess the Majority ─────────────────────────────────────────
  await host.getByRole("button", { name: "Start game 2 of 3" }).first().click();
  await tv.getByRole("heading", { level: 1, name: "Guess the Majority" }).waitFor();
  await host.getByRole("button", { name: "Start round 1" }).first().click();
  await tv.getByText("What will MOST people pick?").waitFor();
  await answerOn(juan, 0);
  await answerOn(maria, 0);
  await answerOn(pedro, 1);
  await tv.getByText("The crowd has spoken").waitFor();
  await juan.getByText("+500").waitFor();
  await pedro.getByText("0", { exact: true }).waitFor();
  await tv.waitForTimeout(1000);
  await shot(tv, "g09-tv-majority-reveal");
  await shot(juan, "g10-phone-majority-result");
  log("majority scored: crowd +500, outlier 0");
  await host.getByRole("button", { name: "End game" }).first().click();
  await tv.getByText("Overall leaderboard").waitFor();

  // ── Game 3: Reflex Battle ──────────────────────────────────────────────
  await host.getByRole("button", { name: "Start game 3 of 3" }).first().click();
  await tv.getByRole("heading", { level: 1, name: "Reflex Battle" }).waitFor();
  await host.getByRole("button", { name: "Start round 1" }).first().click();
  await pedro.getByRole("button", { name: "Wait for green" }).waitFor();
  await shot(tv, "g11-tv-reflex-wait");
  await pedro.getByRole("button", { name: "Wait for green" }).click(); // false start
  await pedro.getByText("Tapped!").waitFor();
  await juan.getByRole("button", { name: "Tap now!" }).waitFor({ timeout: 10000 });
  await shot(tv, "g12-tv-reflex-go");
  await juan.getByRole("button", { name: "Tap now!" }).click();
  await maria.getByRole("button", { name: "Tap now!" }).click();
  await tv.getByText("Reaction times").waitFor();
  await tv.getByText("False start").waitFor();
  await pedro.getByText(/False start/).waitFor();
  await tv.waitForTimeout(800);
  await shot(tv, "g13-tv-reflex-results");
  log("reflex: false start detected, reaction times ranked");

  // No host input: the reveal timer expires and devices auto-advance via tickGame.
  await tv.getByText("Round 2 of 5").waitFor({ timeout: 20000 });
  log("timer expiry auto-advanced to the next round (server-checked tick)");
  await host.getByRole("button", { name: "End game" }).first().click();
  await tv.getByText("Champion!").waitFor();
  await juan.getByText("Final results").waitFor();
  await tv.waitForTimeout(2500);
  await shot(tv, "g14-tv-champion");
  await shot(juan, "g15-phone-final");
  log("tournament complete → champion");

  if (errors.length) console.log("\nBrowser errors:\n" + [...new Set(errors)].join("\n"));
  console.log("\nGAMEPLAY PASSED");
} catch (err) {
  console.error("\nGAMEPLAY FAILED:", err);
  for (const [i, p] of pages.entries()) await p.screenshot({ path: `${SHOTS}/gfail-${i}.png` }).catch(() => {});
  if (errors.length) console.log("\nBrowser errors:\n" + [...new Set(errors)].join("\n"));
  process.exitCode = 1;
} finally {
  await browser.close();
}
