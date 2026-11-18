import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export function dataDir(): string {
  // Runtime storage, not source: tell Turbopack not to trace it into the build output.
  return path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? path.join(process.cwd(), "data"));
}

/** Ordered, append-only migrations. Never edit a shipped entry; add a new one. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE inspections (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL,
    tier TEXT NOT NULL,
    purpose TEXT NOT NULL,
    lang TEXT NOT NULL,
    address TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    fastanumer TEXT,
    property_type TEXT NOT NULL,
    build_year INTEGER NOT NULL,
    size_m2 REAL NOT NULL,
    construction TEXT NOT NULL,
    heating TEXT NOT NULL,
    has_basement INTEGER NOT NULL DEFAULT 0,
    has_attic INTEGER NOT NULL DEFAULT 0,
    contact_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    inspector_name TEXT,
    inspector_license TEXT,
    inspector_statement TEXT,
    signed_at TEXT,
    summary_json TEXT
  );
  CREATE INDEX inspections_by_status ON inspections(status, created_at);

  CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    item_key TEXT NOT NULL,
    position INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT NOT NULL DEFAULT '',
    not_accessible INTEGER NOT NULL DEFAULT 0,
    analysis_json TEXT,
    UNIQUE (inspection_id, item_key)
  );

  CREATE TABLE photos (
    id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    item_key TEXT NOT NULL,
    mime TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX photos_by_item ON photos(inspection_id, item_key, created_at);

  CREATE TABLE findings (
    id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    item_key TEXT NOT NULL,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    grade TEXT NOT NULL,
    confidence TEXT NOT NULL,
    photo_ids TEXT NOT NULL DEFAULT '[]',
    recommended_action TEXT NOT NULL DEFAULT '',
    follow_up TEXT NOT NULL DEFAULT 'none',
    urgency TEXT NOT NULL DEFAULT 'monitor',
    cost_key TEXT NOT NULL DEFAULT 'none',
    review_status TEXT NOT NULL DEFAULT 'pending',
    inspector_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX findings_by_item ON findings(inspection_id, item_key);
  `,
  // 2: optional price (repair cost as share of price) + how each photo was captured (trust signal)
  `
  ALTER TABLE inspections ADD COLUMN price_isk INTEGER;
  ALTER TABLE photos ADD COLUMN source TEXT NOT NULL DEFAULT 'upload';
  `,
  // 3: remedies & negotiation (who fixes / pays for each finding, seller response, before/after fix check)
  `
  CREATE TABLE negotiations (
    inspection_id TEXT PRIMARY KEY REFERENCES inspections(id) ON DELETE CASCADE,
    share_token TEXT NOT NULL UNIQUE,
    owner_share_pct REAL,
    response_deadline TEXT,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE remedies (
    finding_id TEXT PRIMARY KEY REFERENCES findings(id) ON DELETE CASCADE,
    inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    action TEXT NOT NULL DEFAULT 'none',
    amount_isk INTEGER,
    remark TEXT NOT NULL DEFAULT '',
    seller_response TEXT NOT NULL DEFAULT 'none',
    dispute_reason TEXT,
    seller_comment TEXT NOT NULL DEFAULT '',
    fix_status TEXT NOT NULL DEFAULT 'none',
    fix_verdict_json TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX remedies_by_inspection ON remedies(inspection_id);
  `,
  // 4: features that add checklist items, and the official construction stage (ÍST 51:2021)
  `
  ALTER TABLE inspections ADD COLUMN has_garage INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE inspections ADD COLUMN has_fireplace INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE inspections ADD COLUMN has_hot_tub INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE inspections ADD COLUMN construction_stage TEXT;
  `,
  // 5: instant per-photo quality check by a fast, cheap model (usable / retake + reason)
  `
  ALTER TABLE photos ADD COLUMN check_status TEXT NOT NULL DEFAULT 'unchecked';
  ALTER TABLE photos ADD COLUMN check_reason TEXT;
  `,
];

function migrate(db: Database.Database) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  const row = db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number | null };
  const current = row.v ?? 0;
  for (let i = current; i < MIGRATIONS.length; i++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[i]);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(i + 1, new Date().toISOString());
    })();
  }
}

// Reuse one connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { __husryniDb?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb.__husryniDb) {
    const dir = dataDir();
    fs.mkdirSync(dir, { recursive: true });
    const db = new Database(path.join(dir, "husryni.db"));
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    globalForDb.__husryniDb = db;
  }
  return globalForDb.__husryniDb;
}
