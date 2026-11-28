'use client';

// Each status's signature on a game character (docs/specs/008-canvas/avatar-mode.md "Status", 3d-engine.md
// "Characters"): small, life-sized, low-poly props in the scene's look, built in code like the held drinks. Head props
// hang on an anchor at the head bone, kept in the character's own axes (x across, y the way it faces, z up) as the head
// was when dressed, so they turn and bob with it; hand props go in the hand where a drink goes. Each status's props are
// built once (a template per status, shared geometry and materials) and cloned onto a character the first time it
// wears that status. Nothing here changes the character's own model.

import * as THREE from 'three';
import type { AvatarStatus } from '@livehuddle/avatar/status';
import type { GameFigure } from './game-figure';
import { solidBothSides } from './figure-mark';

/** A status's hand prop, carried like a drink, or null for a status with none. */
export type StatusHandProp = 'sandwich' | 'bottle' | 'phone';

/** Which hand prop a status carries (the phone is held to the ear, the others at the waist). */
export function statusHandProp(status: AvatarStatus | null | undefined): StatusHandProp | null {
  if (status === 'lunch') return 'sandwich';
  if (status === 'break') return 'bottle';
  if (status === 'busy') return 'phone';
  return null;
}

/** The head props each status wears (none for the hand-only statuses and Away, whose Zz is drawn over the scene). */
const HEAD_PROPS: Partial<Record<AvatarStatus, readonly string[]>> = {
  available: ['sparkle'],
  help: ['question'],
  dnd: ['no-entry'],
  focus: ['headphones'],
  meeting: ['headset'],
  angry: ['steam'],
  celebrating: ['party-hat', 'confetti'],
  thinking: ['thought'],
  sick: ['ice-pack', 'sweat'],
};

/** The head props a status wears, by name (pure, for tests). */
export function headPropsOf(status: AvatarStatus | null | undefined): readonly string[] {
  return (status && HEAD_PROPS[status]) || [];
}

// --- Sizes ------------------------------------------------------------------------------------------------------
// In sprite px about the head bone's origin, in the character's axes. The head (hair included) reaches HEAD_TOP above
// the origin; its middle is HEAD_MID up, HEAD_R its half width at the ears. Measured on both packs' heads.
const HEAD_TOP = 2.6;
const HEAD_MID = 1.55;
const HEAD_R = 1.2;

// --- Materials, shared by every prop -----------------------------------------------------------------------------
const mats = new Map<number, THREE.Material>();
const lam = (c: number) => {
  let m = mats.get(c);
  if (!m) mats.set(c, (m = solidBothSides(new THREE.MeshLambertMaterial({ color: c }))));
  return m;
};
/** Unlit, for what glows (the sparkle, a lit thought dot, the phone's screen). */
const glow = (c: number) => {
  const key = c + 0x1000000;
  let m = mats.get(key);
  if (!m) mats.set(key, (m = solidBothSides(new THREE.MeshBasicMaterial({ color: c }))));
  return m;
};

function mesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  at: [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...at);
  m.castShadow = true;
  return m;
}

/** A cylinder standing along z (three's stand along y). */
function zCylinder(rTop: number, rBottom: number, h: number, seg = 14): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(rTop, rBottom, h, seg).rotateX(Math.PI / 2);
}

// --- Head props ---------------------------------------------------------------------------------------------------

function headphones(): THREE.Object3D {
  const g = new THREE.Group();
  // The band over the crown, ear to ear, standing just proud of the hair.
  const band = mesh(
    new THREE.TorusGeometry(HEAD_R + 0.28, 0.17, 6, 20, Math.PI).rotateX(Math.PI / 2),
    lam(0x1f2937),
    [0, 0, HEAD_MID + 0.2],
  );
  band.scale.set(1, 1, (HEAD_TOP - HEAD_MID + 0.1) / (HEAD_R + 0.28));
  g.add(band);
  for (const s of [-1, 1]) {
    const cup = mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 0.45, 16).rotateZ(Math.PI / 2),
      lam(0x8b5cf6),
      [s * (HEAD_R + 0.28), 0, HEAD_MID + 0.15],
    );
    const pad = mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.12, 16).rotateZ(Math.PI / 2),
      lam(0x1f2937),
      [s * (HEAD_R + 0.02), 0, HEAD_MID + 0.15],
    );
    g.add(cup, pad);
  }
  return g;
}

