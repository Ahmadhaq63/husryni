import Database from "better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildAddressIndex,
  normalizeAddressText,
  parseAddressQuery,
  parseCsv,
  searchAddresses,
  type AddressSuggestion,
} from "@/lib/addressIndex";
import { formatAddress, postcodeWithTown, townFor } from "@/lib/postcodes";

// Same columns as the HMS register (Staðfangaskrá) uses, a few real-looking rows and the awkward cases.
const REGISTER = [
  "HEITI_NF,HUSNR,BOKST,VIDSK,POSTNR,N_HNIT_WGS84,E_HNIT_WGS84,LANDNR,HEINUM,ATH",
  "Laugavegur,1,,,101,64.1457,-21.9302,101300,1,",
  "Laugavegur,1,b,,101,,,101301,2,",
  "Laugavegur,10,,,101,,,101302,3,",
  "Laugavegur,60,A,,101,,,101303,4,",
  "Laugavegur,2,,,101,,,101304,5,",
  "Laugavegur,151,R,,105,,,101305,6,",
  "Laugavegur,160,,,105,,,101306,7,",
  "Laugavegur,1,,,560,,,101307,8,",
  "Laugarásvegur,1,,,104,,,101308,9,",
  "Fiskislóð,49,,49-51,101,,,101309,10,",
  "Fiskislóð,49,,49-51,101,,,101309,11,",
  "Höfði,,,frístundalóð,451,,,101310,12,",
  "Laugavegur,,,leikvöllur,105,,,101311,13,",
  "Laugavegur leikvöllur,,,,105,,,101316,19,",
  'Bæjarlind,8,,,201,64.0999,-21.8791,177597,14,"nf,tgf breytt, ""athugað"""',
  "Stóra Knarrarnes I,,,,191,,,101312,15,",
  "Þórunnartún,2,,,105,,,101313,16,",
  "Hverfisgata,4,,vegsvæði,101,,,101314,17,",
  "Ónefnd,1,,,,,,101315,18,",
].join("\r\n");

const view = (list: AddressSuggestion[]) =>
  list.map((s) => (s.kind === "street" ? `street ${s.street}, ${s.postcode} ${s.town}` : `${s.label}, ${s.postcode} ${s.town}`));

describe("address text", () => {
  it("folds Icelandic letters and accents the way people type without an Icelandic keyboard", () => {
    expect(normalizeAddressText("Þórunnartún")).toBe("thorunnartun");
    expect(normalizeAddressText("Ægisíða")).toBe("aegisida");
    expect(normalizeAddressText("Hafnarfjörður")).toBe("hafnarfjordur");
    expect(normalizeAddressText("  Efri-Flankastaðir ")).toBe("efri flankastadir");
    expect(normalizeAddressText("2.Gata v/Rauðavatn")).toBe("2 gata v raudavatn");
  });

  it("splits a typed address into street, house number, letter and place", () => {
    expect(parseAddressQuery("Laugav")).toEqual({ street: "laugav", number: null, letter: "", postcode: null, town: "" });
    expect(parseAddressQuery("Laugavegur 12b")).toMatchObject({ street: "laugavegur", number: "12", letter: "b" });
    expect(parseAddressQuery("laugavegur 12 B")).toMatchObject({ street: "laugavegur", number: "12", letter: "b" });
    expect(parseAddressQuery("Laugavegur 1, 101 Reykjavík")).toMatchObject({ street: "laugavegur", number: "1", postcode: "101" });
    expect(parseAddressQuery("Bæjarlind 8, Kópavogur")).toMatchObject({ street: "baejarlind", number: "8", postcode: null, town: "kopavogur" });
    expect(parseAddressQuery("Vegslóði S16")).toMatchObject({ street: "vegslodi s16", number: null });
  });
});

describe("CSV", () => {
  it("handles quoted fields with commas and doubled quotes, CRLF, a BOM and a trailing newline", () => {
    const rows = [...parseCsv('﻿a,b,c\r\n1,"x, ""y""",3\r\n\r\n4,,6\r\n')];
    expect(rows).toEqual([
      { a: "1", b: 'x, "y"', c: "3" },
      { a: "4", b: "", c: "6" },
    ]);
  });
});

