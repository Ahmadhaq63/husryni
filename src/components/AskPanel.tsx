"use client";

import { useEffect, useRef, useState } from "react";
import { getDict } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

interface Turn {
  role: "user" | "assistant";
  text: string;
}

// Minimal typing for the Web Speech API (not in TypeScript's DOM lib everywhere).
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionCtor = new () => Recognition;

/**
 * "Ask about the property": a chat grounded in this report and its history (Claude; rule-based answers in
 * demo mode). Typed or spoken (Icelandic speech where the browser supports it).
 */
export default function AskPanel({ inspectionId, lang, demo }: { inspectionId: string; lang: Lang; demo: boolean }) {
  const t = getDict(lang);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speech, setSpeech] = useState<RecognitionCtor | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<Recognition | null>(null);
  // Speech results arrive later: call the latest send(), with the conversation as it is then.
  const sendRef = useRef<(text: string) => Promise<void>>(async () => {});

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    setSpeech(() => w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null);
  }, []);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [turns, busy]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...turns, { role: "user" as const, text: q }];
    setTurns(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/inspections/${inspectionId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12) }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.answer) {
        // Unanswered: take the question back out of the conversation and put it back in the box to retry.
        setTurns(turns);
        setInput(q);
        setError(body?.error?.[lang] ?? t.error);
        return;
      }
      setTurns([...next, { role: "assistant", text: body.answer as string }]);
    } finally {
      setBusy(false);
    }
  }

  sendRef.current = send;

  function listen() {
    if (!speech) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new speech();
    rec.lang = lang === "is" ? "is-IS" : "en-GB";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const said = e.results[0]?.[0]?.transcript ?? "";
      if (said) void sendRef.current(said);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  const chips = [t.askQ1, t.askQ2, t.askQ3, t.askQ4];

  return (
    <>
      <button type="button" className={`ask-fab no-print${open ? " is-open" : ""}`} aria-expanded={open} aria-controls="ask-panel" onClick={() => setOpen(!open)}>
        <i className={`bi ${open ? "bi-x-lg" : "bi-chat-dots"}`} aria-hidden />
        <span>{open ? t.askClose : t.askOpen}</span>
      </button>
      {open && (
        <section id="ask-panel" className="ask-panel no-print" role="dialog" aria-modal="false" aria-labelledby="ask-title">
          <header className="ask-panel__head">
            <div>
              <h2 id="ask-title" className="ask-panel__title">
                <i className="bi bi-stars" aria-hidden />
                {t.askTitle}
              </h2>
              <p className="ask-panel__lead">{demo ? t.askDemo : t.askLead}</p>
            </div>
            <button type="button" className="btn-close" aria-label={t.askClose} onClick={() => setOpen(false)} />
          </header>
          <div className="ask-panel__msgs" ref={listRef} aria-live="polite">
            {turns.length === 0 && (
              <div className="ask-panel__chips">
                {chips.map((c) => (
                  <button key={c} type="button" className="ask-chip" onClick={() => send(c)} disabled={busy}>
                    {c}
                  </button>
                ))}
              </div>
            )}
            {turns.map((m, i) => (
              <div key={i} className={`ask-msg ask-msg--${m.role}`}>
                {m.role === "assistant" ? <Rich text={m.text} /> : m.text}
              </div>
            ))}
            {busy && (
              <div className="ask-msg ask-msg--assistant ask-msg--busy" role="status">
                <span className="spinner-grow spinner-grow-sm me-2" aria-hidden />
                {t.askThinking}
              </div>
            )}
            {error && (
              <div className="rp-callout rp-callout--danger" role="alert">
                <i className="bi bi-exclamation-circle" aria-hidden />
                <div>{error}</div>
              </div>
            )}
          </div>
          <form
            className="ask-panel__form"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <label className="visually-hidden" htmlFor="ask-input">
              {t.askPh}
            </label>
            <textarea
              id="ask-input"
              ref={inputRef}
              className="form-control"
              rows={2}
              maxLength={2000}
              placeholder={listening ? t.askListening : t.askPh}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
            />
            <div className="ask-panel__actions">
              {speech && (
                <button type="button" className={`btn btn-outline-secondary${listening ? " active" : ""}`} onClick={listen} aria-pressed={listening}>
                  <i className={`bi ${listening ? "bi-mic-fill" : "bi-mic"} me-1`} aria-hidden />
                  {listening ? t.askListening : t.askMic}
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={busy || !input.trim()}>
                <i className="bi bi-send me-1" aria-hidden />
                {t.askSend}
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}

/** Answers are plain text; if the model still writes **bold**, show it as bold rather than asterisks (no HTML injection). */
function Rich({ text }: { text: string }) {
  const parts = text.replace(/^#+\s*/gm, "").split(/\*\*(.+?)\*\*/g);
  return <>{parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p))}</>;
}