function headset(): THREE.Object3D {
  const g = new THREE.Group();
  const band = mesh(
    new THREE.TorusGeometry(HEAD_R + 0.18, 0.08, 5, 20, Math.PI).rotateX(Math.PI / 2),
    lam(0x334155),
    [0, 0, HEAD_MID + 0.2],
  );
  band.scale.set(1, 1, (HEAD_TOP - HEAD_MID) / (HEAD_R + 0.18));
  g.add(band);
  // One cup, on the left ear; the boom from it round to the mouth, a red tip at its end.
  const x = -(HEAD_R + 0.2);
  g.add(
    mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 14).rotateZ(Math.PI / 2), lam(0x334155), [
      x,
      0,
      HEAD_MID + 0.15,
    ]),
  );
  const boom = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x, 0.1, HEAD_MID),
    new THREE.Vector3(x + 0.1, 0.9, HEAD_MID - 0.6),
    new THREE.Vector3(-0.35, HEAD_R + 0.15, HEAD_MID - 1.2),
  ]);
  g.add(mesh(new THREE.TubeGeometry(boom, 10, 0.07, 5), lam(0x334155)));
  g.add(
    mesh(new THREE.SphereGeometry(0.17, 8, 6), glow(0xef4444), [
      -0.35,
      HEAD_R + 0.15,
      HEAD_MID - 1.2,
    ]),
  );
  return g;
}

function partyHat(): THREE.Object3D {
  const g = new THREE.Group();
  const h = 2.3;
  const stripes = [0xec4899, 0xfacc15, 0x38bdf8, 0xec4899];
  // A cone in four bands, tilted a little to one side, a pompom on its tip.
  stripes.forEach((c, i) => {
    const r0 = 0.95 * (1 - i / stripes.length);
    const r1 = 0.95 * (1 - (i + 1) / stripes.length);
    g.add(
      mesh(zCylinder(r1, r0, h / stripes.length, 14), lam(c), [
        0,
        0,
        (h / stripes.length) * (i + 0.5),
      ]),
    );
  });
  g.add(mesh(new THREE.SphereGeometry(0.28, 10, 8), lam(0xfef3c7), [0, 0, h + 0.1]));
  g.position.set(0.25, 0, HEAD_TOP - 0.35);
  g.rotation.y = 0.22;
  g.userData = { onTop: true };
  return g;
}

const CONFETTI = [0xec4899, 0xfacc15, 0x22c55e, 0x38bdf8, 0xa855f7, 0xf97316, 0xef4444, 0x14b8a6];
function confetti(): THREE.Object3D {
  const g = new THREE.Group();
  g.name = 'confetti';
  const geo = new THREE.PlaneGeometry(0.34, 0.2);
  CONFETTI.forEach((c, i) => {
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide }),
    );
    m.castShadow = false;
    // Each piece's own place round the head and its own phase, kept on it for the fall.
    const a = (i / CONFETTI.length) * Math.PI * 2;
    m.userData = { a, r: HEAD_R + 0.7 + (i % 3) * 0.35, phase: i / CONFETTI.length };
    g.add(m);
  });
  placeConfetti(g, 0.3);
  g.userData = { onTop: true };
  return g;
}
const CONFETTI_FALL = 3.2;
function placeConfetti(g: THREE.Object3D, t: number): void {
  for (const m of g.children) {
    const { a, r, phase } = m.userData as { a: number; r: number; phase: number };
    const f = (t + phase) % 1;
    m.position.set(Math.cos(a + f) * r, Math.sin(a + f) * r, HEAD_TOP + 1.2 - f * CONFETTI_FALL);
    m.rotation.set(f * 9 + a, f * 6, a);
  }
}

