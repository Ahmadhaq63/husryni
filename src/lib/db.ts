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
  // 6: the report standard (src/lib/standard.ts): cause and consequence on findings, the AI's original
  // grade (kept for AI–inspector agreement), a reason for every item not assessed, moisture readings as
  // data, and what is fixed at signing: standard version, overall grade, fee, declaration and the seal.
  `
  ALTER TABLE findings ADD COLUMN cause TEXT NOT NULL DEFAULT '';
  ALTER TABLE findings ADD COLUMN consequence TEXT NOT NULL DEFAULT '';
  ALTER TABLE findings ADD COLUMN ai_grade TEXT;
  -- Best effort for earlier AI findings: an edit may have changed the grade, so edited ones stay unknown.
  UPDATE findings SET ai_grade = grade WHERE source = 'ai' AND review_status IN ('pending', 'confirmed', 'rejected');
  ALTER TABLE items ADD COLUMN na_reason TEXT NOT NULL DEFAULT '';
  ALTER TABLE inspections ADD COLUMN standard_version TEXT;
  ALTER TABLE inspections ADD COLUMN overall_grade TEXT;
  ALTER TABLE inspections ADD COLUMN fee_isk INTEGER;
  ALTER TABLE inspections ADD COLUMN declared_at TEXT;
  ALTER TABLE inspections ADD COLUMN report_hash TEXT;
  CREATE UNIQUE INDEX inspections_by_report_hash ON inspections(report_hash) WHERE report_hash IS NOT NULL;

  CREATE TABLE moisture_readings (
    id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    item_key TEXT,
    room TEXT NOT NULL,
    part TEXT NOT NULL,
    value REAL NOT NULL,
    method TEXT NOT NULL DEFAULT 'pin',
    created_at TEXT NOT NULL
  );
  CREATE INDEX moisture_by_inspection ON moisture_readings(inspection_id, created_at);
  `,
  // 7: property history. Where the property is (address register id, besides the fastanúmer), and yearly
  // owner checks: an inspection of kind 'annual' under the full report it follows up (parent_id), with an
  // answer per open finding (fixed / unchanged / worse, optionally checked against photos) and per question.
  `
  ALTER TABLE inspections ADD COLUMN heinum INTEGER;
  ALTER TABLE inspections ADD COLUMN parent_id TEXT REFERENCES inspections(id) ON DELETE CASCADE;
  ALTER TABLE inspections ADD COLUMN kind TEXT NOT NULL DEFAULT 'full';
  ALTER TABLE inspections ADD COLUMN completed_at TEXT;
  CREATE INDEX inspections_by_parent ON inspections(parent_id, created_at);
  CREATE INDEX inspections_by_fastanumer ON inspections(fastanumer) WHERE fastanumer IS NOT NULL;
  CREATE INDEX inspections_by_heinum ON inspections(heinum) WHERE heinum IS NOT NULL;

  CREATE TABLE followups (
    inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    answer TEXT,
    note TEXT NOT NULL DEFAULT '',
    verdict_json TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (inspection_id, finding_id)
  );

  CREATE TABLE annual_answers (
    inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    answer TEXT,
    note TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (inspection_id, question_id)
  );
  `,
  // 8: owner tools. Read-only report links the owner can revoke (insurers, banks), repair quote drafts per
  // trade, problems the owner reports between checks (with triage), and a log of questions to the assistant.
  `
  CREATE TABLE read_links (
    token TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    audience TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    revoked_at TEXT,
    views INTEGER NOT NULL DEFAULT 0,
    last_viewed_at TEXT
  );
  CREATE INDEX read_links_by_inspection ON read_links(inspection_id, created_at);

  CREATE TABLE quotes (
    id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    number TEXT NOT NULL,
    trade TEXT NOT NULL,
    finding_ids TEXT NOT NULL DEFAULT '[]',
    lines_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    approved_at TEXT
  );
  CREATE INDEX quotes_by_inspection ON quotes(inspection_id, created_at);

  CREATE TABLE problem_reports (
    id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    triage_json TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL,
    resolved_at TEXT
  );
  CREATE INDEX problems_by_inspection ON problem_reports(inspection_id, created_at);

  CREATE TABLE assistant_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    engine TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    created_at TEXT NOT NULL
  );
  CREATE INDEX assistant_by_inspection ON assistant_log(inspection_id, created_at);
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
const globalForDb = globalThis as unknown as { __husryniDb?: Database.Database; __husryniDbVersion?: number };

export function getDb(): Database.Database {
  if (!globalForDb.__husryniDb) {
    const dir = dataDir();
    fs.mkdirSync(dir, { recursive: true });
    const db = new Database(path.join(dir, "husryni.db"));
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    globalForDb.__husryniDb = db;
  }
  // A hot reload can bring new migrations while the cached connection lives on: apply them too.
  if (globalForDb.__husryniDbVersion !== MIGRATIONS.length) {
    migrate(globalForDb.__husryniDb);
    globalForDb.__husryniDbVersion = MIGRATIONS.length;
  }
  return globalForDb.__husryniDb;
}
