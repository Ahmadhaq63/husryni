/**
 * Builds the index behind the order form's address suggestions.
 *
 * Downloads Staðfangaskrá, the official Icelandic address register (HMS, open data, CC BY 4.0), and writes
 * data/addresses.db (or $DATA_DIR/addresses.db). The 38 MB download from HMS takes a minute or two; building
 * takes a second. Re-run now and then for new addresses: the running app picks up the new index by itself.
 *
 *   npm run addresses                                   # download the latest register from HMS
 *   npm run addresses -- --file path/to/Stadfangaskra.csv   # build from a copy you already have
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { buildAddressIndex, parseCsv, REGISTER_URL } from "../src/lib/addressIndex.ts";
import { townFor } from "../src/lib/postcodes.ts";

const args = process.argv.slice(2);
const fileArg = args.includes("--file") ? args[args.indexOf("--file") + 1] : null;
if (args.includes("--file") && !fileArg) throw new Error("--file needs a path");

const dataDir = path.resolve(process.env.DATA_DIR ?? "data");
const target = path.join(dataDir, "addresses.db");
const temp = `${target}.tmp`;

async function readRegister(): Promise<{ csv: string; source: string; published: string }> {
  if (fileArg) {
    const file = path.resolve(fileArg);
    return { csv: fs.readFileSync(file, "utf8"), source: file, published: fs.statSync(file).mtime.toISOString() };
  }
  // A stalled download must not hold up a deploy: give up after 5 minutes (it normally takes seconds to 2 minutes).
  const timeoutMs = Number(process.env.ADDRESS_DOWNLOAD_TIMEOUT_MS) || 5 * 60_000;
  console.log(`Downloading the address register from HMS (gives up after ${Math.round(timeoutMs / 1000)} s) …`);
  try {
    const res = await fetch(REGISTER_URL, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`HMS answered ${res.status} ${res.statusText}`);
    const csv = await res.text();
    const lastModified = res.headers.get("last-modified");
    return { csv, source: REGISTER_URL, published: lastModified ? new Date(lastModified).toISOString() : "" };
  } catch (e) {
    const reason = e instanceof Error && e.name === "TimeoutError" ? `no complete answer within ${Math.round(timeoutMs / 1000)} s` : String(e);
    console.error(`Could not download the address register (${reason}). The app works without address suggestions.`);
    process.exit(1);
  }
}

const started = Date.now();
const { csv, source, published } = await readRegister();
console.log(`Read ${(Buffer.byteLength(csv) / 1e6).toFixed(1)} MB. Building the index …`);

fs.mkdirSync(dataDir, { recursive: true });
fs.rmSync(temp, { force: true });
const db = new Database(temp);
try {
  const stats = buildAddressIndex(db, parseCsv(csv), townFor);
  if (stats.addresses < 1000) throw new Error(`Only ${stats.addresses} addresses found: is ${source} the address register?`);
  const meta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
  for (const [k, v] of Object.entries({
    source,
    licence: "CC BY 4.0, Húsnæðis- og mannvirkjastofnun (HMS)",
    published,
    built: new Date().toISOString(),
    addresses: String(stats.addresses),
  }))
    meta.run(k, v);
  db.exec("VACUUM");
  db.close();
  // Swap the finished file in at once, so the app never reads a half-built index.
  fs.renameSync(temp, target);
  console.log(
    `Done in ${((Date.now() - started) / 1000).toFixed(1)} s: ${stats.addresses.toLocaleString("en")} addresses on ` +
      `${stats.streets.toLocaleString("en")} streets → ${path.relative(process.cwd(), target) || target} ` +
      `(${(fs.statSync(target).size / 1e6).toFixed(1)} MB; ${stats.skipped} roads, utility plots and incomplete rows left out).`,
  );
} catch (e) {
  if (db.open) db.close();
  fs.rmSync(temp, { force: true });
  throw e;
}
