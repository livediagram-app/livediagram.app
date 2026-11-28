'use client';

// The newer Behaviours' arms and a status's hand pose on a game character (docs/specs/008-canvas/3d-engine.md
// "Characters"): Raise Hand, Clap, Thumbs Up, Point, the phone at the ear (Busy) and the sandwich's bite (Out to
// Lunch). Each is a weight from 0 to 1 that eases in and out, turned over the figure after GameFigure.update has played
// its clips and posed its own moves, each turn about an axis of the character's own space (x across its shoulders, y
// the way it faces, z up), as GameFigure's own poses are. With every weight at 0 nothing here touches the figure, so a
// character with no gesture draws exactly as GameFigure poses it.

import * as THREE from 'three';
import type { GameFigure } from './game-figure';

/** How far into each gesture the arms are, 0 (not at all) to 1; `beat` is how close the clapping hands are. */
export type Gestures = {
  handUp: number;
  clap: number;
  beat: number;
  thumbsUp: number;
  point: number;
  phone: number;
  bite: number;
};

export const NO_GESTURES: Gestures = Object.freeze({
  handUp: 0,
  clap: 0,
  beat: 0,
  thumbsUp: 0,
  point: 0,
  phone: 0,
  bite: 0,
});

/** How fast a gesture eases toward where it is going: about 0.1 s, as GameFigure's own arms do. */
const EASE_PER_S = 14;
/** Below this a weight is nothing (and snaps to 0, so a lowered arm stops costing anything). */
const OFF = 0.005;

/** `prev` eased toward `want` over `dt` seconds. The clap's beat follows at once: it is already a rhythm. */
export function easeGestures(prev: Gestures, want: Gestures, dt: number): Gestures {
  const k = Math.min(1, dt * EASE_PER_S);
  const step = (a: number, b: number) => {
    const v = a + (b - a) * k;
    return Math.abs(v - b) < OFF ? b : v;
  };
  const next: Gestures = {
    handUp: step(prev.handUp, want.handUp),
    clap: step(prev.clap, want.clap),
    beat: want.beat,
    thumbsUp: step(prev.thumbsUp, want.thumbsUp),
    point: step(prev.point, want.point),
    phone: step(prev.phone, want.phone),
    bite: step(prev.bite, want.bite),
  };
  return anyGesture(next) || anyGesture(prev) ? next : NO_GESTURES;
}

/**
 * The gestures a Behaviour's pose asks for, at full weight (the clap's beat as it is), and the phone at the ear for
 * Busy when nothing else holds the hand.
 */
export function gesturesOf(
  pose: { handUp?: boolean; clap?: number; thumbsUp?: boolean; point?: boolean } | null,
  phone: boolean,
): Gestures {
  return {
    handUp: pose?.handUp ? 1 : 0,
    clap: pose?.clap !== undefined ? 1 : 0,
    beat: pose?.clap ?? 0,
    thumbsUp: pose?.thumbsUp ? 1 : 0,
    point: pose?.point ? 1 : 0,
    phone: phone ? 1 : 0,
    bite: 0,
  };
}

/** Whether any gesture shows at all. */
export function anyGesture(g: Gestures): boolean {
  return g.handUp > 0 || g.clap > 0 || g.thumbsUp > 0 || g.point > 0 || g.phone > 0 || g.bite > 0;
}

/** Whether a gesture holds the right hand (a status's hand prop then waits). */
export function gestureTakesHand(g: Gestures): boolean {
  return g.handUp > OFF || g.clap > OFF || g.thumbsUp > OFF || g.point > OFF;
}

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const q3 = new THREE.Quaternion();
const v0 = new THREE.Vector3();

type Bones = Map<string, THREE.Bone>;
const bonesOf = new WeakMap<GameFigure, Bones>();

function bones(fig: GameFigure): Bones {
  let have = bonesOf.get(fig);
  if (have) return have;
  have = new Map();
  const into = have;
  fig.object.traverse((o) => {
    if ((o as THREE.Bone).isBone) into.set(o.name, o as THREE.Bone);
  });
  bonesOf.set(fig, have);
  return have;
}