function questionMark(): THREE.Object3D {
  const g = new THREE.Group();
  g.name = 'bob';
  const amber = lam(0xf59e0b);
  // The hook: most of a circle, open at the lower left, then a short stem down and the dot.
  const hook = mesh(
    new THREE.TorusGeometry(0.5, 0.17, 6, 16, Math.PI * 1.5).rotateX(Math.PI / 2),
    amber,
    [0, 0, 1.45],
  );
  // Built reading true from behind; `animate` turns it to read true from the front at rest, and slowly round, so it
  // reads from every side in turn (a flat sign has an edge).
  g.add(hook);
  g.add(mesh(zCylinder(0.17, 0.17, 0.45, 8), amber, [0, 0, 0.7]));
  g.add(mesh(new THREE.SphereGeometry(0.2, 10, 8), amber, [0, 0, 0.15]));
  g.position.set(0, 0, HEAD_TOP + 0.35);
  g.userData = { onTop: true };
  return g;
}

function sparkle(): THREE.Object3D {
  const g = new THREE.Group();
  g.name = 'twinkle';
  // A four-point star, front on: two long diamonds crossed, and a small star beside it.
  const star = (size: number) => {
    const s = new THREE.Shape();
    const k = size * 0.22;
    s.moveTo(0, size);
    s.lineTo(k, k);
    s.lineTo(size, 0);
    s.lineTo(k, -k);
    s.lineTo(0, -size);
    s.lineTo(-k, -k);
    s.lineTo(-size, 0);
    s.lineTo(-k, k);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false })
      .translate(0, 0, -0.06)
      .rotateX(Math.PI / 2);
  };
  // Each star crossed with itself a quarter turn round, so it reads from every side.
  const crossed = (size: number, colour: number, at: [number, number, number]) => {
    const one = new THREE.Group();
    one.position.set(...at);
    one.add(mesh(star(size), glow(colour)));
    const across = mesh(star(size), glow(colour));
    across.rotation.z = Math.PI / 2;
    one.add(across);
    return one;
  };
  g.add(crossed(0.62, 0x4ade80, [0, 0, 0]));
  g.add(crossed(0.32, 0x86efac, [0.6, 0, 0.7]));
  g.position.set(HEAD_R + 0.95, 0, HEAD_MID + 1.0);
  return g;
}

function noEntry(): THREE.Object3D {
  const g = new THREE.Group();
  // A red disc, standing, with a white bar across both faces.
  g.name = 'turn';
  g.add(mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.16, 20), lam(0xe11d48)));
  for (const s of [-1, 1])
    g.add(mesh(new THREE.BoxGeometry(1.05, 0.04, 0.3), lam(0xffffff), [0, s * 0.09, 0]));
  g.position.set(HEAD_R + 1.0, 0, HEAD_MID + 0.9);
  return g;
}

function steam(): THREE.Object3D {
  const g = new THREE.Group();
  g.name = 'steam';
  const geo = new THREE.SphereGeometry(0.24, 8, 6);
  for (const s of [-1, 1])
    for (const phase of [0, 1 / 3, 2 / 3]) {
      const puff = new THREE.Mesh(geo, glow(0xf8fafc));
      puff.userData = { s, phase };
      g.add(puff);
    }
  placeSteam(g, 0.25);
  return g;
}
const STEAM_RISE = 1.8;
function placeSteam(g: THREE.Object3D, t: number): void {
  for (const p of g.children) {
    const { s, phase } = p.userData as { s: number; phase: number };
    const f = (t + phase) % 1;
    // Out of the ear, drifting outward as it rises, swelling and then gone.
    p.position.set(s * (HEAD_R + 0.25 + f * 0.7), 0, HEAD_MID + 0.1 + f * STEAM_RISE);
    p.scale.setScalar(Math.max(0.001, Math.sin(Math.PI * f) * (0.7 + f * 0.8)));
  }
}

