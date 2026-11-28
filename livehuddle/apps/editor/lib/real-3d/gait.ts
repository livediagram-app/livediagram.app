// Real 3D's gait (docs/specs/008-canvas/3d-engine.md "Characters"): a character's legs, hips and arms for a point in
// its stride, from how fast it moves. Pure: everything is in sprite pixels (the rig's own units), the stride's phase
// in cycles (0..1, the left foot landing at 0 and the right at 0.5).
//
// The feet are planted: a foot on the ground moves back under the hips at exactly the body's speed (so it stays put
// on the floor), and the hip and knee are solved from where each foot is (two-bone IK), never swung on a curve of
// their own. Cadence and step length grow with speed the way a person's do; past a jog both feet leave the ground
// between steps.

import { BODY } from './character';

/** Hip to sole, the leg's full reach. */
export const LEG = BODY.thigh + BODY.shin;
/** Knee to ankle, and the toe's reach ahead of the ankle along the sole. */
const SHIN = BODY.shin - BODY.ankle;
const TOE = 1.7;
/** The gait's heights and swings were set for a 6.8 px leg; they scale with the leg so a taller figure moves alike. */
const K = LEG / 6.8;

/** A speed below this (sprite px a second) is standing still. */
const STILL = 0.5;

/** Strides (a full left-right cycle) a second at a speed: about 0.9 for a person walking, 2.3 sprinting. */
export function cadence(speed: number): number {
  return Math.max(0.6, 0.72 * Math.sqrt(Math.max(0, speed) / LEG));
}

/** How far a stride has gone into the gait, 0 standing to 1 fully striding. */
export function strideAmount(speed: number): number {
  const t = Math.min(1, Math.max(0, (speed - STILL) / (0.9 * LEG)));
  return t * t * (3 - 2 * t);
}

/** 0 for a walk, 1 for a run, blended between a stroll and a jog (leg lengths a second). */
export function runAmount(speed: number): number {
  const u = speed / LEG;
  const t = Math.min(1, Math.max(0, (u - 1.8) / 1.6));
  return t * t * (3 - 2 * t);
}

