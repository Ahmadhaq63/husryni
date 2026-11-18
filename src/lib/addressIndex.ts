/**
 * Address suggestions for the order form, from Staðfangaskrá: the official Icelandic address register,
 * published by HMS (Húsnæðis- og mannvirkjastofnun) as open data under CC BY 4.0.
 *
 * `npm run addresses` (scripts/build-addresses.ts) downloads the register and builds a small SQLite index
 * with buildAddressIndex(); GET /api/addresses answers the form with searchAddresses().
 *
 * Shared by that script (run by plain Node, which strips the types), the API route, the form and the tests,
 * so this module has no runtime imports and works with any better-sqlite3 connection.
 */
import type Database from "better-sqlite3";

type Db = Database.Database;

/** The register as HMS publishes it (one CSV, refreshed daily). */
export const REGISTER_URL = "https://hmsstgsftpprodweu001.blob.core.windows.net/fasteignaskra/Stadfangaskra.csv";

/** A street (one per name and postcode): picking it fills the postcode, then the form lists its house numbers. */
export interface StreetSuggestion {
  kind: "street";
  street: string;
  postcode: string;
  town: string;
}

/** A complete address: picking it fills the address and postcode fields. */
export interface PlaceSuggestion {
  kind: "address";
  /** What goes in the address field, e.g. "Laugavegur 60A" or "Höfði frístundalóð". */
  label: string;
  postcode: string;
  town: string;
  /** The register's id for this address (HEINUM): identifies the building across reports. */
  heinum: number | null;
}

export type AddressSuggestion = StreetSuggestion | PlaceSuggestion;

// ---------------------------------------------------------------------------------------------
// Text

const FOLD: Record<string, string> = { þ: "th", ð: "d", æ: "ae", ø: "o" };

/**
 * Search key: lower case, no accents, Icelandic letters as people type them without an Icelandic keyboard
 * (þ → th, ð → d, æ → ae, ö → o), and any run of punctuation or spaces as one space.
 * "Þórunnartún" → "thorunnartun", "Efri-Flankastaðir" → "efri flankastadir".
 */
export function normalizeAddressText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[þðæø]/g, (c) => FOLD[c])
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface AddressQuery {
  /** Normalised street part, e.g. "laugavegur". */
  street: string;
  /** House number as typed so far, e.g. "12"; null when none was typed. */
  number: string | null;
  /** House letter as typed so far, e.g. "b"; "" when none. */
  letter: string;
  /** Postcode typed after a comma ("Laugavegur 1, 101"); null when none. */
  postcode: string | null;
  /** Normalised town typed after a comma ("Laugavegur 1, Reykjavík"); "" when none. */
  town: string;
}

/** "Laugavegur 12b, 101 Reykjavík" → street "laugavegur", number "12", letter "b", postcode "101". */
export function parseAddressQuery(text: string): AddressQuery {
  const comma = text.indexOf(",");
  const head = normalizeAddressText(comma < 0 ? text : text.slice(0, comma));
  const tail = comma < 0 ? "" : normalizeAddressText(text.slice(comma + 1));
  const house = /^(.*\S)\s+(\d{1,4})\s?([a-z]?)$/.exec(head);
  const place = /^(\d{3})(?:\s+(.*))?$/.exec(tail);
  return {
    street: house ? house[1] : head,
    number: house ? house[2] : null,
    letter: house ? house[3] : "",
    postcode: place ? place[1] : null,
    town: place ? (place[2] ?? "") : tail,
  };
}

// ---------------------------------------------------------------------------------------------
// CSV

