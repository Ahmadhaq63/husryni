"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

/**
 * Menu button and drop-down panel for the site header below the lg breakpoint.
 * The root layout stays mounted across navigations, so the panel closes itself when a link in it
 * is followed, when the route changes, on Escape and on a tap outside.
 */
export default function MobileMenu({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [shownFor, setShownFor] = useState(pathname);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={root} className="sh-menu">
      <button
        ref={button}
        type="button"
        className="sh-menu-btn"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <i className={`bi ${open ? "bi-x-lg" : "bi-list"}`} aria-hidden />
      </button>
      <div className="sh-menu-scrim" hidden={!open} aria-hidden onClick={() => setOpen(false)} />
      <div
        id={panelId}
        className="sh-menu-panel"
        hidden={!open}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
      >
        <div className="container">{children}</div>
      </div>
    </div>
  );
}