function thought(): THREE.Object3D {
  const g = new THREE.Group();
  const white = lam(0xffffff);
  // Two small puffs rising to a cloud of three balls, three dots in it lighting in turn.
  g.add(mesh(new THREE.SphereGeometry(0.2, 8, 6), white, [HEAD_R + 0.2, 0, HEAD_TOP - 0.2]));
  g.add(mesh(new THREE.SphereGeometry(0.32, 8, 6), white, [HEAD_R + 0.55, 0, HEAD_TOP + 0.35]));
  const cloud = new THREE.Group();
  cloud.position.set(HEAD_R + 1.15, 0, HEAD_TOP + 1.05);
  cloud.scale.setScalar(0.72);
  for (const [x, z, r] of [
    [-0.75, 0, 0.62],
    [0, 0.22, 0.8],
    [0.75, 0, 0.62],
  ] as const) {
    const ball = mesh(new THREE.SphereGeometry(r, 12, 10), white, [x, 0, z]);
    ball.scale.y = 0.6;
    cloud.add(ball);
  }
  const dots = new THREE.Group();
  dots.name = 'dots';
  for (const x of [-0.5, 0, 0.5])
    for (const s of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), lam(0x0ea5e9));
      d.position.set(x, s * 0.5, 0.05);
      d.userData = { i: Math.round(x * 2) + 1 };
      dots.add(d);
    }
  cloud.add(dots);
  g.add(cloud);
  g.userData = { onTop: true };
  return g;
}

function icePack(): THREE.Object3D {
  const g = new THREE.Group();
  // A pale blue pack lying on the crown, a white cap at one end.
  const pack = mesh(new THREE.BoxGeometry(1.9, 1.4, 0.48), lam(0x93c5fd));
  g.add(pack);
  g.add(mesh(new THREE.BoxGeometry(0.28, 1.0, 0.46), lam(0xf8fafc), [0.92, 0, 0]));
  g.position.set(-0.1, -0.1, HEAD_TOP + 0.05);
  g.rotation.set(0.12, -0.15, 0.25);
  g.userData = { onTop: true };
  return g;
}

function sweat(): THREE.Object3D {
  const drop = mesh(new THREE.SphereGeometry(0.2, 10, 8), lam(0x7dd3fc));
  drop.scale.set(0.8, 0.8, 1.3);
  drop.position.set(HEAD_R * 0.7, HEAD_R * 0.85, HEAD_MID + 0.55);
  return drop;
}

const BUILD: Record<string, () => THREE.Object3D> = {
  headphones,
  headset,
  'party-hat': partyHat,
  confetti,
  question: questionMark,
  sparkle,
  'no-entry': noEntry,
  steam,
  thought,
  'ice-pack': icePack,
  sweat,
};

// --- Hand props, upright along +y like the drinks ----------------------------------------------------------------

/** A status's hand prop, life-sized, its middle at the grip (made upright along +y, as `drinkProp` is). */
export function handProp(kind: StatusHandProp): THREE.Object3D {
  const g = new THREE.Group();
  if (kind === 'sandwich') {
    // A triangle of bread, two slices with lettuce, cheese and filling between, standing on its long edge.
    const tri = (depth: number) => {
      const s = new THREE.Shape();
      s.moveTo(-0.75, -0.5);
      s.lineTo(0.75, -0.5);
      s.lineTo(-0.75, 0.75);
      s.closePath();
      return new THREE.ExtrudeGeometry(s, {
        depth,
        bevelEnabled: true,
        bevelSize: 0.06,
        bevelThickness: 0.05,
        bevelSegments: 1,
      });
    };
    const layers: [number, number, number][] = [
      [0xf5deb3, 0.2, -0.33],
      [0x84cc16, 0.08, -0.12],
      [0xfbbf24, 0.07, -0.03],
      [0xe11d48, 0.08, 0.05],
      [0xf5deb3, 0.2, 0.14],
    ];
    for (const [c, d, z] of layers) {
      const m = mesh(tri(d), lam(c));
      m.position.z = z;
      g.add(m);
    }
    // Upright in the hand, the crust toward the camera's side.
    g.rotation.set(0, Math.PI / 2, 0);
    g.position.set(0.25, 0.15, 0);
  } else if (kind === 'bottle') {
    const blue = lam(0x60a5fa);
    const body = mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.5, 16), blue);
    const shoulder = mesh(new THREE.CylinderGeometry(0.2, 0.4, 0.3, 16), blue, [0, 0.9, 0]);
    const cap = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.22, 12), lam(0xf8fafc), [0, 1.15, 0]);
    const label = mesh(
      new THREE.CylinderGeometry(0.41, 0.41, 0.5, 16),
      lam(0xdbeafe),
      [0, 0.05, 0],
    );
    g.add(body, shoulder, cap, label);
    g.position.set(0.15, 0.1, 0);
  } else {
    // A phone on its side against the ear: a dark slab, its screen's edge lit.
    const slab = mesh(new THREE.BoxGeometry(0.16, 0.75, 1.5), lam(0x111827));
    const screen = mesh(new THREE.BoxGeometry(0.02, 0.62, 1.32), glow(0x38bdf8), [-0.09, 0, 0]);
    g.add(slab, screen);
    g.position.set(-0.15, 0.15, 0.35);
  }
  const held = new THREE.Group();
  held.add(g);
  return held;
}