/** The right hand's fingers bent toward the palm by `angle` (all but the index when `pointing`). */
function curl(
  turn: (name: string, axis: THREE.Vector3, angle: number) => void,
  angle: number,
  pointing: boolean,
): void {
  for (const f of pointing ? ['Middle', 'Ring', 'Pinky'] : ['Index', 'Middle', 'Ring', 'Pinky'])
    for (const n of [1, 2, 3]) turn(`${f}${n}.R`, X, -angle);
}

/**
 * Turns the figure's arm and finger bones for `g`, over the pose GameFigure.update left, then keeps a held prop upright.
 * The right hand's fingers are put back to their bind pose by GameFigure.update each frame, so a curl never adds up.
 */
export function poseGestures(fig: GameFigure, g: Gestures): void {
  if (!anyGesture(g)) return;
  const map = bones(fig);
  fig.object.updateMatrixWorld(true);
  fig.object.getWorldQuaternion(q0).invert();
  const turn = (name: string, axis: THREE.Vector3, angle: number) => {
    if (Math.abs(angle) < 1e-4) return;
    const b = map.get(THREE.PropertyBinding.sanitizeNodeName(name));
    if (!b?.parent) return;
    // The parent's turn in the character's space; the bone turned by `angle` about `axis` in that space.
    const parent = b.parent.getWorldQuaternion(q1).premultiply(q0);
    const r = q2.setFromAxisAngle(axis, angle);
    b.quaternion.premultiply(q3.copy(parent).invert().multiply(r).multiply(parent));
    b.updateMatrixWorld(true);
  };
  /** Which side a bone is on: +1 at +x, -1 at -x, in the character's space. */
  const side = (name: string) => {
    const b = map.get(THREE.PropertyBinding.sanitizeNodeName(name));
    if (!b) return 1;
    return fig.object.worldToLocal(b.getWorldPosition(v0)).x >= 0 ? 1 : -1;
  };
  const sR = side('UpperArm.R');
  // Raise Hand: the right arm up beside the head, straight, the hand open.
  if (g.handUp > 0) turn('UpperArm.R', Y, -sR * 2.85 * g.handUp);
  // Clap: both upper arms forward and in, the forearms bent up across the chest, the hands meeting on the beat.
  if (g.clap > 0) {
    for (const s of ['L', 'R'] as const) {
      const k = side(`UpperArm.${s}`);
      turn(`UpperArm.${s}`, X, 0.6 * g.clap);
      turn(`UpperArm.${s}`, Z, k * (0.18 + 0.12 * g.beat) * g.clap);
      turn(`LowerArm.${s}`, X, 1.3 * g.clap);
      turn(`LowerArm.${s}`, Z, k * (0.1 + 0.22 * g.beat) * g.clap);
    }
  }
  // Thumbs Up: the forearm raised in front, the fist closed (the thumb, which no curl moves, stands up from it).
  if (g.thumbsUp > 0) {
    turn('UpperArm.R', X, 0.45 * g.thumbsUp);
    turn('LowerArm.R', X, 1.45 * g.thumbsUp);
    curl(turn, 1.35 * g.thumbsUp, false);
  }
  // Point: the arm straight out ahead, the index out and the other fingers closed.
  if (g.point > 0) {
    turn('UpperArm.R', X, 1.5 * g.point);
    curl(turn, 1.35 * g.point, true);
  }
  // The phone at the ear (Busy): the upper arm forward and turned in, the forearm folded up so the hand reaches the ear.
  if (g.phone > 0) {
    turn('UpperArm.R', X, 0.35 * g.phone);
    turn('UpperArm.R', Z, sR * 0.25 * g.phone);
    turn('LowerArm.R', X, 2.55 * g.phone);
    curl(turn, 0.6 * g.phone, false);
  }
  // The sandwich's bite (Out to Lunch): the carrying forearm lifted toward the mouth.
  if (g.bite > 0) {
    turn('UpperArm.R', X, 0.25 * g.bite);
    turn('LowerArm.R', X, 0.85 * g.bite);
  }
  // A held prop stays upright whatever the wrist now does, as GameFigure keeps it.
  const wrist = fig.hand.parent;
  if (wrist && fig.hand.children.length > 0) {
    fig.object.updateMatrixWorld(true);
    const w = wrist.getWorldQuaternion(q1).invert();
    fig.hand.quaternion.copy(w.multiply(fig.object.getWorldQuaternion(q2)));
  }
}
