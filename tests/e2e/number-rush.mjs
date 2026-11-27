/**
 * Number Rush E2E (emulators + vite running): options, the current number on TV and phone with the next
 * one kept secret, HIGHER / LOWER on the phone (one pick, locked), server checks (junk, duplicates), the
 * rolling reveal with its direction, scoring with streak multipliers (10, 13, 13, 15, 15, 20…), streaks
 * reset by a wrong or missed call, the phone's milestone message, the TV leaderboard re-sorting, and
 * final results with best streaks and tied players sharing 1st.
 * Host + TV + 2 phone browsers (Ana, Ben) + 3 API players (Cy, Dee, Eve).
 *   node tests/e2e/number-rush.mjs [baseUrl] [screenshotDir]
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.argv[2] ?? "http://127.0.0.1:5173";
const OUT = process.argv[3] ?? "screenshots/number-rush";
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
  const numbers = (f.setup?.mapValue?.fields?.numbers?.arrayValue?.values ?? []).map(num);
  return { round: num(f.round), phase: f.phase.stringValue, scores, numbers, current: num(f.roundPublic?.mapValue?.fields?.current) };
};
const displayGame = async (roomId) => (await req(`${FS}/rooms/${roomId}/displayState/current`, { headers: owner })).body.fields.game.mapValue.fields;
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
await host.goto(`${BASE}/host`); await host.getByLabel("Room name").fill("Rush night");
await host.getByRole("button", { name: "Continue" }).click(); await host.waitForURL(/\/mode$/, { timeout: 30000 });
const roomId = host.url().split("/host/")[1].split("/")[0];
await host.getByRole("button", { name: /Freestyle Mode/ }).click(); await host.waitForURL(/\/games$/);
await host.getByRole("button", { name: /Number Rush/ }).first().click();
await host.getByRole("button", { name: /Play Number Rush/ }).first().click();
await host.waitForURL(new RegExp(`/host/${roomId}$`));
await host.getByText("10 rounds · 10s to predict · max 24 players").waitFor({ timeout: 10000 });
expect(true, "default options: 10 rounds, 10s, 24 players");
await host.getByRole("button", { name: "Number Rush options" }).click();
const dlg = host.getByRole("dialog");
await dlg.getByRole("radio", { name: "15s" }).click();
await shot(host, "1-options");
await dlg.getByRole("button", { name: "Save options" }).click();
await host.getByText("10 rounds · 15s to predict · max 24 players").waitFor({ timeout: 10000 });
expect(true, "options saved: 15s to predict");
await host.getByRole("button", { name: "Connect a display" }).click();
await host.getByLabel("Code shown on the display").fill(pair);
await tv.waitForURL(new RegExp(`/display/${roomId}$`), { timeout: 30000 }); await host.keyboard.press("Escape");
await host.getByRole("button", { name: "Show room code" }).click();
const code = (await host.getByRole("dialog").getByLabel(/^Room code /).first().getAttribute("aria-label")).replace("Room code ", "").replace(/ /g, "");
await host.keyboard.press("Escape");

// ── Players ─────────────────────────────────────────────────────────────
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
const pickApi = (n, round, choice) => callable("submitAnswer", api[n], { roomId, round, answer: { choice } });
const btn = (p, label) => p.getByRole("button", { name: label, exact: true });
const flip = (c) => (c === "higher" ? "lower" : "higher");
const label = (c) => (c === "higher" ? "Higher" : "Lower");

await host.getByRole("button", { name: /Start/ }).last().click();
await host.getByRole("button", { name: "Start round 1" }).waitFor({ timeout: 20000 });
for (const [p, name] of [[tv, "tv"], [ana, "phone"]]) {
  const h1 = p.getByRole("heading", { name: "Number Rush." });
  await h1.waitFor({ timeout: 15000 });
  const fits = await h1.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= window.innerWidth);
  expect(fits, `${name} rules screen: the title fits on one line, with the dot`);
  await shot(p, `0-${name}-rules`);
}
await host.getByRole("button", { name: "Start round 1" }).click();

// ── 10 rounds. Ben (phone) and Cy (API) always call it right; Ana: right, wrong, none, then right;
//    Dee always wrong; Eve never answers. ───────────────────────────────
const expected = { Ben: 0, Cy: 0, Ana: 0, Dee: 0, Eve: 0 };
const streakPts = [10, 13, 13, 15, 15, 20, 20, 20, 20, 20];
let anaStreak = 0;
const ids = {};
for (let round = 1; round <= 10; round++) {
  if (round > 1) await host.getByRole("button", { name: "Next round" }).click();
  await btn(ben, "Higher").waitFor({ timeout: 20000 });
  for (let i = 0; i < 50 && (await gameState(roomId)).round !== round; i++) await sleep(100);
  const g = await gameState(roomId);
  const cur = g.numbers[round - 1], next = g.numbers[round];
  const right = next > cur ? "higher" : "lower";
  expect(g.current === cur && next !== cur && next >= 100 && next <= 999, `round ${round}: ${cur} → ${next} (${right}), never the same number twice`);

  if (round === 1) {
    expect(g.numbers.length === 11, "the game draws all 11 numbers up front (server-only)");
    await tv.getByLabel(`Current number ${cur}`).waitFor({ timeout: 10000 });
    await ana.getByLabel(`Current number ${cur}`).waitFor({ timeout: 10000 });
    expect(true, "TV and phone show the current number");
    const keys = Object.keys((await displayGame(roomId)).round_data.mapValue.fields).sort().join(",");
    expect(keys === "current,onStreak", `the next number isn't in the public round data (${keys})`);
    await ana.getByLabel("Next right call is worth 10 points").waitFor();
    expect(true, "phone shows score, streak and 'Next +10'");
    await shot(tv, "2-tv-question"); await shot(ana, "2-phone-question");
    const junk = await pickApi("Dee", 1, "sideways");
    expect(!junk.ok && /HIGHER or LOWER/.test(junk.error?.message), "an invalid prediction is refused");
  }
  if (round === 2) {
    await ben.getByLabel("Next right call is worth 13 points").waitFor({ timeout: 5000 });
    await tv.getByRole("list", { name: "On a streak" }).getByText("Ben").waitFor({ timeout: 5000 });
    expect(true, "round 2: Ben's phone shows 'Next +13' and the TV lists Ben on a streak");
  }

  // Phones
  await btn(ben, label(right)).click();
  await ben.getByText(`${label(right)} locked in!`).waitFor({ timeout: 10000 });
  const anaPick = round === 2 ? flip(right) : round === 3 ? null : right;
  if (anaPick) { await btn(ana, label(anaPick)).click(); await ana.getByText(`${label(anaPick)} locked in!`).waitFor({ timeout: 10000 }); }
  if (round === 1) { expect(true, "a phone pick locks in"); await shot(ben, "3-phone-locked"); }
  // API
  expect((await pickApi("Cy", round, right)).result?.accepted === true, `round ${round}: Cy right`);
  expect((await pickApi("Dee", round, flip(right))).ok, `round ${round}: Dee wrong`);
  if (round === 1) expect((await pickApi("Cy", 1, flip(right))).result?.accepted === false, "a second pick is ignored");
  const locked = anaPick ? 4 : 3;
  await tv.getByTestId("locked-count").filter({ hasText: `${locked} / 5 locked in` }).waitFor({ timeout: 10000 });
  if (round === 1) { expect(true, "TV counts locked-in picks"); await shot(tv, "3-tv-locked"); }

  await host.getByRole("button", { name: "Reveal the number" }).click();
  await tv.getByLabel(String(next), { exact: true }).waitFor({ timeout: 15000 });
  await tv.locator(`[data-direction="${right}"]`).waitFor({ timeout: 5000 });
  expect(true, `round ${round}: TV rolls to ${next} and stamps ${right.toUpperCase()}`);

  const k = round - 1;
  expected.Ben += streakPts[k]; expected.Cy += streakPts[k];
  anaStreak = anaPick === right ? anaStreak + 1 : 0;
  if (anaStreak) expected.Ana += streakPts[anaStreak - 1];
  const sc = (await gameState(roomId)).scores;
  if (round === 1) { ids.Cy = api.Cy.localId; ids.Dee = api.Dee.localId; ids.Eve = api.Eve.localId; }
  expect(sc[ids.Cy] === expected.Cy && sc[ids.Dee] === 0 && sc[ids.Eve] === 0, `round ${round}: Cy ${expected.Cy} (+${streakPts[k]}), Dee 0, Eve 0`);

  // Phones
  await ben.getByText("Nice call!").waitFor({ timeout: 10000 });
  if ([2, 4, 6].includes(round)) {
    const mult = { 2: "1.25", 4: "1.5", 6: "2" }[round];
    await ben.getByTestId("milestone").filter({ hasText: `${mult}x multiplier unlocked!` }).waitFor({ timeout: 5000 });
    expect(true, `round ${round}: Ben's phone celebrates ${mult}x`);
    await shot(ben, `4-phone-milestone-${mult}x`);
  }
  if (round === 2) { await ana.getByText("Wrong way!").waitFor({ timeout: 10000 }); await ana.getByText("Streak reset.").waitFor(); expect(true, "round 2: Ana 'Wrong way!', streak reset"); await shot(ana, "4-phone-wrong"); }
  if (round === 3) { await ana.getByText("No prediction").first().waitFor({ timeout: 10000 }); expect(true, "round 3: Ana missed, streak reset"); }

  if (round === 1 || round === 6) {
    await tv.locator('[aria-label="Leaderboard"][data-sorted="true"]').waitFor({ timeout: 8000 });
    await sleep(800);
    await shot(tv, `5-tv-reveal-r${round}`);
    if (round === 6) {
      const cyTile = tv.locator('[data-player="Cy"]');
      expect((await cyTile.getAttribute("data-correct")) === "true" && (await cyTile.innerText()).includes("+20"), "round 6: TV shows Cy +20 with the 2x streak");
    }
  }
}

// ── Final ───────────────────────────────────────────────────────────────
const fin = (await gameState(roomId)).scores;
expect(fin[ids.Cy] === 166 && expected.Cy === 166, `Cy's total: 166 (10+13+13+15+15+20×5)`);
await host.getByRole("button", { name: "Show results" }).click();
await tv.getByText(/results/i).first().waitFor({ timeout: 20000 });
await tv.waitForTimeout(3000);
const finalText = await tv.locator("body").innerText();
expect(finalText.includes("Best streak: 10") && finalText.includes("Best streak: 0"), "final results show best streaks");
const places = await tv.locator("[data-place]").evaluateAll((els) => els.map((el) => Number(el.dataset.place)).sort());
expect(places[0] === 1 && places[1] === 1, `Ben and Cy tie on 166 and share 1st (${places.join(",")})`);
await shot(tv, "6-tv-final");
await shot(ben, "6-phone-final");
await host.getByRole("button", { name: /Replay/ }).waitFor({ timeout: 15000 });
expect(true, "host can play again");

await b.close();
