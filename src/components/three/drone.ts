/**
 * Camera flights for the 3D scenes, like a drone: the camera climbs along an arc, banks a little
 * into the turn, eases onto the new viewpoint and hovers there for a moment. Orbit controls are off
 * while flying and resume around the new target. With reduced motion the camera cuts instead.
 */
import * as THREE from "three";
import type { Stage } from "./stage";

export interface Pose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export interface FlightOptions {
  /** Seconds. Default: from the length of the flight. */
  duration?: number;
  /** Extra height at the middle of the path, in metres. Default: from the length of the flight. */
  lift?: number;
  /** Hover gently after arriving. */
  hover?: boolean;
  /** Called once on arrival (not when the flight is cancelled). */
  onArrive?: () => void;
}

export interface Drone {
  flyTo: (to: Pose, opts?: FlightOptions) => void;
  /** Stop where the camera is and hand control back to the user. */
  cancel: () => void;
  /** Advance; call from the stage's onFrame. True while flying or hovering. */
  update: (dt: number) => boolean;
  flying: () => boolean;
}

const MAX_ROLL = THREE.MathUtils.degToRad(5);
const UP = new THREE.Vector3(0, 1, 0);

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** The view settles on the destination a little before the camera arrives, as a pilot would look ahead. */
const easeOutLead = (t: number) => 1 - (1 - Math.min(1, t * 1.18)) ** 3;

export function createDrone(stage: Stage, reduced: () => boolean): Drone {
  const { camera, controls } = stage;
  let flight: {
    p0: THREE.Vector3;
    p1: THREE.Vector3;
    p2: THREE.Vector3;
    t0: THREE.Vector3;
    t2: THREE.Vector3;
    elapsed: number;
    duration: number;
    hover: boolean;
    onArrive?: () => void;
  } | null = null;
  let hoverT = -1;
  let bobPrev = 0;
  const pos = new THREE.Vector3();
  const prev = new THREE.Vector3();
  const look = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const right = new THREE.Vector3();
  const fwd = new THREE.Vector3();

  const bezier = (out: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, t: number) => {
    const u = 1 - t;
    return out
      .copy(a)
      .multiplyScalar(u * u)
      .addScaledVector(b, 2 * u * t)
      .addScaledVector(c, t * t);
  };

  const land = (to: Pose) => {
    camera.position.copy(to.position);
    controls.target.copy(to.target);
    camera.up.copy(UP);
    camera.lookAt(to.target);
    controls.enabled = true;
    controls.update();
  };

  return {
    flyTo(to, opts = {}) {
      hoverT = -1;
      bobPrev = 0;
      if (reduced()) {
        flight = null;
        land(to);
        opts.onArrive?.();
        stage.invalidate();
        return;
      }
      const p0 = camera.position.clone();
      const t0 = controls.target.clone();
      const span = p0.distanceTo(to.position) + t0.distanceTo(to.target) * 0.5;
      const lift = opts.lift ?? THREE.MathUtils.clamp(span * 0.2, 0.5, 4.5);
      const p1 = p0.clone().add(to.position).multiplyScalar(0.5).addScaledVector(UP, lift);
      flight = {
        p0,
        p1,
        p2: to.position.clone(),
        t0,
        t2: to.target.clone(),
        elapsed: 0,
        duration: opts.duration ?? THREE.MathUtils.clamp(1.15 + span * 0.055, 1.2, 2.6),
        hover: opts.hover ?? true,
        onArrive: opts.onArrive,
      };
      controls.enabled = false;
      stage.invalidate();
    },

    cancel() {
      if (!flight) return;
      flight = null;
      controls.target.copy(look);
      camera.up.copy(UP);
      camera.lookAt(look);
      controls.enabled = true;
      controls.update();
    },

    update(dt) {
      if (flight) {
        const f = flight;
        f.elapsed += dt;
        const t = Math.min(1, f.elapsed / f.duration);
        prev.copy(camera.position);
        bezier(pos, f.p0, f.p1, f.p2, easeInOutCubic(t));
        look.copy(f.t0).lerp(f.t2, easeOutLead(t));
        camera.position.copy(pos);
        camera.up.copy(UP);
        camera.lookAt(look);
        // Bank into the turn: roll by the sideways part of the velocity, most in mid-flight.
        if (dt > 0) {
          vel.copy(pos).sub(prev).divideScalar(dt).setY(0);
          camera.getWorldDirection(fwd);
          right.crossVectors(fwd, UP).normalize();
          const sideways = THREE.MathUtils.clamp(vel.dot(right) / 12, -1, 1);
          camera.rotateZ(-sideways * MAX_ROLL * Math.sin(Math.PI * t));
        }
        controls.target.copy(look);
        if (t >= 1) {
          flight = null;
          land({ position: f.p2, target: f.t2 });
          if (f.hover) hoverT = 0;
          f.onArrive?.();
        }
        return true;
      }
      // Hover: a small, fading bob after arriving, as a drone holding position.
      if (hoverT >= 0) {
        if (stage.interacting()) {
          hoverT = -1;
          bobPrev = 0;
          return false;
        }
        hoverT += dt;
        const bob = 0.05 * Math.exp(-hoverT / 2.4) * Math.sin((hoverT / 2.2) * Math.PI * 2);
        camera.position.y += bob - bobPrev;
        bobPrev = bob;
        if (hoverT > 7) {
          camera.position.y -= bobPrev;
          hoverT = -1;
          bobPrev = 0;
        }
        return hoverT >= 0;
      }
      return false;
    },

    flying: () => flight !== null,
  };
}
