import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { dataDir } from "@/lib/db";

/** Built by `npm run addresses` (scripts/build-addresses.ts). */
export const addressDbPath = () => path.join(dataDir(), "addresses.db");

// One read-only connection, kept across hot reloads in dev and reopened when the index is rebuilt.
const globalForAddresses = globalThis as unknown as { __husryniAddressDb?: { db: Database.Database; mtimeMs: number } };

/** The address index, or null when it hasn't been built: the form then works without suggestions. */
export function addressDb(): Database.Database | null {
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(addressDbPath()).mtimeMs;
  } catch {
    return null;
  }
  const current = globalForAddresses.__husryniAddressDb;
  if (current?.mtimeMs === mtimeMs) return current.db;
  current?.db.close();
  const db = new Database(addressDbPath(), { readonly: true, fileMustExist: true });
  globalForAddresses.__husryniAddressDb = { db, mtimeMs };
  return db;
}
