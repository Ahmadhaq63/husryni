"use client";

/**
 * Report condition map: the house as a cut-away model (walls and roof facing the camera fade to
 * outlines) with one HTML pin per checklist item, coloured by grade. Pins are real buttons:
 * focusable, arrow keys move between them, and clicking scrolls to the item in the report.
 * Loaded lazily through index.tsx.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import * as THREE from "three";
import { resolveAnchors } from "./anchors";
import { TONE_GLYPH, type Tone } from "./conditionVisual";
import { buildHouse, disposeObject } from "./houseModel";
import { VIEW, type Vec3 } from "./houseSpec";
import { createStage, frameView, housePoints, type Stage } from "./stage";
import StaticHouse, { type StaticPin } from "./StaticHouse";

export interface MapPin {
  key: string;
  title: string;
  tone: Tone;
  color: string;
  fg: string;
  size: number;
  rank: number;
  /** "Title: legend label", the pin's accessible name. */
  label: string;
  stateLabel: string;
}

interface Props {
  pins: MapPin[];
  ariaLabel: string;
  anchorPrefix: string;
  activeKey: string | null;
  onActiveKeyChange: (key: string | null) => void;
}

type Status = "loading" | "ready" | "failed";

const ELEVATION = THREE.MathUtils.degToRad(26);
const FLASH_CLASS = "condition-target-flash";
/** Text stand-ins for the icon glyphs in the SVG drawing. */
const STATIC_GLYPH: Partial<Record<Tone, string>> = { ok: "✓", skipped: "–", pending: "…" };
const flashTimers = new WeakMap<HTMLElement, number>();

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Scrolls to the item's section in the report and briefly highlights it. */
function goToItem(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  // Open collapsed sections on the way, or there is nothing to scroll to.
  for (let d = el.closest("details:not([open])"); d; d = d.parentElement?.closest("details:not([open])") ?? null) {
    (d as HTMLDetailsElement).open = true;
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.classList.remove(FLASH_CLASS);
  void el.offsetWidth; // restart the animation when clicked twice
  el.classList.add(FLASH_CLASS); // also sets scroll-margin-top, read by scrollIntoView
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  // Move keyboard focus along, like an in-page link.
  if (!el.matches("a[href], button, input, select, textarea, [tabindex]")) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
  window.clearTimeout(flashTimers.get(el));
  flashTimers.set(
    el,
    window.setTimeout(() => el.classList.remove(FLASH_CLASS), 1600),
  );
}

export default function ConditionMapScene({ pins, ariaLabel, anchorPrefix, activeKey, onActiveKeyChange }: Props) {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const pinEls = useRef(new Map<string, HTMLButtonElement>());
  const leaderEls = useRef(new Map<string, SVGGElement>());
  const tipRef = useRef<HTMLDivElement>(null);
  const invalidateRef = useRef<() => void>(() => {});
  const [status, setStatus] = useState<Status>("loading");
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const anchors = useMemo(() => resolveAnchors(pins.map((p) => p.key)), [pins]);
  /** Pins that have a place on the house, most serious first (tab order and stacking). */
  const placed = useMemo(
    () => pins.filter((p) => anchors.has(p.key)).sort((a, b) => b.rank - a.rank),
    [pins, anchors],
  );
  const staticPins = useMemo<StaticPin[]>(
    () =>
      [...placed].reverse().map((p) => ({
        key: p.key,
        at: anchors.get(p.key) as Vec3,
        color: p.color,
        fg: p.fg,
        size: p.size,
        glyph: TONE_GLYPH[p.tone].text ?? STATIC_GLYPH[p.tone] ?? "",
      })),
    [placed, anchors],
  );

  // The render loop reads the latest props through refs.
  const live = useRef({ placed, anchors, activeKey });
  live.current = { placed, anchors, activeKey };
  useEffect(() => {
    invalidateRef.current();
  }, [placed, anchors, activeKey]);

  const tabKey = focusKey && placed.some((p) => p.key === focusKey) ? focusKey : placed[0]?.key;
  const active = placed.find((p) => p.key === activeKey) ?? null;

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    const model = buildHouse({ palette: "map", interior: true });
    const points = housePoints();
    // With reduced motion, walls switch between solid and faded without a transition.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const camDir = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const anchorVec = new Map<string, THREE.Vector3>();
    let stage: Stage | null = null;
    let first = true;
    let lastTime = -1;

    const frame = () => {
      if (!stage) return;
      const fit = frameView(stage.camera, points, VIEW.azimuth, ELEVATION, { x: 0.05, y: 0.08 });
      stage.controls.target.copy(fit.target);
      stage.controls.update();
    };

    /** Fade the walls and roof slopes that face the camera. Returns true while still fading. */
    const updateGhosts = (dt: number, snap: boolean) => {
      if (!stage) return false;
      camDir.copy(stage.camera.position).sub(stage.controls.target).normalize();
      let moving = false;
      for (const g of model.ghostables) {
        const target = smoothstep(0.08, 0.36, g.normal.dot(camDir));
        g.amount = snap ? target : g.amount + (target - g.amount) * (1 - Math.exp(-dt * 9));
        if (Math.abs(target - g.amount) > 0.003) moving = true;
        else g.amount = target;
        for (const m of g.materials) {
          m.opacity = 1 - g.amount * (1 - g.minOpacity);
          m.depthWrite = g.amount < 0.5;
        }
        g.lines.opacity = g.amount * 0.6;
      }
      return moving;
    };

    const place = () => {
      if (!stage) return;
      const { width, height } = stage.size;
      const { camera } = stage;
      const { placed: list, anchors: anchorMap, activeKey: act } = live.current;
      const nodes = list.map((p) => {
        let v = anchorVec.get(p.key);
        const a = anchorMap.get(p.key);
        if (a && (!v || v.x !== a[0] || v.y !== a[1] || v.z !== a[2])) {
          v = new THREE.Vector3(...a);
          anchorVec.set(p.key, v);
        }
        tmp.copy(v ?? tmp.set(0, 0, 0)).project(camera);
        const ax = ((tmp.x + 1) / 2) * width;
        const ay = ((1 - tmp.y) / 2) * height;
        return { key: p.key, ax, ay, x: ax, y: ay, r: p.size / 2 + 1.5, w: p.rank + 1 };
      });
      // Nudge overlapping pins apart; more serious pins move less.
      for (let iter = 0; iter < 10; iter++) {
        let moved = false;
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i];
            const b = nodes[j];
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let d = Math.hypot(dx, dy);
            const min = a.r + b.r;
            if (d >= min) continue;
            if (d < 0.01) {
              dx = 1;
              dy = 0.3;
              d = Math.hypot(dx, dy);
            }
            const push = (min - d) / d;
            const wa = b.w / (a.w + b.w);
            const wb = a.w / (a.w + b.w);
            a.x -= dx * push * wa;
            a.y -= dy * push * wa;
            b.x += dx * push * wb;
            b.y += dy * push * wb;
            moved = true;
          }
        }
        if (!moved) break;
      }
      for (const n of nodes) {
        n.x = Math.max(n.r, Math.min(width - n.r, n.x));
        n.y = Math.max(n.r, Math.min(height - n.r, n.y));
        const el = pinEls.current.get(n.key);
        if (el) el.style.transform = `translate3d(${n.x.toFixed(1)}px, ${n.y.toFixed(1)}px, 0)`;
        const leader = leaderEls.current.get(n.key);
        if (leader) {
          const off = Math.hypot(n.x - n.ax, n.y - n.ay) > n.r * 0.6;
          leader.style.display = off ? "" : "none";
          if (off) {
            const [line, dot] = leader.children as unknown as [SVGLineElement, SVGCircleElement];
            line.setAttribute("x1", n.ax.toFixed(1));
            line.setAttribute("y1", n.ay.toFixed(1));
            line.setAttribute("x2", n.x.toFixed(1));
            line.setAttribute("y2", n.y.toFixed(1));
            dot.setAttribute("cx", n.ax.toFixed(1));
            dot.setAttribute("cy", n.ay.toFixed(1));
          }
        }
      }
      // Tooltip above the active pin (below it near the top edge).
      const tip = tipRef.current;
      const node = act ? nodes.find((n) => n.key === act) : undefined;
      if (tip && node) {
        const tw = tip.offsetWidth;
        const th = tip.offsetHeight;
        const above = node.y - node.r - 10 - th >= 4;
        const tx = Math.max(4, Math.min(width - tw - 4, node.x - tw / 2));
        const ty = above ? node.y - node.r - 10 - th : node.y + node.r + 10;
        tip.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
        tip.dataset.placement = above ? "top" : "bottom";
      }
    };

    stage = createStage({
      host,
      polar: [THREE.MathUtils.degToRad(46), THREE.MathUtils.degToRad(84)],
      ground: "#e9eeec",
      onResize: () => {
        frame();
        updateGhosts(0, true);
      },
      onLost: () => setStatus("failed"),
      onFrame: (_dt, t) => {
        const dt = lastTime < 0 ? 0 : t - lastTime;
        lastTime = t;
        return updateGhosts(dt, reduced);
      },
      afterRender: () => {
        place();
        if (first) {
          first = false;
          setStatus("ready");
        }
      },
    });
    if (!stage) {
      disposeObject(model.group);
      setStatus("failed");
      return;
    }
    stage.scene.add(model.group);
    invalidateRef.current = stage.invalidate;
    stage.invalidate();

    return () => {
      invalidateRef.current = () => {};
      stage?.dispose();
      stage = null;
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = placed.length - 1;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? index === last
          ? 0
          : index + 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? index === 0
            ? last
            : index - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    e.preventDefault();
    const key = placed[next].key;
    setFocusKey(key);
    pinEls.current.get(key)?.focus();
  };

  return (
    <div className="three-stage cmap-stage" data-status={status}>
      <StaticHouse variant="map" className="three-fallback" pins={staticPins} />
      <div ref={canvasHostRef} className="three-canvas-host" role="img" aria-label={ariaLabel} />
      {status !== "failed" && (
        <>
          <svg className="cmap-leaders" aria-hidden="true">
            {placed.map((p) => (
              <g
                key={p.key}
                style={{ display: "none" }}
                ref={(el) => {
                  if (el) leaderEls.current.set(p.key, el);
                  else leaderEls.current.delete(p.key);
                }}
              >
                <line />
                <circle r={2.6} />
              </g>
            ))}
          </svg>
          <div className="cmap-pins" role="toolbar" aria-label={ariaLabel} aria-orientation="horizontal">
            {placed.map((p, i) => {
              const glyph = TONE_GLYPH[p.tone];
              return (
                <button
                  key={p.key}
                  type="button"
                  className={`cmap-pin${p.key === activeKey ? " is-active" : ""}`}
                  data-tone={p.tone}
                  style={
                    {
                      "--pin": p.color,
                      "--pin-fg": p.fg,
                      "--pin-size": `${p.size}px`,
                      zIndex: p.key === activeKey ? 100 : 10 + p.rank,
                    } as CSSProperties
                  }
                  tabIndex={p.key === tabKey ? 0 : -1}
                  aria-label={p.label}
                  ref={(el) => {
                    if (el) pinEls.current.set(p.key, el);
                    else pinEls.current.delete(p.key);
                  }}
                  onClick={() => goToItem(`${anchorPrefix}${p.key}`)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  onFocus={() => {
                    setFocusKey(p.key);
                    onActiveKeyChange(p.key);
                  }}
                  onBlur={() => onActiveKeyChange(null)}
                  onMouseEnter={() => onActiveKeyChange(p.key)}
                  onMouseLeave={() => onActiveKeyChange(null)}
                >
                  <span className="cmap-pin-dot" aria-hidden="true">
                    {glyph.icon ? <i className={`bi ${glyph.icon}`} /> : glyph.text}
                  </span>
                </button>
              );
            })}
          </div>
          <div ref={tipRef} className={`cmap-tip${active ? " is-visible" : ""}`} aria-hidden="true">
            {active && (
              <>
                <span className="cmap-tip-title">{active.title}</span>
                <span className="cmap-tip-state">
                  <span className="cmap-swatch" style={{ "--pin": active.color } as CSSProperties} />
                  {active.stateLabel}
                </span>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
