/**
 * End-to-end smoke test of the core multi-device flow against the Firebase
 * Emulator Suite. Run with emulators + `vite` running:
 *   node tests/e2e/flow.mjs [baseUrl] [screenshotDir]
 *
 * Simulates: host on a tablet, a TV display, and phones at 320px / 375px / 390px.
 */
import { createRequire } from "node:module";
// Uses the preinstalled Playwright (or a local devDependency) via CommonJS resolution.
const { chromium } = createRequire(import.meta.url)("playwright");
import fs from "node:fs";

const BASE = process.argv[2] ?? "http://127.0.0.1:5173";
const SHOTS = process.argv[3] ?? "screenshots";
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const log = (...a) => console.log("✓", ...a);
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const errors = [];
const allPages = [];

async function ctx(options) {
  const c = await browser.newContext(options);
  const p = await c.newPage();
  allPages.push(p);
  p.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text()) && errors.push(`[console] ${m.text()}`));
  return p;
}

try {
  // ── Landing ───────────────────────────────────────────────────────────
  const landingPhone = await ctx({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await landingPhone.goto(BASE);
  await landingPhone.getByRole("link", { name: /Host a Game/ }).waitFor();
  await landingPhone.waitForTimeout(900); // let entrance animations settle
  await shot(landingPhone, "01-landing-320");

  // ── Host on a landscape tablet ────────────────────────────────────────
  const host = await ctx({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1, hasTouch: true });
  await host.goto(BASE);
  await host.waitForTimeout(900);
  await shot(host, "02-landing-tablet");
  await host.getByRole("link", { name: /Host a Game/ }).click();
  await host.getByLabel("Room name").fill("Barkada Game Night");
  await shot(host, "03-host-create");
  await host.getByRole("button", { name: "Continue" }).click();
  await host.waitForURL(/\/host\/[^/]+\/mode$/);
  await host.getByText("Tournament Mode").waitFor();
  await shot(host, "04-host-mode");
  log("room created");
  const roomId = host.url().split("/host/")[1].split("/")[0];

  await host.getByRole("button", { name: /Tournament Mode/ }).click();
  await host.waitForURL(/\/games$/);
  await host.getByRole("button", { name: "Add Speed Quiz to lineup" }).click();
  await host.getByRole("button", { name: "Add Guess the Majority to lineup" }).click();
  await host.getByRole("button", { name: "Add Speed Quiz to lineup" }).click(); // same game twice
  await host.getByRole("button", { name: "Add Reflex Battle to lineup" }).click();
  await host.getByRole("button", { name: "Move Reflex Battle up" }).click();
  await host.getByRole("button", { name: /Remove Speed Quiz/ }).last().click();
  await host.getByRole("tab", { name: "Social" }).click();
  await shot(host, "05-host-games-filtered");
  await host.getByRole("tab", { name: "All games" }).click();
  await host.getByLabel("Search games").fill("zzz");
  await host.getByText("No games found").waitFor();
  await host.getByLabel("Search games").fill("");
  await shot(host, "06-host-games-lineup");
  await host.getByRole("button", { name: /Continue with 3 games/ }).first().click();
  await host.waitForURL(new RegExp(`/host/${roomId}$`));
  await host.getByText("Tournament lineup").waitFor();
  const roomCode = (await host.getByLabel(/^Room code /).first().getAttribute("aria-label")).replace("Room code ", "").replace(/ /g, "");
  log("lineup saved; room code", roomCode);
  await shot(host, "07-host-lobby-empty");

  // ── Display pairing ───────────────────────────────────────────────────
  const tv = await ctx({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await tv.goto(`${BASE}/display`);
  await tv.getByLabel("Display pairing code").waitFor();
  await shot(tv, "08-display-pair");

  // Wrong code is rejected without leaking anything.
  await tv.getByLabel("Display pairing code").fill("000000");
  await tv.getByText(/invalid or expired/).waitFor();
  log("invalid pairing code rejected");

  await host.getByRole("button", { name: "Connect a display" }).click();
  const codeEl = host.getByLabel(/^Pairing code /);
  await codeEl.waitFor();
  const pairingCode = (await codeEl.getAttribute("aria-label")).replace("Pairing code ", "").replace(/ /g, "");
  await shot(host, "09-host-pairing-code");
  await tv.getByLabel("Display pairing code").fill(pairingCode);
  await tv.getByText("Waiting for the host…").waitFor();
  await host.getByText("Approve this display?").waitFor();
  await shot(host, "10-host-approve");
  await host.getByRole("button", { name: "Approve" }).click();
  await tv.waitForURL(new RegExp(`/display/${roomId}$`), { timeout: 15000 });
  await tv.getByText("Barkada Game Night").waitFor();
  log("display paired & approved");

  // Pairing code is single-use: a second display cannot reuse it.
  const tv2 = await ctx({ viewport: { width: 1280, height: 720 } });
  await tv2.goto(`${BASE}/display`);
  await tv2.getByLabel("Display pairing code").fill(pairingCode);
  await tv2.getByText(/invalid or expired/).waitFor();
  log("pairing code is single-use");

  await host.getByText(/1 connected/).waitFor({ timeout: 15000 });
  log("host sees display connected (RTDB presence → Firestore)");

  // ── Players join ──────────────────────────────────────────────────────
  const phones = [
    { name: "Juan", viewport: { width: 320, height: 640 } },
    { name: "Maria", viewport: { width: 375, height: 667 } },
    { name: "Pedro", viewport: { width: 390, height: 844 } },
  ];
  const players = [];
  for (const [i, p] of phones.entries()) {
    const page = await ctx({ viewport: p.viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    if (i === 0) {
      await page.goto(`${BASE}/play`);
      await page.getByLabel("Room code").fill(roomCode.toLowerCase());
    } else {
      await page.goto(`${BASE}/play/${roomCode}`);
    }
    await page.getByLabel("Nickname").fill(p.name);
    await page.getByRole("radio").nth(i + 2).click();
    if (i === 0) await shot(page, "11-player-join-320");
    await page.getByRole("button", { name: "Join the party" }).click();
    await page.getByText(`Hi, ${p.name}!`).waitFor();
    players.push(page);
  }
  await shot(players[0], "12-player-waiting-320");
  await shot(players[1], "13-player-waiting-375");
  log("3 players joined");

  // Duplicate nickname is rejected.
  const dup = await ctx({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  await dup.goto(`${BASE}/play/${roomCode}`);
  await dup.getByLabel("Nickname").fill("maria");
  await dup.getByRole("button", { name: "Join the party" }).click();
  await dup.getByText(/already has that nickname/).waitFor();
  log("duplicate nickname rejected");
  await dup.getByLabel("Nickname").fill("Ana");
  await dup.getByRole("button", { name: "Join the party" }).click();
  await dup.getByText("Hi, Ana!").waitFor();

  await tv.getByText("Pedro").waitFor();
  await tv.waitForTimeout(800);
  await host.getByText("4 online").waitFor({ timeout: 15000 });
  await shot(tv, "14-display-lobby");
  await shot(host, "15-host-lobby-players");
  log("display + host see players online");

  // Kick a player.
  await host.getByRole("button", { name: "Remove Ana" }).click();
  await host.getByRole("button", { name: "Remove player" }).click();
  await dup.getByText("You were removed").waitFor();
  await dup.reload();
  await dup.getByText("You were removed").waitFor();
  log("kicked player is locked out, even after reload");

  // Reconnect: reload a player; they keep their session without re-joining.
  await players[1].reload();
  await players[1].getByText("Hi, Maria!").waitFor();
  log("player reconnects after refresh");

  // ── Host refresh keeps host privileges ───────────────────────────────
  await host.reload();
  await host.getByText("Tournament lineup").waitFor();
  log("host reconnects after refresh");

  // ── Start game ───────────────────────────────────────────────────────
  await host.getByRole("button", { name: "Start tournament" }).first().click();
  await tv.getByRole("heading", { level: 1, name: "Speed Quiz" }).waitFor();
  await players[0].getByText(/Starting in/).waitFor();
  await tv.waitForTimeout(1200);
  await shot(tv, "16-display-game-intro");
  await shot(players[0], "17-player-get-ready");
  await host.getByText("How to play").first().waitFor();
  await shot(host, "18-host-playing");
  log("game started on all devices");

  await host.getByRole("button", { name: "End game" }).first().click();
  await tv.getByText("Overall leaderboard").waitFor();
  await tv.waitForTimeout(2200);
  await players[0].getByText("Leaderboard").first().waitFor();
  await shot(tv, "19-display-leaderboard");
  await shot(players[0], "20-player-leaderboard");
  log("leaderboard between games");

  // Play remaining two games → champion.
  for (let g = 2; g <= 3; g++) {
    await host.getByRole("button", { name: `Start game ${g} of 3` }).first().click();
    await tv.getByRole("heading", { level: 1, name: g === 2 ? "Guess the Majority" : "Reflex Battle" }).waitFor();
    await host.getByRole("button", { name: "End game" }).first().click();
  }
  await tv.getByText("Champion!").waitFor();
  await tv.waitForTimeout(2500);
  await host.getByText("Tournament complete!").first().waitFor();
  await shot(tv, "21-display-champion");
  await shot(host, "22-host-finished");
  log("tournament finished → champion screen");

  // ── Tablet portrait host + phone host sanity shots ────────────────────
  const hostPhone = await ctx({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await hostPhone.goto(`${BASE}/host`);
  await hostPhone.getByLabel("Room name").fill("Phone Host");
  await hostPhone.getByRole("button", { name: "Continue" }).click();
  await hostPhone.getByRole("button", { name: /Freestyle Mode/ }).click();
  await hostPhone.waitForURL(/\/games$/);
  await shot(hostPhone, "23-host-phone-games");
  await hostPhone.getByRole("button", { name: "Select Reflex Battle" }).click();
  await hostPhone.getByRole("button", { name: "Play Reflex Battle" }).click();
  await hostPhone.getByText("Selected game").waitFor();
  await shot(hostPhone, "24-host-phone-lobby-freestyle");
  log("freestyle flow on phone-sized host");

  const tabletPortrait = await ctx({ viewport: { width: 768, height: 1024 }, hasTouch: true });
  await tabletPortrait.goto(`${BASE}/display`);
  await shot(tabletPortrait, "25-display-pair-tablet-portrait");

  // Ending the session closes the room for everyone.
  await hostPhone.getByRole("button", { name: /End session/ }).click();
  await hostPhone.getByRole("button", { name: "End session" }).last().click();
  await hostPhone.waitForURL(BASE + "/");
  log("host ended session");

  if (errors.length) {
    console.log("\nBrowser errors:\n" + [...new Set(errors)].join("\n"));
  }
  console.log("\nALL FLOWS PASSED");
} catch (err) {
  console.error("\nFLOW FAILED:", err);
  for (const [i, p] of allPages.entries()) await p.screenshot({ path: `${SHOTS}/fail-${i}.png` }).catch(() => {});
  if (errors.length) console.log("\nBrowser errors:\n" + [...new Set(errors)].join("\n"));
  process.exitCode = 1;
} finally {
  await browser.close();
}