/** RFC 4180 CSV (quoted fields, doubled quotes, CRLF or LF) → one record per row, keyed by the header row. */
export function* parseCsv(text: string): Generator<Record<string, string>> {
  const n = text.length;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let header: string[] | null = null;
  while (i < n) {
    const row: string[] = [];
    for (;;) {
      let field = "";
      if (text[i] === '"') {
        let j = i + 1;
        for (;;) {
          const q = text.indexOf('"', j);
          if (q < 0) {
            field += text.slice(j);
            j = n;
            break;
          }
          field += text.slice(j, q);
          if (text[q + 1] === '"') {
            field += '"';
            j = q + 2;
          } else {
            j = q + 1;
            break;
          }
        }
        i = j;
      }
      let j = i;
      while (j < n && text[j] !== "," && text[j] !== "\n" && text[j] !== "\r") j++;
      field += text.slice(i, j);
      i = j;
      row.push(field);
      if (text[i] === ",") {
        i++;
        continue;
      }
      if (text[i] === "\r") i++;
      if (text[i] === "\n") i++;
      break;
    }
    if (!header) {
      header = row.map((h) => h.trim());
      continue;
    }
    if (row.length === 1 && row[0] === "") continue;
    const record: Record<string, string> = {};
    header.forEach((h, k) => (record[h] = row[k] ?? ""));
    yield record;
  }
}

// ---------------------------------------------------------------------------------------------
// Building the index

const SCHEMA = `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
  CREATE TABLE streets (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    postcode TEXT NOT NULL,
    town TEXT NOT NULL,
    name_key TEXT NOT NULL,
    town_key TEXT NOT NULL,
    addresses INTEGER NOT NULL DEFAULT 0,
    numbered INTEGER NOT NULL DEFAULT 0
  ) STRICT;
  CREATE INDEX streets_by_name ON streets(name_key, postcode);
  -- Prefix search runs on these: the whole name, plus what follows each later word ("Stóra Knarrarnes" → "knarrarnes").
  CREATE TABLE street_keys (key TEXT NOT NULL, street_id INTEGER NOT NULL, is_full INTEGER NOT NULL) STRICT;
  CREATE INDEX street_keys_by_key ON street_keys(key);
  CREATE TABLE addresses (
    id INTEGER PRIMARY KEY,
    street_id INTEGER NOT NULL,
    number INTEGER,
    letter TEXT NOT NULL,
    extra TEXT NOT NULL,
    label TEXT NOT NULL,
    lat REAL,
    lon REAL,
    landnr INTEGER,
    heinum INTEGER,
    UNIQUE (street_id, label)
  ) STRICT;
  CREATE INDEX addresses_by_street ON addresses(street_id, number, letter);
`;

/**
 * Register entries that are roads, utilities, sports grounds and the like rather than buildings, named
 * either in the address suffix ("lóð vegsvæði") or in the name itself ("Laugavegur leikvöllur", "Dreifistöð DRE").
 */
const NOT_A_HOME = new RegExp(
  "(?:^|[\\s/-])(" +
    [
      "vegsvæði", "vegstæði", "spennistöð", "spennustöð", "dreifistöð", "dre", "aðveitustöð", "tengivirki",
      "stöðvarhús", "tækjahús", "dælustöð", "dæluhús", "dæluskúr", "borhola", "vatnstankur", "vatnsgeymir",
      "vatnsból", "vatnsveita", "hitaveita", "fjarskiptalóð", "fjarskiptahús", "fjarskiptastöð", "landssími",
      "hleðslustöð", "olíustöð", "viti", "leiksvæði", "leikvöllur", "tjaldstæði", "tjaldsvæði", "golfvöllur",
      "íþróttavöllur", "skíðasvæði", "flugvöllur", "kirkjugarður", "opið svæði", "salernishús", "skógrækt", "beitiland",
    ].join("|") +
    ")(?=$|[\\s\\d])",
  "iu",
);
/** A house-number range ("49-51") the register keeps beside the number: the number already says it. */
const NUMBER_RANGE = /^\d+\s*[a-z]?\s*[-–]\s*\d+\s*[a-z]?\s*\*?$/iu;

const clean = (s: string | undefined) => (s ?? "").trim().replace(/\s+/g, " ");
const intOrNull = (s: string | undefined) => (/^\d+$/.test((s ?? "").trim()) ? Number((s ?? "").trim()) : null);
const coord = (s: string | undefined) => {
  const v = Number(clean(s).replace(",", "."));
  return clean(s) && Number.isFinite(v) ? v : null;
};

