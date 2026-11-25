/**
 * The Impostor custom word E2E: dialog rules (real category, masked field, server validation),
 * host-only storage (reloads for the host, never on phones or the display), crew sees it and the
 * impostor doesn't, the crew can't use it as a clue, and it's single-use.
 * Host, TV and three phones (emulators + vite running).
 *   node tests/e2e/impostor-custom-word.mjs [baseUrl] [screenshotDir]
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.argv[2] ?? "http://127.0.0.1:5173";
const OUT = process.argv[3] ?? "screenshots/impostor-custom-word";
fs.mkdirSync(OUT, { recursive: true });
const NAMES = ["Ana", "Ben", "Cy"];
const WORD = "Jollibee";
const log = (...a) => console.log("•", ...a);
const expect = (c, m) => { if (!c) throw new Error("FAILED: " + m); log("ok:", m); };
const b = await chromium.launch();
const phone = () => b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }).then((c) => c.newPage());
const tv = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const host = await phone();
const players = await Promise.all(NAMES.map(() => phone()));
const byName = Object.fromEntries(NAMES.map((n, i) => [n, players[i]]));
const text = (p) => p.locator("body").innerText();

await tv.goto(`${BASE}/display`); await tv.getByLabel(/^Pairing code /).waitFor({ timeout: 30000 });
const pair = (await tv.getByLabel(/^Pairing code /).getAttribute("aria-label")).replace("Pairing code ", "").replace(/ /g, "");
await host.goto(`${BASE}/host`); await host.getByLabel("Room name").fill("Custom word");
await host.getByRole("button", { name: "Continue" }).click(); await host.waitForURL(/\/mode$/, { timeout: 30000 });
const roomId = host.url().split("/host/")[1].split("/")[0];
await host.getByRole("button", { name: /Freestyle Mode/ }).click(); await host.waitForURL(/\/games$/);
await host.getByRole("button", { name: /The Impostor/ }).first().click();
await host.getByRole("button", { name: /Play The Impostor/ }).first().click();
await host.waitForURL(new RegExp(`/host/${roomId}$`));
await host.getByRole("button", { name: "Connect a display" }).click();
await host.getByLabel("Code shown on the display").fill(pair);
await tv.waitForURL(new RegExp(`/display/${roomId}$`), { timeout: 30000 }); await host.keyboard.press("Escape");
await host.getByRole("button", { name: "Show room code" }).click();
const code = (await host.getByRole("dialog").getByLabel(/^Room code /).first().getAttribute("aria-label")).replace("Room code ", "").replace(/ /g, "");
await host.keyboard.press("Escape");
for (const [i, p] of players.entries()) { await p.goto(`${BASE}/play/${code}`); await p.getByLabel("Nickname").fill(NAMES[i]); await p.getByRole("button", { name: "Join the party" }).click(); }
await host.getByText("3/12").waitFor({ timeout: 20000 });

// Dialog rules
await host.getByRole("button", { name: "The Impostor options" }).click();
let dlg = host.getByRole("dialog");
await dlg.getByRole("radio", { name: "Custom word" }).click();
expect(await dlg.getByRole("radio", { name: "Random", exact: true }).isDisabled(), "custom word: Random category is disabled");
expect(await dlg.getByRole("button", { name: "Save options" }).isDisabled(), "Save disabled until a word and a real category are set");
const field = dlg.getByLabel("Custom word", { exact: true });
expect((await field.getAttribute("type")) === "password", "the word is masked while typing (someone may be looking)");
await field.fill("Pizza!");
await dlg.getByRole("radio", { name: "Food" }).click();
await dlg.getByRole("button", { name: "Save options" }).click();
await host.getByText(/letters and numbers only/i).first().waitFor({ timeout: 10000 });
expect(true, "server rejects punctuation in the word");
const toast = await host.getByText(/letters and numbers only/i).first().innerText();
expect(!/\[\d{3}\]/.test(toast), `error toast has no status code ("${toast}")`);
await field.fill(WORD);
await dlg.getByRole("button", { name: "Show word" }).click();
expect((await field.getAttribute("type")) === "text", "eye button shows the word");
await host.screenshot({ path: `${OUT}/1-dialog.png` });
await dlg.getByRole("button", { name: "Save options" }).click();
await dlg.waitFor({ state: "hidden" });
await host.getByText(/Custom word \(Food\)/).waitFor({ timeout: 10000 });
expect(true, "lobby summary says Custom word (Food), not the word");
expect(!(await text(host)).includes(WORD), "the word isn't shown in the lobby");
for (const n of NAMES) expect(!(await text(byName[n])).includes(WORD), `${n}'s phone doesn't have the word before the game`);
expect(!(await text(tv)).includes(WORD), "the display doesn't have it either");

// Reopen: the saved word loads from the host-only doc
await host.getByRole("button", { name: "The Impostor options" }).click();
dlg = host.getByRole("dialog");
await host.waitForFunction((w) => document.querySelector("#imp-custom-word")?.value === w, WORD, { timeout: 10000 });
expect(true, "reopening the options loads the saved word (host can read it)");
await dlg.getByRole("button", { name: "Cancel" }).click();

// Game: crew get the custom word, impostor doesn't
await host.getByRole("button", { name: /Start/ }).last().click();
await tv.getByText("Check your phones").waitFor({ timeout: 20000 });
const roles = {};
for (const n of NAMES) {
  const p = byName[n];
  await p.getByText("Your secret role").click();
  await p.getByText(/You are the Impostor!|Secret word ·/).first().waitFor({ timeout: 10000 });
  roles[n] = (await p.getByText("You are the Impostor!").isVisible()) ? "impostor" : "crew";
  const t = (await text(p)).toLowerCase(); // innerText applies the label's uppercase styling
  if (roles[n] === "crew") expect(t.includes(WORD.toLowerCase()) && t.includes("secret word · food"), `${n} (crew) sees "${WORD}" in Food`);
  else expect(!t.includes(WORD.toLowerCase()) && t.includes("food"), `${n} (impostor) sees only the category`);
  if (n === "Ana") await p.screenshot({ path: `${OUT}/2-role-${roles[n]}.png` });
  await p.getByRole("button", { name: "Hide my role" }).click();
}
expect(!(await text(tv)).includes(WORD), "display never shows the word during the game");

// Crew can't use the custom word as a clue
await host.getByRole("button", { name: "Start clues" }).click();
await tv.getByText("your clue! 🎤").waitFor({ timeout: 20000 });
await tv.waitForTimeout(800);
let turn = null;
for (const n of NAMES) if (await byName[n].getByText("Your turn!").isVisible().catch(() => false)) turn = n;
expect(roles[turn] === "crew", `first turn (${turn}) is crew`);
await byName[turn].getByLabel("Your one-word clue").fill(WORD.toLowerCase());
await byName[turn].getByRole("button", { name: "Send clue" }).click();
await byName[turn].getByText("That's the secret word!").first().waitFor({ timeout: 10000 });
expect(true, "crew can't type the custom word as a clue");

// End → single use: back to random words
await host.getByRole("button", { name: "End", exact: true }).click();
await host.getByRole("dialog").getByRole("button", { name: "End game" }).click();
await tv.getByText(/The Impostor results/).waitFor({ timeout: 30000 });
await host.getByText(/^Food · 1 impostor/).waitFor({ timeout: 15000 });
expect(true, "after the game the lobby is back to a random Food word");
await host.getByRole("button", { name: "The Impostor options" }).click();
dlg = host.getByRole("dialog");
expect((await dlg.getByRole("radio", { name: "Random word" }).getAttribute("aria-checked")) === "true", "options show Random word again (custom word was single-use)");
await dlg.getByRole("button", { name: "Cancel" }).click();

await host.getByRole("button", { name: "End session" }).click();
await host.getByRole("button", { name: /End session/ }).last().click();
await host.waitForURL(`${BASE}/`, { timeout: 30000 });
console.log("\nIMPOSTOR CUSTOM WORD PASSED");
await b.close();