export type GaitPose = {
  /** Thigh pitch (forward positive) and knee bend (0 straight) per leg. */
  hipL: number;
  hipR: number;
  kneeL: number;
  kneeR: number;
  /** Each shoe's pitch to the floor (toe up positive): flat while planted, rolling onto the toe as it pushes off. */
  footL: number;
  footR: number;
  /** Each leg's roll toward the body's middle, so a planted foot stays put while the hips sway over it. */
  rollL: number;
  rollR: number;
  /** The hips' offset from standing: sideways sway and height. */
  bodyX: number;
  bodyZ: number;
  /** The upper body: forward lean, and its twist against the legs. */
  lean: number;
  twist: number;
  /** Each arm's pitch (forward positive) and how far it swings out from the side. */
  armL: number;
  armR: number;
  armOut: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The hip and knee that put an ankle at (y forward, z up) from the hip joint, the knee bending forward. */
export function legIK(y: number, z: number): { hip: number; knee: number } {
  const t = BODY.thigh;
  const s = SHIN;
  const d = Math.min(t + s - 1e-4, Math.max(0.5, Math.hypot(y, z)));
  const interior = Math.acos(Math.min(1, Math.max(-1, (t * t + s * s - d * d) / (2 * t * s))));
  const off = Math.acos(Math.min(1, Math.max(-1, (t * t + d * d - s * s) / (2 * t * d))));
  return { hip: Math.atan2(y, -z) + off, knee: Math.PI - interior };
}

const STANDING: GaitPose = {
  hipL: 0,
  hipR: 0,
  kneeL: 0,
  kneeR: 0,
  footL: 0,
  footR: 0,
  rollL: 0,
  rollR: 0,
  bodyX: 0,
  bodyZ: 0,
  lean: 0,
  twist: 0,
  armL: 0,
  armR: 0,
  armOut: 0,
};

/** The pose at `phase` (cycles) of the stride at `speed` (sprite px a second). */
export function gaitPose(phase: number, speed: number): GaitPose {
  const amount = strideAmount(speed);
  if (amount <= 0) return STANDING;
  const r = runAmount(speed);
  const p = phase - Math.floor(phase);
  const stride = speed / cadence(speed);
  // The share of the stride each foot is down: over half walking (both down between steps), under a third running.
  const duty = lerp(0.6, 0.32, r);
  // Hips: a little lower the faster it goes; walking vaults up over the planted leg (highest mid-step), running
  // drops into it (lowest mid-step).
  const crouch = lerp(0.12, 0.55, r) * amount * K;
  const bobAmp = lerp(0.18, 0.4, r) * amount * K;
  const bobAt = (q: number) => bobAmp * Math.cos(4 * Math.PI * (q - duty / 2)) * (1 - 2 * r);
  const hipZ = (q: number) => LEG - crouch + bobAt(q);
  // A planted foot reaches only so far ahead and behind (hip to ankle); past that the foot leaves the ground sooner.
  const reachZ = Math.max(hipZ(0), hipZ(duty)) - BODY.ankle;
  const reach = Math.sqrt(Math.max(0, (0.97 * (BODY.thigh + SHIN)) ** 2 - reachZ ** 2));
  const half = Math.min((stride * duty) / 2, reach);
  const down = stride > 0 ? Math.min(duty, (2 * half) / stride) : duty;
  const z = hipZ(p);
  const clear = lerp(0.6, 1.6, r) * amount * K;
  const kick = lerp(0.4, 2.6, r) * amount * K;
  // Running drives the knee: the swinging foot reaches past where it lands, then pulls back under to land.
  const drive = lerp(0.3, 1.8, r) * amount * K;
  // The heel rises off the floor late in each step, the foot rolling over its toe.
  const roll = lerp(0.45, 0.8, r) * amount;

  /** The ankle (y forward, lift above its standing height) and the shoe's pitch, at a foot's own phase. */
  const foot = (q: number): { y: number; lift: number; pitch: number } => {
    if (q < down) {
      const s = q / down;
      const y = half * (1 - 2 * s);
      // Heel strike: landing toe up, flat by a sixth of the way through.
      if (s < 0.16) return { y, lift: 0, pitch: 0.18 * amount * (1 - s / 0.16) };
      if (s < 0.55) return { y, lift: 0, pitch: 0 };
      // Heel off: the foot turns about its toe, which stays where it is on the floor.
      const a = roll * ((s - 0.55) / 0.45) ** 1.4;
      return {
        y: y + TOE - TOE * Math.cos(a) + BODY.ankle * Math.sin(a),
        lift: TOE * Math.sin(a) + BODY.ankle * (Math.cos(a) - 1),
        pitch: -a,
      };
    }
    const s = (q - down) / (1 - down);
    const ease = 0.5 - 0.5 * Math.cos(Math.PI * s);
    // The heel rises behind first (more running), then the foot swings through and reaches out to land.
    const heel = kick * Math.sin(Math.PI * Math.min(1, s * 1.7)) * (1 - s);
    const toeOff = TOE * Math.sin(roll) + BODY.ankle * (Math.cos(roll) - 1);
    return {
      y:
        -half +
        (TOE * (1 - Math.cos(roll)) + BODY.ankle * Math.sin(roll)) * (1 - s) +
        2 * half * ease -
        heel * 0.45 +
        drive * Math.sin(Math.PI * s ** 1.5),
      lift: clear * Math.sin(Math.PI * s) + heel + toeOff * (1 - s) ** 2,
      // Toe down leaving the floor, level through the swing, toe up reaching to land.
      pitch: s < 0.4 ? -roll * (1 - s / 0.4) : 0.18 * amount * Math.min(1, (s - 0.4) / 0.5),
    };
  };
  const qL = p;
  const qR = (p + 0.5) % 1;
  const fL = foot(qL);
  const fR = foot(qR);
  const legL = legIK(fL.y, -(z - BODY.ankle - fL.lift));
  const legR = legIK(fR.y, -(z - BODY.ankle - fR.lift));

  // Sway over whichever foot is down; each leg rolls back so its foot keeps its place.
  const sway = lerp(0.32, 0.12, r) * amount * K;
  const bodyX = -sway * Math.cos(2 * Math.PI * (p - down / 2));
  const legRoll = Math.asin(Math.max(-1, Math.min(1, bodyX / Math.max(1, z))));

  // Arms swing against the legs (the right arm forward as the left foot lands), further forward than back.
  const armAmp = lerp(0.32, 0.85, r) * amount;
  const swing = Math.cos(2 * Math.PI * (p - 0.04));
  const arm = (v: number) => (v > 0 ? v : v * 0.7) * armAmp + 0.12 * r * amount;
  return {
    hipL: legL.hip,
    hipR: legR.hip,
    kneeL: legL.knee,
    kneeR: legR.knee,
    footL: fL.pitch,
    footR: fR.pitch,
    rollL: legRoll,
    rollR: legRoll,
    bodyX,
    bodyZ: z - LEG,
    lean: lerp(0.04, 0.2, r) * amount,
    twist: lerp(0.07, 0.14, r) * amount * swing,
    armL: arm(-swing),
    armR: arm(swing),
    armOut: 0.12 * r * amount,
  };
}
