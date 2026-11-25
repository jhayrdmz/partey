/**
 * The Impostor E2E: options, private roles, clue turns (typed, said aloud, secret-word guard),
 * a tied vote → revote → outcome, then a replay where the host reveals on a tie.
 * Host, TV and four phones (emulators + vite running).
 *   node tests/e2e/impostor.mjs [baseUrl] [screenshotDir]
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.argv[2] ?? "http://127.0.0.1:5173";
const OUT = process.argv[3] ?? "screenshots/impostor";
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

await tv.goto(`${BASE}/display`); await tv.getByLabel(/^Pairing code /).waitFor({ timeout: 30000 });
const pair = (await tv.getByLabel(/^Pairing code /).getAttribute("aria-label")).replace("Pairing code ", "").replace(/ /g, "");
await host.goto(`${BASE}/host`); await host.getByLabel("Room name").fill("Impostor night");
await host.getByRole("button", { name: "Continue" }).click(); await host.waitForURL(/\/mode$/, { timeout: 30000 });
const roomId = host.url().split("/host/")[1].split("/")[0];
await host.getByRole("button", { name: /Freestyle Mode/ }).click(); await host.waitForURL(/\/games$/);
await host.getByRole("button", { name: /The Impostor/ }).first().click();
await host.getByRole("button", { name: /Play The Impostor/ }).first().click();
await host.waitForURL(new RegExp(`/host/${roomId}$`));
await host.getByRole("button", { name: "Connect a display" }).click();
await host.getByLabel("Code shown on the display").fill(pair);
await tv.waitForURL(new RegExp(`/display/${roomId}$`), { timeout: 30000 }); await host.keyboard.press("Escape");

// Options
await host.getByText("Random · 1 impostor · 1 clue round · max 12 players").waitFor({ timeout: 10000 });
expect(true, "lobby shows default options");
await host.getByRole("button", { name: "The Impostor options" }).click();
const dlg = host.getByRole("dialog");
await dlg.getByRole("radio", { name: "Food" }).click();
await dlg.getByRole("button", { name: "Impostors: increase" }).click();
await shot(host, "1-options");
await dlg.getByRole("button", { name: "Impostors: decrease" }).click();
await dlg.getByRole("button", { name: "Save options" }).click();
await dlg.waitFor({ state: "hidden" });
await host.getByText("Food · 1 impostor · 1 clue round · max 12 players").waitFor({ timeout: 10000 });
expect(true, "options saved (Food)");

await host.getByRole("button", { name: "Show room code" }).click();
const code = (await host.getByRole("dialog").getByLabel(/^Room code /).first().getAttribute("aria-label")).replace("Room code ", "").replace(/ /g, "");
await host.keyboard.press("Escape");
for (const [i, p] of players.entries()) { await p.goto(`${BASE}/play/${code}`); await p.getByLabel("Nickname").fill(NAMES[i]); await p.getByRole("button", { name: "Join the party" }).click(); }
await host.getByText("4/12").waitFor({ timeout: 20000 });

async function playGame(label) {
  await host.getByRole("button", { name: /Start|Replay/ }).last().click();
  await tv.getByText("Check your phones").waitFor({ timeout: 20000 });
  // Private roles
  const roles = {};
  let word = null;
  for (const n of NAMES) {
    const p = byName[n];
    await p.getByText("Your secret role").waitFor({ timeout: 15000 });
    expect((await p.getByText("You are the Impostor!").count()) === 0, `[${label}] ${n}: role hidden until tapped`);
    await p.getByText("Your secret role").click();
    await p.getByText(/You are the Impostor!|Secret word ·/).first().waitFor({ timeout: 10000 });
    if (await p.getByText("You are the Impostor!").isVisible().catch(() => false)) roles[n] = "impostor";
    else {
      roles[n] = "crew";
      const w = (await p.locator("p.text-3xl.font-black").first().innerText()).trim();
      if (word && w !== word) throw new Error("crew words differ");
      word = w;
    }
    if (label === "game1" && n === "Ana") await shot(p, `2-role-${roles[n]}`);
    await p.getByRole("button", { name: "Hide my role" }).click();
    await p.getByText("Your secret role").waitFor();
  }
  const impostors = NAMES.filter((n) => roles[n] === "impostor");
  expect(impostors.length === 1, `[${label}] exactly one impostor (${impostors[0]}), crew word "${word}"`);
  const tvText = () => tv.locator("body").innerText();
  expect(!(await tvText()).toLowerCase().includes(word.toLowerCase()), `[${label}] secret word not on the display`);

  await host.getByRole("button", { name: "Start clues" }).click();
  for (let t = 0; t < 4; t++) {
    await tv.getByText("your clue! 🎤").waitFor({ timeout: 20000 });
    let turnName = null;
    for (const n of NAMES) if (await byName[n].getByText("Your turn!").isVisible().catch(() => false)) turnName = n;
    if (!turnName) { await tv.waitForTimeout(800); for (const n of NAMES) if (await byName[n].getByText("Your turn!").isVisible().catch(() => false)) turnName = n; }
    expect(Boolean(turnName), `[${label}] turn ${t + 1}: ${turnName}'s phone asks for a clue`);
    if (t === 0) expect(roles[turnName] === "crew", `[${label}] first turn is never the impostor`);
    const others = NAMES.filter((n) => n !== turnName);
    expect(await byName[others[0]].getByText(`${turnName} is giving a clue`).isVisible(), `[${label}] others see who's talking`);
    if (label === "game1" && t === 0) { await shot(tv, "3-display-turn"); await shot(byName[others[0]], "4-phone-listening"); }
    const p = byName[turnName];
    if (t === 1 && roles[turnName] === "crew") {
      await p.getByLabel("Your one-word clue").fill(word.split(" ")[0]);
      await p.getByRole("button", { name: "Send clue" }).click();
      await p.getByText("That's the secret word!").first().waitFor({ timeout: 10000 });
      expect(true, `[${label}] crew can't type the secret word`);
      await p.getByRole("button", { name: "Send clue" }).waitFor({ timeout: 5000 });
      expect(true, `[${label}] after the rejection the phone lets them try again`);
    }
    if (t === 2) {
      await host.getByRole("button", { name: "Next turn" }).click(); // said it aloud, didn't type
    } else {
      await p.getByLabel("Your one-word clue").fill(`clue${t}`);
      if (label === "game1" && t === 0) await shot(p, "5-phone-your-turn");
      await p.getByRole("button", { name: "Send clue" }).click();
    }
    await tv.getByText(t === 2 ? "🗣️ said it out loud" : `“clue${t}”`).first().waitFor({ timeout: 15000 });
    if (label === "game1" && t === 0) await shot(tv, "6-display-clue");
  }
  expect(true, `[${label}] all 4 clue turns done`);

  // Vote 1: force a tie between two players
  await tv.getByText("Who's the impostor?").waitFor({ timeout: 20000 });
  expect(await host.getByRole("button", { name: "Skip round" }).isDisabled(), `[${label}] the vote can't be skipped`);
  const [A, B, C, D] = NAMES;
  const vote = async (who, target) => {
    const p = byName[who];
    await p.getByRole("radio", { name: new RegExp(target) }).click();
    await p.getByRole("button", { name: `Vote for ${target}` }).click();
    await p.getByText("Vote locked in!").waitFor({ timeout: 10000 });
  };
  expect((await byName[A].getByRole("radio", { name: new RegExp(`^${A}$`) }).count()) === 0, `[${label}] you can't vote for yourself (not on your ballot)`);
  if (label === "game1") await shot(byName[A], "7-phone-vote");
  await vote(A, B); await vote(B, A); await vote(C, A); await vote(D, B);
  await tv.getByText("It's a tie!").waitFor({ timeout: 15000 });
  expect(true, `[${label}] 2–2 tie detected`);
  if (label === "game1") await shot(tv, "8-display-tie");
  await host.getByRole("button", { name: "Revote" }).waitFor();
  expect(await host.getByRole("button", { name: "Reveal" }).isVisible(), `[${label}] host gets Revote and Reveal`);
  await host.waitForTimeout(5000);
  expect(await tv.getByText("It's a tie!").isVisible(), `[${label}] tie screen waits for the host (no timer)`);

  if (label === "game1") {
    await host.getByRole("button", { name: "Revote" }).click();
    await tv.getByText("Revote!").first().waitFor({ timeout: 15000 });
    const ballot = await byName[C].getByRole("radio").allInnerTexts();
    expect(ballot.length === 2 && ballot.some((t) => t.includes(A)) && ballot.some((t) => t.includes(B)), `[${label}] revote ballot only has the tied players`);
    // everyone (who can) votes A; A votes B
    await vote(B, A); await vote(C, A); await vote(D, A); await vote(A, B);
    const crewWins = roles[A] === "impostor";
    await tv.getByText(crewWins ? "Crew wins! 🎉" : "Impostor wins! 😈").waitFor({ timeout: 15000 });
    expect(true, `[${label}] outcome: ${A} accused, ${crewWins ? "crew" : "impostor"} wins`);
    await tv.waitForTimeout(2500);
    expect((await tvText()).includes(word), `[${label}] the secret word is revealed at the end`);
    await shot(tv, "9-display-outcome");
    for (const n of NAMES) {
      const won = roles[n] === "impostor" ? !crewWins : crewWins;
      await byName[n].getByText(won ? "You win!" : "You lose!").waitFor({ timeout: 10000 });
    }
    expect(true, `[${label}] each phone shows the right win/lose`);
    await shot(byName[impostors[0]], "10-phone-outcome-impostor");
  } else {
    await host.getByRole("button", { name: "Reveal" }).click();
    await tv.getByText("Impostor wins! 😈").waitFor({ timeout: 15000 });
    expect(true, `[${label}] Reveal on a tie: impostor wins`);
  }
  await host.getByRole("button", { name: /Show results/ }).click().catch(() => undefined);
  await tv.getByText(/The Impostor results/).waitFor({ timeout: 30000 });
  expect(true, `[${label}] game ends on the results screen`);
}

await playGame("game1");
await shot(tv, "11-display-results");
await host.getByRole("button", { name: /Replay/ }).waitFor({ timeout: 15000 });
expect(true, "play again: Replay offered");
await playGame("game2");

await host.getByRole("button", { name: "End session" }).click();
await host.getByRole("button", { name: /End session/ }).last().click();
await host.waitForURL(`${BASE}/`, { timeout: 30000 });
console.log("\nIMPOSTOR PASSED");
await b.close();