function streetKeys(nameKey: string): string[] {
  const keys = [nameKey];
  for (let i = nameKey.indexOf(" "); i >= 0; i = nameKey.indexOf(" ", i + 1)) {
    const rest = nameKey.slice(i + 1);
    if (rest.length >= 3) keys.push(rest);
  }
  return keys;
}

export interface BuildStats {
  rows: number;
  addresses: number;
  streets: number;
  skipped: number;
}

/**
 * Fills an empty database with the index. `rows` are register records keyed by the CSV header
 * (HEITI_NF, HUSNR, BOKST, VIDSK, POSTNR, …); `townFor` names the town of a postcode.
 */
export function buildAddressIndex(db: Db, rows: Iterable<Record<string, string>>, townFor: (postcode: string) => string | null): BuildStats {
  db.exec(SCHEMA);
  const insStreet = db.prepare("INSERT INTO streets (id, name, postcode, town, name_key, town_key) VALUES (?, ?, ?, ?, ?, ?)");
  const insKey = db.prepare("INSERT INTO street_keys (key, street_id, is_full) VALUES (?, ?, ?)");
  const insAddress = db.prepare(
    "INSERT OR IGNORE INTO addresses (street_id, number, letter, extra, label, lat, lon, landnr, heinum) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const streetIds = new Map<string, number>();
  let count = 0;
  let skipped = 0;

  db.transaction(() => {
    for (const r of rows) {
      count++;
      const name = clean(r.HEITI_NF);
      const postcode = clean(r.POSTNR);
      const suffix = clean(r.VIDSK).replace(/^\/\s*/, "");
      if (!name || !/^\d{3}$/.test(postcode) || NOT_A_HOME.test(name) || NOT_A_HOME.test(suffix)) {
        skipped++;
        continue;
      }

      let streetId = streetIds.get(`${name}\t${postcode}`);
      if (streetId === undefined) {
        streetId = streetIds.size + 1;
        streetIds.set(`${name}\t${postcode}`, streetId);
        const town = townFor(postcode) ?? "";
        const nameKey = normalizeAddressText(name);
        insStreet.run(streetId, name, postcode, town, nameKey, normalizeAddressText(town));
        for (const key of streetKeys(nameKey)) insKey.run(key, streetId, key === nameKey ? 1 : 0);
      }

      const number = intOrNull(r.HUSNR);
      const rawLetter = clean(r.BOKST);
      const letter = rawLetter.length === 1 ? rawLetter.toUpperCase() : rawLetter;
      const house = number === null ? letter : `${number}${letter.length > 1 ? ` ${letter}` : letter}`;
      const extra = NUMBER_RANGE.test(suffix) || normalizeAddressText(suffix) === normalizeAddressText(house) ? "" : suffix;
      const label = [name, house, extra].filter(Boolean).join(" ");
      insAddress.run(streetId, number, letter, extra, label, coord(r.N_HNIT_WGS84), coord(r.E_HNIT_WGS84), intOrNull(r.LANDNR), intOrNull(r.HEINUM));
    }
    db.exec(`
      UPDATE streets SET
        addresses = (SELECT COUNT(*) FROM addresses a WHERE a.street_id = streets.id),
        numbered = (SELECT COUNT(*) FROM addresses a WHERE a.street_id = streets.id AND a.number IS NOT NULL);
    `);
  })();

  const total = (db.prepare("SELECT COUNT(*) AS n FROM addresses").get() as { n: number }).n;
  return { rows: count, addresses: total, streets: streetIds.size, skipped };
}

// ---------------------------------------------------------------------------------------------
// Searching

interface StreetRow {
  id: number;
  name: string;
  postcode: string;
  town: string;
  addresses: number;
  numbered: number;
}
interface PlaceRow {
  label: string;
  postcode: string;
  town: string;
  heinum: number | null;
}

const STREET_FILTERS = `
  k.key >= @street AND k.key < @streetEnd
  AND (@pc IS NULL OR s.postcode = @pc)
  AND (@town = '' OR (s.town_key >= @town AND s.town_key < @townEnd))`;

function prepare(db: Db) {
  return {
    streets: db.prepare(`
      SELECT s.id, s.name, s.postcode, s.town, s.addresses, s.numbered
      FROM street_keys k JOIN streets s ON s.id = k.street_id
      WHERE ${STREET_FILTERS}
      GROUP BY s.id
      ORDER BY MAX(k.is_full AND k.key = @street) DESC, MAX(k.is_full) DESC, s.addresses DESC, s.name, s.postcode
      LIMIT @limit`),
    numbers: db.prepare(`
      SELECT a.label, s.postcode, s.town, a.heinum
      FROM street_keys k JOIN streets s ON s.id = k.street_id JOIN addresses a ON a.street_id = s.id
      WHERE ${STREET_FILTERS}
        AND a.number IS NOT NULL AND CAST(a.number AS TEXT) LIKE @number || '%'
        AND (@letter = '' OR lower(a.letter) LIKE @letter || '%')
      GROUP BY a.id
      ORDER BY MAX(k.is_full AND k.key = @street) DESC, a.number = CAST(@number AS INTEGER) DESC, a.extra = '' DESC,
               s.addresses DESC, s.name, s.postcode, a.number, a.letter, a.extra
      LIMIT @limit`),
    /** Every address on one street, numbers first: shown after a street is picked. */
    streetAddresses: db.prepare(`
      SELECT a.label, s.postcode, s.town, a.heinum
      FROM streets s JOIN addresses a ON a.street_id = s.id
      WHERE s.id = ?
      ORDER BY a.number IS NULL, a.number, a.letter, a.extra
      LIMIT ?`),
    exactStreet: db.prepare("SELECT id FROM streets WHERE name_key = ? AND postcode = ?"),
  };
}

const statements = new WeakMap<Db, ReturnType<typeof prepare>>();

export interface SearchOptions {
  /**
   * Postcode of the street the person just picked. While what they type is still that street, results stay
   * on it: its house numbers, or everywhere else when no number there matches. Otherwise it's ignored.
   */
  postcode?: string | null;
  limit?: number;
}

/** Suggestions for what has been typed so far; [] for fewer than two letters. */
export function searchAddresses(db: Db, text: string, options: SearchOptions = {}): AddressSuggestion[] {
  const q = parseAddressQuery(text.slice(0, 120));
  if (q.street.length < 2) return [];
  let st = statements.get(db);
  if (!st) statements.set(db, (st = prepare(db)));

  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 8), 1), 20);
  const picked = options.postcode && /^\d{3}$/.test(options.postcode) ? options.postcode : null;
  const place = (r: PlaceRow): PlaceSuggestion => ({ kind: "address", label: r.label, postcode: r.postcode, town: r.town, heinum: r.heinum ?? null });

  // A street named in full in a known postcode: the one just picked, or typed with its postcode after a comma.
  const pc = q.postcode ?? picked;
  const known = pc ? (st.exactStreet.get(q.street, pc) as { id: number } | undefined) : undefined;
  const base = {
    street: q.street,
    streetEnd: `${q.street}~`, // keys only hold [a-z0-9 ], all sorting before "~"
    pc: q.postcode,
    town: q.town,
    townEnd: `${q.town}~`,
    limit,
  };

  if (q.number === null) {
    if (known) return (st.streetAddresses.all(known.id, limit) as PlaceRow[]).map(place);
    const out: AddressSuggestion[] = [];
    for (const s of st.streets.all(base) as StreetRow[]) {
      if (out.length >= limit) break;
      // Single addresses (farms, named houses) are complete as they are: no house number to pick.
      if (s.addresses === 1 || (s.numbered === 0 && s.addresses <= 3)) {
        out.push(...(st.streetAddresses.all(s.id, limit - out.length) as PlaceRow[]).map(place));
      } else {
        out.push({ kind: "street", street: s.name, postcode: s.postcode, town: s.town });
      }
    }
    return out;
  }

  const numbers = { ...base, number: q.number, letter: q.letter };
  if (known && !q.postcode) {
    const onStreet = st.numbers.all({ ...numbers, pc: picked }) as PlaceRow[];
    if (onStreet.length) return onStreet.map(place);
  }
  return (st.numbers.all(numbers) as PlaceRow[]).map(place);
}
