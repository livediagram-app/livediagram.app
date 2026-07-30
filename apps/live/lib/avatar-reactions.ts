// Avatar-mode reactions (spec/101): the five one-shot performances the Avatar
// Panel offers — jumping jacks, a wave, a spin, a cheer, and a dance.
//
// Each is a PURE function of elapsed time: `reactionPose` turns "this reaction,
// this many ms in" into the pose inputs the sprite already understands (hop
// height, which way it faces, where its arms are). That keeps the animation out
// of the component, makes the timings unit-testable, and — because it is pure —
// lets a PEER replay the same performance from a presence packet carrying only
// the kind and the elapsed time.
//
// Reactions happen ON THE SPOT: starting one drops any walk in progress, so the
// character performs where it stands rather than sliding through the routine.

import type { AvatarFacing } from './avatar-walk';

export type AvatarReactionKind = 'jumping-jacks' | 'wave' | 'spin' | 'cheer' | 'dance';

export const AVATAR_REACTIONS: readonly { id: AvatarReactionKind; label: string }[] = [
  { id: 'jumping-jacks', label: 'Jumping jacks' },
  { id: 'wave', label: 'Wave' },
  { id: 'spin', label: 'Spin' },
  { id: 'cheer', label: 'Cheer' },
  { id: 'dance', label: 'Dance' },
];

// Jumping jacks: five hops, arms out at the top of each. One rep is short
// enough to read as a jack rather than a jump.
const JACK_REPS = 5;
const JACK_REP_MS = 360;
const JACK_HEIGHT = 30;
// Wave: a raised hand crossing back and forth.
const WAVE_MS = 1600;
const WAVE_SWING_MS = 170;
// Spin: two full turns through the four facings.
const SPIN_TURNS = 2;
const SPIN_STEP_MS = 150;
// Cheer: arms up, two bounces.
const CHEER_BOUNCES = 2;
const CHEER_BOUNCE_MS = 420;
const CHEER_HEIGHT = 20;
// Dance: a side-to-side sway with alternating arms.
const DANCE_MS = 2000;
const DANCE_BEAT_MS = 240;

const SPIN_ORDER: readonly AvatarFacing[] = ['down', 'left', 'up', 'right'];

// How long each reaction runs, in ms. Exported so the caller can decide whether
// a reaction is still playing without stepping the pose.
export function reactionDuration(kind: AvatarReactionKind): number {
  switch (kind) {
    case 'jumping-jacks':
      return JACK_REPS * JACK_REP_MS;
    case 'wave':
      return WAVE_MS;
    case 'spin':
      return SPIN_TURNS * SPIN_ORDER.length * SPIN_STEP_MS;
    case 'cheer':
      return CHEER_BOUNCES * CHEER_BOUNCE_MS;
    case 'dance':
      return DANCE_MS;
  }
}

// The pose inputs a reaction produces at a moment in time. Every field is
// something the sprite can already draw; `done` tells the caller to clear the
// reaction and go back to standing.
export type ReactionPose = {
  done: boolean;
  // Height above the ground, canvas px (same units as a jump).
  lift: number;
  // Overrides the character's facing (the spin), or undefined to keep it.
  facing?: AvatarFacing;
  // Arms straight out to the sides (jumping jacks), both arms raised (cheer),
  // one arm raised and waving (wave / dance).
  armsOut: boolean;
  armsUp: boolean;
  waveArm: boolean;
  // Legs splayed, for the top of a jumping jack.
  legsApart: boolean;
  // Sideways lean in sprite px, for the dance sway.
  leanX: number;
};

const STANDING: ReactionPose = {
  done: true,
  lift: 0,
  armsOut: false,
  armsUp: false,
  waveArm: false,
  legsApart: false,
  leanX: 0,
};

// A half-sine hop: 0 at both ends of the window, `height` at the middle.
const hop = (progress: number, height: number) => Math.sin(Math.PI * progress) * height;

export function reactionPose(kind: AvatarReactionKind, elapsedMs: number): ReactionPose {
  if (elapsedMs < 0 || elapsedMs >= reactionDuration(kind)) return STANDING;
  const base = { ...STANDING, done: false };
  switch (kind) {
    case 'jumping-jacks': {
      const within = (elapsedMs % JACK_REP_MS) / JACK_REP_MS;
      const lift = hop(within, JACK_HEIGHT);
      // Arms and legs open on the way up and close on the way down, which is
      // what separates a jack from a plain hop.
      const open = lift > JACK_HEIGHT * 0.35;
      return { ...base, lift, armsOut: open, legsApart: open };
    }
    case 'wave': {
      const swing = Math.floor(elapsedMs / WAVE_SWING_MS) % 2 === 0;
      return { ...base, waveArm: true, leanX: swing ? 0 : 1 };
    }
    case 'spin': {
      const step = Math.floor(elapsedMs / SPIN_STEP_MS) % SPIN_ORDER.length;
      return { ...base, facing: SPIN_ORDER[step] };
    }
    case 'cheer': {
      const within = (elapsedMs % CHEER_BOUNCE_MS) / CHEER_BOUNCE_MS;
      return { ...base, armsUp: true, lift: hop(within, CHEER_HEIGHT) };
    }
    case 'dance': {
      const beat = Math.floor(elapsedMs / DANCE_BEAT_MS);
      const left = beat % 2 === 0;
      return {
        ...base,
        // Sway one way with one arm up, then the other.
        leanX: left ? -1 : 1,
        waveArm: left,
        armsUp: !left,
        lift: hop((elapsedMs % DANCE_BEAT_MS) / DANCE_BEAT_MS, 4),
      };
    }
  }
}