describe("address index", () => {
  const db = new Database(":memory:");
  let stats: ReturnType<typeof buildAddressIndex>;
  beforeAll(() => {
    stats = buildAddressIndex(db, parseCsv(REGISTER), townFor);
  });

  it("keeps homes once each and leaves out roads, playgrounds and rows without a postcode", () => {
    expect(stats).toEqual({ rows: 19, addresses: 14, streets: 9, skipped: 4 });
    expect(view(searchAddresses(db, "fiskislóð 49"))).toEqual(["Fiskislóð 49, 101 Reykjavík"]);
    expect(searchAddresses(db, "hverfisgata")).toEqual([]);
    expect(searchAddresses(db, "laugavegur leik")).toEqual([]);
    expect(view(searchAddresses(db, "Laugavegur ", { postcode: "105" }))).not.toContain("Laugavegur leikvöllur, 105 Reykjavík");
  });

  it("suggests streets first, biggest first; one-address places come complete", () => {
    expect(view(searchAddresses(db, "lauga"))).toEqual([
      "street Laugavegur, 101 Reykjavík",
      "street Laugavegur, 105 Reykjavík",
      "Laugarásvegur 1, 104 Reykjavík",
      "Laugavegur 1, 560 Varmahlíð",
    ]);
    expect(view(searchAddresses(db, "thorunnartun"))).toEqual(["Þórunnartún 2, 105 Reykjavík"]);
    expect(view(searchAddresses(db, "knarr"))).toEqual(["Stóra Knarrarnes I, 191 Vogar"]);
    expect(view(searchAddresses(db, "hofdi"))).toEqual(["Höfði frístundalóð, 451 Patreksfjörður"]);
    expect(searchAddresses(db, "l")).toEqual([]);
  });

  it("matches house numbers as they are typed, exact number first", () => {
    expect(view(searchAddresses(db, "laugavegur 1"))).toEqual([
      "Laugavegur 1, 101 Reykjavík",
      "Laugavegur 1B, 101 Reykjavík",
      "Laugavegur 1, 560 Varmahlíð",
      "Laugavegur 10, 101 Reykjavík",
      "Laugavegur 151R, 105 Reykjavík",
      "Laugavegur 160, 105 Reykjavík",
    ]);
    expect(view(searchAddresses(db, "laugavegur 60a"))).toEqual(["Laugavegur 60A, 101 Reykjavík"]);
    expect(view(searchAddresses(db, "Laugavegur 1, 560"))).toEqual(["Laugavegur 1, 560 Varmahlíð"]);
  });

  it("stays on a picked street, and looks further when no number there matches", () => {
    expect(view(searchAddresses(db, "Laugavegur ", { postcode: "101" }))).toEqual([
      "Laugavegur 1, 101 Reykjavík",
      "Laugavegur 1B, 101 Reykjavík",
      "Laugavegur 2, 101 Reykjavík",
      "Laugavegur 10, 101 Reykjavík",
      "Laugavegur 60A, 101 Reykjavík",
    ]);
    expect(view(searchAddresses(db, "Laugavegur 1", { postcode: "101" }))).toEqual([
      "Laugavegur 1, 101 Reykjavík",
      "Laugavegur 1B, 101 Reykjavík",
      "Laugavegur 10, 101 Reykjavík",
    ]);
    expect(view(searchAddresses(db, "Laugavegur 15", { postcode: "101" }))).toEqual(["Laugavegur 151R, 105 Reykjavík"]);
    // A postcode for another street changes nothing.
    expect(searchAddresses(db, "lauga", { postcode: "201" })).toEqual(searchAddresses(db, "lauga"));
  });
});

describe("postcodes", () => {
  it("names the town as written in an address", () => {
    expect(townFor("200")).toBe("Kópavogur");
    expect(townFor("720")).toBe("Borgarfjörður eystri");
    expect(townFor("999")).toBeNull();
    expect(postcodeWithTown("600")).toBe("600 Akureyri");
    expect(formatAddress("Laugavegur 1", "101")).toBe("Laugavegur 1, 101 Reykjavík");
    expect(formatAddress("Óþekkt 1", "999")).toBe("Óþekkt 1, 999");
  });
});
