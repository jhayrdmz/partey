/**
 * The Author E2E (emulators + vite running): options, secret writing on phones (answers never in the
 * public data), the count on the TV, lock answers, anonymous answer cards with no author anywhere public,
 * the author's phone ("That's yours!") and no self-guessing, picking + locking a guess, server checks
 * (self, not a writer, duplicates), the reveal (most guessed → author → points), 100 + 50-per-streak
 * scoring with streaks carrying across questions, the awards, and final results with base / bonus.
 * Host + TV + 2 phone browsers (Ana, Ben) + 2 API players (Cy, Dee).
 *   node tests/e2e/the-author.mjs [baseUrl] [screenshotDir]
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.argv[2] ?? "http://127.0.0.1:5173";
const OUT = process.argv[3] ?? "screenshots/the-author";
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
  return { round: num(f.round), total: num(f.totalRounds), phase: f.phase.stringValue, scores, kind: pub?.kind?.stringValue, author: f.roundSecret?.mapValue?.fields?.author?.stringValue };
};
const displayRaw = async (roomId) => JSON.stringify((await req(`${FS}/rooms/${roomId}/displayState/current`, { headers: owner })).body.fields.game);
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
const waitFor = async (fn, what, ms = 15000) => { const until = Date.now() + ms; while (Date.now() < until) { if (await fn()) return; await sleep(150); } throw new Error(`timed out: ${what}`); };

// ── Room, options, display ──────────────────────────────────────────────
await tv.goto(`${BASE}/display`); await tv.getByLabel(/^Pairing code /).waitFor({ timeout: 30000 });
const pair = (await tv.getByLabel(/^Pairing code /).getAttribute("aria-label")).replace("Pairing code ", "").replace(/ /g, "");
await host.goto(`${BASE}/host`); await host.getByLabel("Room name").fill("Author night");
await host.getByRole("button", { name: "Continue" }).click(); await host.waitForURL(/\/mode$/, { timeout: 30000 });
const roomId = host.url().split("/host/")[1].split("/")[0];
await host.getByRole("button", { name: /Freestyle Mode/ }).click(); await host.waitForURL(/\/games$/);
await host.getByRole("button", { name: /The Author/ }).first().click();
await host.getByRole("button", { name: /Play The Author/ }).first().click();
await host.waitForURL(new RegExp(`/host/${roomId}$`));
await host.getByText("3 rounds · Random · 60s to write · 20s to guess · max 16 players").waitFor({ timeout: 10000 });
expect(true, "default options: 3 rounds, Random, 60s / 20s, 16 players");
await host.getByRole("button", { name: "The Author options" }).click();
const dlg = host.getByRole("dialog");
await dlg.getByRole("radiogroup", { name: "Rounds" }).getByRole("radio", { name: "2" }).click();
await dlg.getByRole("radio", { name: "Funny" }).click();
await dlg.getByRole("radio", { name: "Relationships" }).scrollIntoViewIfNeeded(); await shot(host, "1-options");
await dlg.getByRole("button", { name: "Save options" }).click();
await host.getByText("2 rounds · Funny · 60s to write · 20s to guess · max 16 players").waitFor({ timeout: 10000 });
expect(true, "options saved: 2 rounds, Funny");
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
for (const [n, avatar] of [["Cy", "jeep"], ["Dee", "fish"]]) {
  api[n] = await signUp();
  expect((await callable("joinRoom", api[n], { roomCode: code, nickname: n, avatar })).ok, `${n} joins (API)`);
}
const send = (n, round, answer) => callable("submitAnswer", api[n], { roomId, round, answer });
const idOf = {};
const phones = { Ana: ana, Ben: ben };

await host.getByRole("button", { name: /Start/ }).last().click();
await host.getByRole("button", { name: "Start question 1" }).waitFor({ timeout: 20000 });
for (const [p, name] of [[tv, "tv"], [ana, "phone"]]) {
  const h1 = p.getByRole("heading", { name: "The Author." });
  await h1.waitFor({ timeout: 15000 });
  const fits = await h1.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= window.innerWidth);
  expect(fits, `${name} rules screen: the title fits on one line, with the dot`);
  await shot(p, `0-${name}-rules`);
}
await host.getByRole("button", { name: "Start question 1" }).click();

/** One question: who writes what (phones type, API sends), then guess every answer. */
async function playQuestion(q, writers) {
  await waitFor(async () => (await gameState(roomId)).kind === "write", `question ${q} writing`);
  const w = await gameState(roomId);
  await tv.getByTestId("submitted-count").waitFor({ timeout: 10000 });
  for (const [n, text] of Object.entries(writers)) {
    if (phones[n]) {
      await phones[n].getByLabel("Your answer (anonymous)").fill(text);
      await phones[n].getByRole("button", { name: "Submit answer" }).click();
      await phones[n].getByText("Answer locked in!").waitFor({ timeout: 10000 });
    } else expect((await send(n, w.round, { text })).result?.accepted === true, `${n} writes (API)`);
  }
  const count = Object.keys(writers).length;
  await tv.getByTestId("submitted-count").filter({ hasText: `${count} / 4 answered` }).waitFor({ timeout: 10000 });
  const raw = await displayRaw(roomId);
  expect(Object.values(writers).every((t) => !raw.includes(t)), `Q${q}: ${count} / 4 answered on the TV; no answer is in the public data while writing`);
  if (q === 1) {
    const empty = await send("Dee", w.round, { text: "   " });
    expect(!empty.ok && /Write an answer/.test(empty.error?.message), "an empty answer is refused");
    await shot(tv, "2-tv-write"); await shot(ana, "2-phone-write"); await shot(ben, "2-phone-written");
  }
  await host.getByRole("button", { name: "Lock answers" }).click();
  await tv.getByTestId("collected").filter({ hasText: `${count} answers are in!` }).waitFor({ timeout: 10000 });
  expect(true, `Q${q}: "${count} answers are in!"`);
  if (q === 1) { await sleep(1500); await shot(tv, "3-tv-collected"); }
  await host.getByRole("button", { name: "Start guessing" }).click();

  for (let i = 1; i <= count; i++) {
    await waitFor(async () => { const g = await gameState(roomId); return g.kind === "guess" && g.phase === "question" && g.round === w.round + i; }, `Q${q} answer ${i}`);
    const g = await gameState(roomId);
    const authorName = Object.entries(idOf).find(([, id]) => id === g.author)?.[0];
    const text = writers[authorName];
    await tv.getByTestId("answer-card").filter({ hasText: text }).waitFor({ timeout: 10000 });
    const raw2 = await displayRaw(roomId);
    const pubAuthorLeak = raw2.includes(`"author"`) || raw2.includes(`"secret"`);
    expect(!pubAuthorLeak, `Q${q} #${i}: the TV shows "${text}" and nothing public names its author (${authorName})`);
    // The author's phone; the others guess.
    for (const [n, p] of Object.entries(phones)) {
      if (n === authorName) {
        await p.getByText("That's yours! 🤫").waitFor({ timeout: 10000 });
        if (q === 1 && i === 1) await shot(p, "4-phone-yours");
        continue;
      }
      const target = n === "Ana" ? authorName : Object.keys(writers).find((x) => x !== n && x !== authorName) ?? authorName;
      await p.getByRole("radio", { name: target }).click();
      if (q === 1 && i === 1) await shot(p, "4-phone-guess");
      await p.getByRole("button", { name: "Lock in guess" }).click();
      await p.getByText("Guess locked in!").waitFor({ timeout: 10000 });
    }
    if (authorName !== "Dee") expect((await send("Dee", g.round, { author: g.author })).result?.accepted === true, `Dee guesses ${authorName} (right)`);
    if (authorName !== "Cy") {
      if (q === 1 && i === 1) {
        const self = await send("Cy", g.round, { author: idOf.Cy });
        expect(!self.ok && /can't pick yourself/.test(self.error?.message), "nobody can pick themselves");
        const nonWriter = await send("Cy", g.round, { author: idOf.Dee });
        expect(!nonWriter.ok && /from the list/.test(nonWriter.error?.message), "only people who wrote an answer can be picked");
      }
      const wrong = Object.keys(writers).find((x) => x !== "Cy" && x !== authorName);
      if (wrong) expect((await send("Cy", g.round, { author: idOf[wrong] })).ok, `Cy guesses ${wrong} (wrong)`);
      else await host.getByRole("button", { name: "Reveal the author" }).click();
      // Ignored, or refused if that guess closed the round: either way it never counts.
      if (q === 1 && i === 1 && wrong) expect((await send("Cy", g.round, { author: g.author })).result?.accepted !== true, "a second guess never counts");
    }
    // Everyone who could guess has: the round closes itself.
    await tv.getByTestId("most-guessed").waitFor({ timeout: 10000 });
    if (q === 1 && i === 1) await shot(tv, "5-tv-most-guessed");
    await tv.getByTestId("author").filter({ hasText: authorName }).waitFor({ timeout: 8000 });
    expect(true, `Q${q} #${i}: most guessed, then "Written by ${authorName}"`);
    await tv.locator('[aria-label="Guesses"][data-shown="true"]').waitFor({ timeout: 8000 });
    if (q === 1 && i === 1) { await sleep(900); await shot(tv, "6-tv-author"); }
    if (phones[authorName]) await phones[authorName].getByTestId("fooled").waitFor({ timeout: 8000 });
    if (q === 1 && i <= 2) for (const [n, p] of Object.entries(phones)) await shot(p, `7-phone-result-${q}-${i}-${n}`);
    const isLast = q === 2 && i === count;
    if (!isLast) await host.getByRole("button", { name: "Next", exact: true }).click();
  }
}

// Ids (the API players know theirs; phones' from the room's players).
idOf.Cy = api.Cy.localId; idOf.Dee = api.Dee.localId;
const playersList = (await req(`${FS}/rooms/${roomId}/players?pageSize=50`, { headers: owner })).body.documents;
for (const d of playersList) { const n = d.fields.nickname.stringValue; if (n === "Ana" || n === "Ben") idOf[n] = d.name.split("/").pop(); }

await playQuestion(1, { Ana: "I once fell asleep at my own surprise party", Ben: "I sold ice to a penguin, no regrets", Cy: "I can whistle with my nose" });
const s1 = (await gameState(roomId)).scores;
expect(s1[idOf.Dee] === 100 + 150 + 200, `after Q1: Dee 450 (100 + 150 + 200, a 3-guess streak)`);

await playQuestion(2, { Ana: "Ate cereal with orange juice", Dee: "I talk to my plants in accents" });
const fin = (await gameState(roomId)).scores;
// Dee: Ana's answer right (streak 4 → 250); Dee's own answer doesn't count either way.
expect(fin[idOf.Dee] === 450 + 250, `Dee's streak carries across questions: 700 (… + 250)`);
expect(fin[idOf.Cy] === 0, "Cy (always wrong) has 0");

await tv.getByTestId("awards").waitFor({ timeout: 15000 });
await sleep(2500);
const titles = await tv.locator("[data-award]").evaluateAll((els) => els.map((el) => el.dataset.award));
expect(titles.join() === "Best Detective,Most Obvious,Longest Streak", `three awards only (${titles.join(", ")})`);
const card = (t) => tv.locator(`[data-award="${t}"]`).innerText();
expect((await card("Best Detective")).includes("Dee") && /4 authors found/.test(await card("Best Detective")), "Best Detective: Dee (4 found)");
expect((await card("Longest Streak")).includes("Dee") && /4 in a row/.test(await card("Longest Streak")), "Longest Streak: Dee (4 in a row)");
await shot(tv, "8-tv-awards");
await host.getByRole("button", { name: "Show results" }).click();
await tv.getByText(/results/i).first().waitFor({ timeout: 20000 });
await tv.waitForTimeout(3000);
const finalText = await tv.locator("body").innerText();
expect(finalText.includes("4 found · 400 + 300 bonus · streak 4"), "final results break down base and bonus with the best streak");
await shot(tv, "9-tv-final");
await host.getByRole("button", { name: /Replay/ }).waitFor({ timeout: 15000 });
expect(true, "host can play again");

await b.close();
