"use client";

/**
 * The order form's address field, with suggestions from the official address register (src/lib/addressIndex.ts).
 *
 * An ARIA combobox: type, then pick with the arrow keys and Enter, or by tapping. Picking a street fills the
 * postcode and lists that street's house numbers; picking an address fills both fields. Suggestions only help:
 * any address can still be typed in. Until the index is built (npm run addresses) this is a plain text field.
 */
import { useEffect, useId, useRef, useState } from "react";
import { normalizeAddressText, parseAddressQuery, type AddressSuggestion } from "@/lib/addressIndex";
import { getDict } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

interface Props {
  id: string;
  lang: Lang;
  value: string;
  invalid?: boolean;
  onChange: (value: string) => void;
  /** A suggestion was picked: set the address and postcode fields. */
  /** heinum: the address register's id, when a complete address (not just a street) was picked. */
  onPick: (pick: { address: string; postcode: string; heinum: number | null }) => void;
}

const DEBOUNCE_MS = 120;

export default function AddressAutocomplete({ id, lang, value, invalid, onChange, onPick }: Props) {
  const t = getDict(lang);
  const listId = `${useId()}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [available, setAvailable] = useState(false);
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [noMatch, setNoMatch] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  /** The street just picked: while the text still names it, suggestions stay on it. */
  const picked = useRef<{ street: string; postcode: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inflight = useRef<AbortController | null>(null);
  const cache = useRef(new Map<string, AddressSuggestion[]>());
  const scrolledIntoView = useRef(false);

  // Is there an index to search? Without one, the field stays a plain input.
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/addresses", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((b: { available?: boolean }) => setAvailable(Boolean(b.available)))
      .catch(() => {});
    return () => {
      ctrl.abort();
      clearTimeout(timer.current);
      inflight.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function show(list: AddressSuggestion[], text: string, browsing: boolean) {
    const none = list.length === 0 && normalizeAddressText(text).length >= 3;
    const count = list.length === 1 ? t.addrCountOne : t.addrCountMany.replace("{n}", String(list.length));
    setItems(list);
    setActive(-1);
    setNoMatch(none);
    setHint(browsing && list.length ? t.addrPickNumber : null);
    setOpen(list.length > 0 || none);
    setStatus(none ? t.addrNoMatch : list.length ? (browsing ? `${t.addrPickNumber} ${count}` : count) : "");
    // On a phone the keyboard hides half the screen: bring the field up so the list shows below it.
    if (list.length && !scrolledIntoView.current && window.matchMedia("(max-width: 767.98px)").matches) {
      scrolledIntoView.current = true;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      inputRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    }
  }

  function suggest(text: string) {
    clearTimeout(timer.current);
    inflight.current?.abort();
    const q = parseAddressQuery(text);
    if (picked.current && q.street !== normalizeAddressText(picked.current.street)) picked.current = null;
    if (!available || q.street.length < 2) {
      setItems([]);
      setNoMatch(false);
      setHint(null);
      setStatus("");
      close();
      return;
    }
    const pc = picked.current?.postcode ?? null;
    const browsing = pc !== null && q.number === null;
    const key = `${text.trim().toLowerCase()}|${pc ?? ""}`;
    const hit = cache.current.get(key);
    if (hit) return show(hit, text, browsing);

    timer.current = setTimeout(async () => {
      const ctrl = new AbortController();
      inflight.current = ctrl;
      try {
        const params = new URLSearchParams({ q: text });
        if (pc) params.set("pc", pc);
        const res = await fetch(`/api/addresses?${params}`, { signal: ctrl.signal });
        const body = (await res.json()) as { available: boolean; suggestions: AddressSuggestion[] };
        if (!body.available) {
          setAvailable(false);
          close();
          return;
        }
        cache.current.set(key, body.suggestions);
        show(body.suggestions, text, browsing);
      } catch {
        // Replaced by newer typing, or offline: no suggestions this time.
      }
    }, DEBOUNCE_MS);
  }

  function pick(s: AddressSuggestion) {
    if (s.kind === "street") {
      const text = `${s.street} `;
      picked.current = { street: s.street, postcode: s.postcode };
      onPick({ address: text, postcode: s.postcode, heinum: null });
      suggest(text);
      requestAnimationFrame(() => {
        const el = inputRef.current;
        el?.focus();
        el?.setSelectionRange(text.length, text.length);
      });
      return;
    }
    picked.current = null;
    onPick({ address: s.label, postcode: s.postcode, heinum: s.heinum });
    setItems([]);
    setHint(null);
    setStatus("");
    close();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const n = items.length;
    if (e.key === "ArrowDown" && n) {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((a) => (open ? (a + 1) % n : 0));
    } else if (e.key === "ArrowUp" && n && open) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? n - 1 : a - 1));
    } else if (e.key === "Enter" && open && active >= 0 && active < n) {
      e.preventDefault(); // pick, don't submit the form
      pick(items[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close();
    }
  }

  const expanded = available && open && (items.length > 0 || noMatch);
  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <>
      <div className="addr-ac">
        <input
          ref={inputRef}
          id={id}
          className={`form-control${invalid ? " is-invalid" : ""}`}
          required
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            suggest(e.target.value);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            scrolledIntoView.current = false;
            if (items.length) setOpen(true);
          }}
          onBlur={close}
          autoComplete={available ? "off" : "street-address"}
          autoCapitalize="words"
          spellCheck={false}
          {...(available && {
            role: "combobox",
            "aria-autocomplete": "list" as const,
            "aria-expanded": expanded,
            "aria-controls": listId,
            "aria-activedescendant": expanded && active >= 0 ? optionId(active) : undefined,
            "aria-describedby": `${id}-help`,
          })}
        />
        {available && (
          <div className="addr-ac-pop" hidden={!expanded}>
            {hint && <p className="addr-ac-hint">{hint}</p>}
            <ul id={listId} role="listbox" aria-label={t.addrListLabel} className="addr-ac-list" hidden={!items.length}>
              {items.map((s, i) => (
                <li
                  key={`${s.kind}:${s.kind === "street" ? s.street : s.label}:${s.postcode}`}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  aria-label={
                    s.kind === "street" ? `${s.street}, ${t.addrStreet}, ${s.postcode} ${s.town}` : `${s.label}, ${s.postcode} ${s.town}`
                  }
                  className={`addr-ac-option${i === active ? " is-active" : ""}`}
                  onMouseDown={(e) => e.preventDefault()} // keep focus in the field
                  onClick={() => pick(s)}
                >
                  <i className={`bi ${s.kind === "street" ? "bi-signpost-split" : "bi-geo-alt"} addr-ac-icon`} aria-hidden />
                  <span className="addr-ac-text">
                    <span className="addr-ac-main">
                      <Highlight text={s.kind === "street" ? s.street : s.label} typed={value} />
                    </span>
                    <span className="addr-ac-sub">
                      {s.kind === "street" && `${t.addrStreet} · `}
                      {s.postcode} {s.town}
                    </span>
                  </span>
                  {s.kind === "street" && <i className="bi bi-chevron-right addr-ac-more" aria-hidden />}
                </li>
              ))}
            </ul>
            {noMatch && <p className="addr-ac-empty">{t.addrNoMatch}</p>}
            <p className="addr-ac-source">{t.addrSource}</p>
          </div>
        )}
        <div className="visually-hidden" role="status" aria-live="polite">
          {status}
        </div>
      </div>
      {available && (
        <div id={`${id}-help`} className="form-text">
          {t.addrHelp}
        </div>
      )}
    </>
  );
}

/** Marks the part of `text` that matches the typed street, compared by search key: "thorun" marks "Þórun". */
function Highlight({ text, typed }: { text: string; typed: string }) {
  const range = matchRange(text, parseAddressQuery(typed).street);
  if (!range) return <>{text}</>;
  const [from, to] = range;
  return (
    <>
      {text.slice(0, from)}
      <mark className="addr-ac-mark">{text.slice(from, to)}</mark>
      {text.slice(to)}
    </>
  );
}

function matchRange(text: string, key: string): [number, number] | null {
  if (!key) return null;
  for (let from = 0; from < text.length; from++) {
    if (from > 0 && !/[\s\-/.]/.test(text[from - 1])) continue; // matches start at a word
    for (let to = from + 1; to <= text.length; to++) {
      const k = normalizeAddressText(text.slice(from, to));
      if (k.length < key.length) continue;
      if (k.startsWith(key)) return [from, to];
      break;
    }
  }
  return null;
}
