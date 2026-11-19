"use client";

/**
 * Public API of the 3D scenes. Pages import only from here.
 *
 * The scenes are client-only and lazy-loaded with next/dynamic, so three.js never reaches the
 * server bundle or pages that don't show a scene. While a scene loads, when WebGL is unavailable
 * and in print, a static SVG drawing of the same house is shown instead. Everything a scene shows
 * is also available as text: the hero's labels in a visually hidden list, the condition map's
 * items in a list below the canvas, grouped under legend entries (colour, label, count).
 */
import dynamic from "next/dynamic";
import { useMemo, useState, type CSSProperties } from "react";
import type { Grade } from "@/lib/types";
import type { MapPin } from "./ConditionMapScene";
import { TONES, TONE_GLYPH, TONE_RANK, TONE_SIZE, readableOn, toneColor, toneOf, type Tone } from "./conditionVisual";
import StaticHouse from "./StaticHouse";
import { DRONE_UI_EN, flyToItem, type DroneUi } from "./flyTo";

export { DRONE_UI_EN, FLY_EVENT, flyToItem, type DroneUi } from "./flyTo";

/** Hotspots the landing-page hero highlights. */
export type HeroLabelKey = "roof" | "windows" | "facade" | "foundation" | "wetRooms" | "technical";

export interface HouseHeroProps {
  /** Translated description of the scene for screen readers. */
  ariaLabel: string;
  /** Translated short labels for the hero hotspots. */
  labels: Record<HeroLabelKey, string>;
  /** What we check at each hotspot. When given, the labels fly the camera there and show it. */
  details?: Record<HeroLabelKey, string>;
  ui?: HeroUi;
  className?: string;
}

/** Translated labels for the hero's drone close-ups. */
export interface HeroUi {
  back: string;
  explore: string;
  check: string;
}

export type ConditionItemState = "analyzed" | "skipped" | "pending";

export interface ConditionMapItem {
  /** Checklist item key (src/lib/checklist.ts), e.g. "roof", "windows_int". */
  key: string;
  /** Translated item title. */
  title: string;
  /** Worst grade among the item's active (non-rejected) findings; null when it has none. */
  grade: Grade | null;
  state: ConditionItemState;
  /** The item's most serious findings (title and grade), shown when the drone flies to it. */
  findings?: { title: string; grade: Grade }[];
}

export interface ConditionMapProps {
  items: ConditionMapItem[];
  /** Translated description of the scene for screen readers. */
  ariaLabel: string;
  /** Translated legend labels. "ok" = analysed with no findings. */
  legend: Record<Grade | "ok" | "skipped" | "pending", string>;
  /** "See in report" scrolls to the element with id `${anchorPrefix}${item.key}`. Default "item-". */
  anchorPrefix?: string;
  className?: string;
  /** Labels for the drone camera (click a marker to fly to it, or tour the problem areas). */
  ui?: DroneUi;
}

const HERO_KEYS: HeroLabelKey[] = ["roof", "windows", "facade", "foundation", "wetRooms", "technical"];

const HouseHeroScene = dynamic(() => import("./HouseHeroScene"), {
  ssr: false,
  loading: () => (
    <div className="three-stage three-hero-stage" data-status="loading">
      <StaticHouse variant="hero" className="three-fallback" />
    </div>
  ),
});

const ConditionMapScene = dynamic(() => import("./ConditionMapScene"), {
  ssr: false,
  loading: () => (
    <div className="three-stage cmap-stage" data-status="loading">
      <StaticHouse variant="map" className="three-fallback" />
    </div>
  ),
});

/** Landing-page hero: the house with an "AI scan" sweeping through it and six labelled hotspots. */
export function HouseHero({ ariaLabel, labels, details, ui, className }: HouseHeroProps) {
  // With details the labels are real buttons inside the scene; the scene's canvas carries the description.
  if (details) {
    return (
      <div className={`three-hero${className ? ` ${className}` : ""}`}>
        <div className="three-hero-frame">
          <HouseHeroScene labels={labels} details={details} ui={ui} ariaLabel={ariaLabel} />
        </div>
      </div>
    );
  }
  return (
    <div className={`three-hero${className ? ` ${className}` : ""}`}>
      <div className="three-hero-frame" role="img" aria-label={ariaLabel}>
        <HouseHeroScene labels={labels} />
      </div>
      <ul className="visually-hidden">
        {HERO_KEYS.map((k) => (
          <li key={k}>{labels[k]}</li>
        ))}
      </ul>
    </div>
  );
}

function Glyph({ tone }: { tone: Tone }) {
  const g = TONE_GLYPH[tone];
  return g.icon ? <i className={`bi ${g.icon}`} /> : <>{g.text}</>;
}

/** Report condition map: one hotspot per checklist item, coloured by grade, plus legend and list. */
export function ConditionMap3D({ items, ariaLabel, legend, anchorPrefix = "item-", className, ui = DRONE_UI_EN }: ConditionMapProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const pins = useMemo<MapPin[]>(
    () =>
      items.map((it) => {
        const tone = toneOf(it);
        const color = toneColor(tone);
        return {
          key: it.key,
          title: it.title,
          tone,
          color,
          fg: readableOn(color),
          size: TONE_SIZE[tone],
          rank: TONE_RANK[tone],
          label: `${it.title}: ${legend[tone]}`,
          stateLabel: legend[tone],
          findings: it.findings ?? [],
        };
      }),
    [items, legend],
  );

  /** Items grouped by state, most serious first; each group header is a legend entry. */
  const groups = useMemo(() => {
    const byTone = new Map<Tone, MapPin[]>();
    for (const p of pins) byTone.set(p.tone, [...(byTone.get(p.tone) ?? []), p]);
    return [...TONES]
      .sort((a, b) => TONE_RANK[b] - TONE_RANK[a])
      .filter((t) => byTone.has(t))
      .map((tone) => ({ tone, items: byTone.get(tone)! }));
  }, [pins]);

  return (
    <div className={`cmap${className ? ` ${className}` : ""}`}>
      <ConditionMapScene
        pins={pins}
        ariaLabel={ariaLabel}
        anchorPrefix={anchorPrefix}
        activeKey={activeKey}
        onActiveKeyChange={setActiveKey}
        ui={ui}
      />
      {groups.length > 0 && (
        <ul className="cmap-groups">
          {groups.map(({ tone, items: list }) => {
            const color = toneColor(tone);
            return (
              <li key={tone} className="cmap-group" data-tone={tone}>
                <span className="cmap-group-head">
                  <span className="cmap-key" style={{ "--pin": color, "--pin-fg": readableOn(color) } as CSSProperties} aria-hidden="true">
                    <Glyph tone={tone} />
                  </span>
                  <span className="cmap-group-label">{legend[tone]}</span>
                  <span className="cmap-count">{list.length}</span>
                </span>
                <ul className="cmap-group-items">
                  {list.map((p) => (
                    <li
                      key={p.key}
                      className={p.key === activeKey ? "is-active" : undefined}
                      onMouseEnter={() => setActiveKey(p.key)}
                      onMouseLeave={() => setActiveKey(null)}
                    >
                      <button type="button" className="cmap-item-fly" onClick={() => flyToItem(p.key)}>
                        {p.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