// --- One character's props -----------------------------------------------------------------------------------------

const templates = new Map<string, THREE.Object3D>();
function template(name: string): THREE.Object3D {
  let t = templates.get(name);
  if (!t) templates.set(name, (t = BUILD[name]!()));
  return t;
}

/** How fast the "?" and the no-entry sign turn (radians a second), so neither is only ever seen edge on. */
const QUESTION_TURN = 1.2;
const SIGN_TURN = 0.8;

const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const va = new THREE.Vector3();
const vb = new THREE.Vector3();

/** A character's status props: the head anchor and what hangs on it, each status's made the first time it is worn. */
export class StatusProps {
  /** At the head bone, in the character's own axes and sprite px. */
  readonly head = new THREE.Group();
  private readonly worn = new Map<string, THREE.Object3D>();
  private status: AvatarStatus | null = null;
  /** How far this head's top (its hair) is above or below HEAD_TOP: what sits on the head is moved by it. */
  private lift = 0;
  /** The head bone's height over the figure's feet, and the hair's top over the bone, sprite px, as dressed. */
  private headZ: number | null = null;
  private hairTop = HEAD_TOP;
  /** The highest point of what the head wears now, measured once per status (reach). */
  private reachOf: { status: AvatarStatus | null; top: number } | null = null;

  constructor(fig: GameFigure) {
    const bone = fig.object.getObjectByName('Head');
    if (!bone) return;
    fig.object.updateMatrixWorld(true);
    // The head's bind turn undone, so the anchor's axes are the character's, and its scale undone to sprite px.
    this.head.quaternion
      .copy(bone.getWorldQuaternion(qa).invert())
      .multiply(fig.object.getWorldQuaternion(qb));
    const k = bone.getWorldScale(va);
    const o = fig.object.getWorldScale(vb);
    this.head.scale.setScalar(Math.cbrt((o.x * o.y * o.z) / Math.max(1e-9, k.x * k.y * k.z)));
    // The figure's top is its hair's: measured once, above the head bone, in sprite px (the scene stands up +z).
    const top = new THREE.Box3().setFromObject(fig.object).max.z;
    const from = (top - bone.getWorldPosition(va).z) / Math.max(1e-9, o.z);
    this.lift = Number.isFinite(from) ? Math.max(-0.6, Math.min(1.6, from - HEAD_TOP)) : 0;
    // The feet are the figure's own origin; its world position read into a vector of its own (`o` is still needed).
    const feetZ = fig.object.getWorldPosition(new THREE.Vector3()).z;
    const headZ = (bone.getWorldPosition(va).z - feetZ) / Math.max(1e-9, o.z);
    if (Number.isFinite(headZ) && Number.isFinite(from)) {
      this.headZ = headZ;
      this.hairTop = from;
    }
    this.head.visible = false;
    bone.add(this.head);
  }

  /** Wears `status`'s head props (and takes off the last one's). */
  show(status: AvatarStatus | null): void {
    if (status === this.status) return;
    this.status = status;
    const want = new Set(headPropsOf(status));
    for (const [name, o] of this.worn) o.visible = want.has(name);
    for (const name of want)
      if (!this.worn.has(name)) {
        // A clone shares the template's geometry and materials; its pieces keep their own place and phase.
        const o = template(name).clone();
        if ((o.userData as { onTop?: boolean }).onTop) o.position.z += this.lift;
        // Its top over the head bone, measured while it is still on its own (its matrix is then the anchor's frame).
        o.updateMatrixWorld(true);
        const top = new THREE.Box3().setFromObject(o).max.z;
        o.userData = { ...o.userData, z: o.position.z, top: Number.isFinite(top) ? top : 0 };
        this.worn.set(name, o);
        this.head.add(o);
      }
    this.head.visible = want.size > 0;
  }

