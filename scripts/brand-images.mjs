/**
 * Renders the brand images in public/ with the real fonts (Bricolage Grotesque + Inter):
 *   og-image.png          1200×630 social card (Open Graph / Twitter), from the design canvas's Hero artboard
 *   apple-touch-icon.png  180×180, icon-192.png, icon-512.png (from favicon.svg)
 *   icon-maskable-512.png 512×512 with the safe-zone padding Android's adaptive icons need
 *   node scripts/brand-images.mjs   (needs Playwright)
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright");

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
/** Fonts inlined as data URLs (a page set from a string can't load file:// fonts). */
const font = (pkg, file) => `data:font/woff2;base64,${fs.readFileSync(path.join(root, "node_modules/@fontsource-variable", pkg, "files", file)).toString("base64")}`;
const favicon = fs.readFileSync(path.join(root, "public/favicon.svg"), "utf8");

const C = { bg: "#15122e", card: "#221d45", border: "#3a3373", ring: "#2e2860", text: "#ffffff", muted: "#d6d2f5", yellow: "#ffd447", coral: "#ff6b5b", mint: "#7fe0c8", lavender: "#b9a6ff" };
const check = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="${C.mint}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

const og = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Bricolage"; src: url("${font("bricolage-grotesque", "bricolage-grotesque-latin-wght-normal.woff2")}") format("woff2"); font-weight: 200 800; }
@font-face { font-family: "Inter"; src: url("${font("inter", "inter-latin-wght-normal.woff2")}") format("woff2"); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; background: ${C.bg}; color: ${C.text}; font-family: Inter, sans-serif; }
.wrap { position: relative; width: 1200px; height: 630px; padding: 64px 72px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
.c { position: absolute; border-radius: 4px; }
.ring { position: absolute; border-radius: 50%; border: 2px solid ${C.ring}; }
.pill { display: inline-flex; align-items: center; padding: 10px 20px; border-radius: 999px; font-weight: 600; font-size: 22px; }
.chip { display: inline-flex; align-items: center; gap: 10px; padding: 14px 22px; border-radius: 16px; background: ${C.card}; font-weight: 600; font-size: 24px; }
h1 { font-family: Bricolage, sans-serif; font-weight: 800; font-size: 168px; line-height: .86; letter-spacing: -0.045em; color: ${C.yellow}; }
.tag { font-family: Bricolage, sans-serif; font-weight: 600; font-size: 54px; line-height: 1; margin-top: 18px; }
.lede { margin-top: 18px; max-width: 700px; font-size: 28px; line-height: 1.38; color: ${C.muted}; }
</style></head><body><div class="wrap">
  <div class="c" style="top:70px;right:120px;width:34px;height:14px;background:${C.coral};transform:rotate(28deg)"></div>
  <div class="c" style="top:170px;right:270px;width:22px;height:22px;background:${C.yellow};border-radius:50%"></div>
  <div class="c" style="top:250px;right:90px;width:40px;height:14px;background:${C.mint};transform:rotate(-35deg)"></div>
  <div class="c" style="top:110px;right:420px;width:16px;height:16px;background:${C.lavender};transform:rotate(18deg)"></div>
  <div class="c" style="top:340px;right:220px;width:26px;height:10px;background:${C.yellow};transform:rotate(60deg)"></div>
  <div class="ring" style="bottom:-260px;right:-200px;width:620px;height:620px"></div>
  <div class="ring" style="bottom:-150px;right:-90px;width:420px;height:420px"></div>

  <div style="position:relative;display:flex;gap:14px">
    <span class="pill" style="background:${C.coral};color:${C.bg}">Party games</span>
    <span class="pill" style="border:2px solid ${C.border};color:${C.muted}">joinpartey.com</span>
  </div>
  <div style="position:relative">
    <h1>Partey<span style="color:${C.coral}">.</span></h1>
    <p class="tag">Tara, laro!</p>
    <p class="lede">Party games on the big screen, played on your phone. One host, one TV, and everyone plays.</p>
  </div>
  <div style="position:relative;display:flex;gap:14px">
    <span class="chip">${check}No app to install</span>
    <span class="chip">${check}No accounts</span>
    <span class="chip">${check}Scan and play</span>
  </div>
</div></body></html>`;

/** The favicon at `size`; `pad` (0–0.5) shrinks the mark onto a full-bleed background (maskable). */
const icon = (size, pad = 0) => `<!doctype html><html><head><style>*{margin:0}body{width:${size}px;height:${size}px;background:${C.bg};display:grid;place-items:center}
svg{width:${size * (1 - 2 * pad)}px;height:${size * (1 - 2 * pad)}px;display:block}</style></head><body>${favicon}</body></html>`;

const b = await chromium.launch();
async function render(html, w, h, file) {
  const page = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(root, "public", file) });
  console.log("•", file);
}
await render(og, 1200, 630, "og-image.png");
await render(icon(180), 180, 180, "apple-touch-icon.png");
await render(icon(192), 192, 192, "icon-192.png");
await render(icon(512), 512, 512, "icon-512.png");
await render(icon(512, 0.1), 512, 512, "icon-maskable-512.png");
await b.close();
