/**
 * Guard for staging builds/deploys: refuses unless staging is fully configured and can't touch
 * production. Run by `npm run build:staging` (and so by `npm run deploy:preview`).
 *   - .firebaserc has a real `preview` alias, different from `prod`
 *   - .env.staging sets every web config key, for that project, with emulators off
 *   - functions/.env.preview sets RTDB_URL, and not to production's
 */
import fs from "node:fs";

const fail = (msg) => {
  console.error(`\n✗ Staging config: ${msg}\n  See README → "Staging".\n`);
  process.exit(1);
};
const parse = (file) => {
  if (!fs.existsSync(file)) fail(`${file} is missing (copy ${file.replace(/(\.env\.\w+)$/, "$1.example")}).`);
  return Object.fromEntries(
    fs.readFileSync(file, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
  );
};

const { projects } = JSON.parse(fs.readFileSync(".firebaserc", "utf8"));
const staging = projects.preview;
if (!staging || staging.startsWith("REPLACE")) fail('set the "preview" alias in .firebaserc to the staging project ID.');
if (staging === projects.prod) fail(`the "preview" alias points at production (${staging}).`);

const web = parse(".env.staging");
const REQUIRED = ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_STORAGE_BUCKET", "VITE_FIREBASE_MESSAGING_SENDER_ID", "VITE_FIREBASE_APP_ID", "VITE_FIREBASE_DATABASE_URL", "VITE_FIREBASE_FUNCTIONS_REGION"];
const missing = REQUIRED.filter((k) => !web[k]);
if (missing.length) fail(`.env.staging must set ${missing.join(", ")} (else production's values from .env are used).`);
if (web.VITE_USE_FIREBASE_EMULATORS !== "false") fail(".env.staging must set VITE_USE_FIREBASE_EMULATORS=false.");
if (web.VITE_FIREBASE_PROJECT_ID !== staging) fail(`.env.staging is for ${web.VITE_FIREBASE_PROJECT_ID}, but the "preview" alias is ${staging}.`);
if (web.VITE_FIREBASE_PROJECT_ID === projects.prod) fail(".env.staging points at production.");
// Analytics: an unset key would inherit production's ID from .env and mix staging traffic in.
const prodWeb = fs.existsSync(".env") ? parse(".env") : {};
if (!("VITE_FIREBASE_MEASUREMENT_ID" in web)) fail(".env.staging must set VITE_FIREBASE_MEASUREMENT_ID (empty turns Analytics off), else production's is used.");
if (web.VITE_FIREBASE_MEASUREMENT_ID && web.VITE_FIREBASE_MEASUREMENT_ID === prodWeb.VITE_FIREBASE_MEASUREMENT_ID) fail(".env.staging's VITE_FIREBASE_MEASUREMENT_ID is production's.");

const fn = parse("functions/.env.preview");
const prodFn = fs.existsSync("functions/.env") ? parse("functions/.env") : {};
if (!fn.RTDB_URL) fail("functions/.env.preview must set RTDB_URL to the staging Realtime Database.");
if (fn.RTDB_URL === prodFn.RTDB_URL) fail("functions/.env.preview's RTDB_URL is production's.");

console.log(`✓ Staging config OK: ${staging}`);