  /**
   * How high the head reaches over the feet, in sprite px: the hair's top, or the highest head prop worn, whichever is
   * higher (docs/specs/008-canvas/avatar-mode.md "Status": the chip over the head clears both). Measured on the figure
   * as dressed, never a constant, so a tall hairstyle lifts the chip as much as a party hat does. Null for a figure
   * with no head bone.
   */
  reach(): number | null {
    if (this.headZ === null) return null;
    if (this.reachOf?.status === this.status) return this.reachOf.top;
    let top = this.hairTop;
    if (this.head.visible)
      for (const o of this.head.children)
        if (o.visible) top = Math.max(top, (o.userData as { top?: number }).top ?? 0);
    this.reachOf = { status: this.status, top: this.headZ + top };
    return this.reachOf.top;
  }

  /** Moves what loops (the twinkle, the bob, the steam, the confetti, the thought dots); `still` holds each at rest. */
  animate(now: number, still: boolean): void {
    if (!this.head.visible) return;
    const t = still ? 0 : now / 1000;
    for (const o of this.head.children) {
      if (!o.visible) continue;
      if (o.name === 'twinkle') {
        // The big star and the small one take turns.
        const on = still || Math.floor(t / 0.8) % 2 === 0;
        o.children[0]!.scale.setScalar(on ? 1 : 0.55);
        o.children[1]!.scale.setScalar(on ? 0.6 : 1.1);
      } else if (o.name === 'bob') {
        o.position.z = (o.userData as { z: number }).z + (still ? 0 : Math.sin(t * 4) * 0.18);
        o.rotation.z = Math.PI + t * QUESTION_TURN;
      } else if (o.name === 'turn') o.rotation.z = t * SIGN_TURN;
      else if (o.name === 'steam') placeSteam(o, still ? 0.25 : t / 1.6);
      else if (o.name === 'confetti') placeConfetti(o, still ? 0.3 : t / 2.4);
      else {
        const dots = o.getObjectByName('dots');
        if (dots) {
          const lit = still ? 1 : Math.floor(t / 0.45) % 3;
          for (const d of dots.children)
            (d as THREE.Mesh).material =
              (d.userData as { i: number }).i === lit ? glow(0x0284c7) : lam(0xbae6fd);
        }
      }
    }
  }
}

// --- A still figure's status (the palette's pictures) ------------------------------------------------------------

const worn = new WeakMap<
  GameFigure,
  { props: StatusProps; carry: THREE.Group; kind: StatusHandProp | null }
>();
const handTemplates = new Map<StatusHandProp, THREE.Object3D>();

/**
 * Puts `status`'s signature on a figure posed outside a rig (figure-portraits.ts): its head props held at rest, and its
 * hand prop in the hand. Answers the hand prop, so the caller carries it (or holds the phone up). With no status it
 * takes off whatever an earlier picture of the same figure wore.
 */
export function wearStatus(fig: GameFigure, status: AvatarStatus | null): StatusHandProp | null {
  let w = worn.get(fig);
  if (!w) {
    if (!status) return null;
    w = { props: new StatusProps(fig), carry: new THREE.Group(), kind: null };
    // Upright in the hand, as the rig stands a drink (character-rig.ts).
    w.carry.rotation.set(-Math.PI / 2, 0, 0);
    fig.hand.add(w.carry);
    worn.set(fig, w);
  }
  w.props.show(status);
  w.props.animate(0, true);
  const kind = statusHandProp(status);
  if (kind !== w.kind) {
    w.kind = kind;
    w.carry.clear();
    if (kind) {
      let t = handTemplates.get(kind);
      if (!t) handTemplates.set(kind, (t = handProp(kind)));
      w.carry.add(t.clone());
    }
  }
  return kind;
}
