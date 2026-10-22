// The Motion carousel's fourth page of animated backgrounds (docs/specs/030-forms/forms.md "The form card, top to bottom",
// Cover): Warp, Orbits, Radar, Equaliser, Confetti and
// Threads, as parts in the shape lib/form-cover/cover-motion-parts.ts describes, so the moving layer and the
// export draw them as they draw the rest.
//
// Held to the same budget: transform and opacity only, soft edges as gradients, at most about a
// hundred parts, loops of 4 to 90 seconds, positions from fixed seeds.
import { motionSeed, type MotionPaint } from './cover-motion';
import type { MotionBox, MotionNode, MotionSize, MotionWave } from './cover-motion-parts';

const box = (b: Omit<MotionBox, 'type'>): MotionBox => ({ type: 'box', ...b });

// Warp's streaks: dense enough to read as a jump to light speed, few enough that their loops
// restarting cost the page next to nothing (measured against Starfield, the busiest before it).
const STREAKS = 48;

// ── Warp: stars streaking out from the centre, lengthening as they speed up. ───────────────────
export function Warp({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const unit = Math.max(w, h);
  const thick = Math.max(1.5, Math.min(w, h) * 0.003);
  // Far enough that a streak leaves the slide past its farthest corner.
  const reach = Math.hypot(w, h) / 2;
  const streaks = Array.from({ length: STREAKS }, (_, i) => {
    const len = unit * (0.06 + motionSeed(i, 60) * 0.12);
    const dur = 5 + motionSeed(i, 61) * 4;
    return box({
      left: w / 2,
      top: h / 2 - thick / 2,
      width: len,
      height: thick,
      fill: { kind: 'streak', color: i % 4 === 0 ? p.cool : p.hi, a: 0.85 },
      anim: {
        name: 'warp',
        d: dur,
        dl: -motionSeed(i, 62) * dur,
        // Spread evenly round the circle, each nudged off its spoke.
        r: (i * 360) / STREAKS + (motionSeed(i, 63) - 0.5) * 5,
        x: reach + len,
      },
    });
  });
  const core = unit * 0.5;
  return [
    box({
      left: w / 2 - core / 2,
      top: h / 2 - core / 2,
      width: core,
      height: core,
      round: true,
      fill: { kind: 'glow', color: p.cool, a: 0.45 },
    }),
    ...streaks,
  ];
}

// ── Orbits: planets circling a glowing sun on faint rings, the outer ones slower. ──────────────
export function Orbits({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const unit = Math.min(w, h);
  const sun = unit * 0.42;
  const nodes: MotionNode[] = [
    box({
      left: w / 2 - sun / 2,
      top: h / 2 - sun / 2,
      width: sun,
      height: sun,
      round: true,
      fill: { kind: 'glow', color: p.warm, a: 0.75 },
    }),
  ];
  const colours = [p.cool, p.warm, p.hi, p.b, p.cool];
  for (let k = 0; k < 5; k += 1) {
    const r = unit * (0.2 + k * 0.17);
    nodes.push(
      box({
        left: w / 2 - r,
        top: h / 2 - r,
        width: r * 2,
        height: r * 2,
        round: true,
        fill: { kind: 'ring', color: p.hi, a: 0.16, width: Math.max(1, unit / 900) },
      }),
    );
    // The inner two carry one planet, the outer three two, opposite each other.
    for (let j = 0; j < (k < 2 ? 1 : 2); j += 1) {
      const d = unit * (0.02 + motionSeed(k * 2 + j, 64) * 0.022);
      const c = colours[(k + j * 2) % colours.length]!;
      nodes.push({
        type: 'group',
        anim: { name: 'orbit', d: 24 + k * 15, r: motionSeed(k, 65) * 360 + j * 180 },
        children: [
          box({
            left: w / 2 - d / 2,
            top: h / 2 - r - d / 2,
            width: d,
            height: d,
            round: true,
            fill: { kind: 'solid', color: c },
            halo: { blur: d * 2.5, spread: d * 0.3, color: c, a: 0.6 },
          }),
        ],
      });
    }
  }
  return nodes;
}

// The radar's sweep: one turn this long, which every blip keeps time with.
const RADAR_TURN = 8;

// ── Radar: a sweep turning over rings and cross hairs, each blip lighting as it passes. ────────
export function Radar({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const unit = Math.min(w, h);
  const line = Math.max(1, unit / 900);
  const sweep = Math.hypot(w, h);
  const nodes: MotionNode[] = [
    box({ left: 0, top: h / 2 - line / 2, width: w, height: line, fill: hair(p) }),
    box({ left: w / 2 - line / 2, top: 0, width: line, height: h, fill: hair(p) }),
  ];
  for (let k = 1; k <= 5; k += 1) {
    const r = unit * 0.16 * k;
    nodes.push(
      box({
        left: w / 2 - r,
        top: h / 2 - r,
        width: r * 2,
        height: r * 2,
        round: true,
        fill: { kind: 'ring', color: p.hi, a: 0.18, width: line },
      }),
    );
  }
  nodes.push(
    box({
      left: w / 2 - sweep / 2,
      top: h / 2 - sweep / 2,
      width: sweep,
      height: sweep,
      round: true,
      fill: { kind: 'sweep', color: p.hi, a: 0.28 },
      anim: { name: 'turn', d: RADAR_TURN },
    }),
  );
  for (let i = 0; i < 9; i += 1) {
    // Clockwise from straight up, as the sweep turns.
    const angle = motionSeed(i, 66) * 360;
    const dist = unit * (0.12 + motionSeed(i, 67) * 0.62);
    const d = unit * (0.012 + motionSeed(i, 68) * 0.01);
    const c = i % 3 === 0 ? p.warm : p.hi;
    const t = (angle * Math.PI) / 180;
    nodes.push(
      box({
        left: w / 2 + Math.sin(t) * dist - d / 2,
        top: h / 2 - Math.cos(t) * dist - d / 2,
        width: d,
        height: d,
        round: true,
        fill: { kind: 'solid', color: c },
        halo: { blur: d * 3, spread: d * 0.5, color: c, a: 0.7 },
        // Lit as the sweep's edge reaches its angle, fading over the rest of the turn.
        anim: { name: 'blip', d: RADAR_TURN, dl: -RADAR_TURN * (1 - angle / 360) },
      }),
    );
  }
  return nodes;
}

const hair = (p: MotionPaint) => ({ kind: 'solid', color: p.hi, a: 0.12 }) as const;

// ── Equaliser: bars along the bottom rising and falling, tallest in the middle. ────────────────
export function Equaliser({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const count = 32;
  const slot = w / count;
  const tallest = h * 0.48;
  const bars = Array.from({ length: count }, (_, i) => {
    const tall = tallest * (0.45 + 0.55 * Math.sin((Math.PI * (i + 0.5)) / count));
    const dur = 4 + motionSeed(i, 70) * 2.5;
    return box({
      left: i * slot + slot * 0.19,
      top: h - tall,
      width: slot * 0.62,
      height: tall,
      fill: { kind: 'bar', from: p.cool, to: p.hi, a: 0.6 },
      anim: {
        name: 'bars',
        d: dur,
        dl: -motionSeed(i, 71) * dur,
        // At rest (reduced motion) each stands at its own height.
        rest: 0.3 + motionSeed(i, 72) * 0.6,
      },
    });
  });
  return [
    box({
      left: -w * 0.1,
      top: h * 0.55,
      width: w * 1.2,
      height: h * 0.9,
      fill: { kind: 'fade', color: p.b, a: 0.55 },
    }),
    ...bars,
  ];
}

// ── Confetti: pieces in the page's colours fluttering down, swaying and turning. ───────────────
export function Confetti({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const unit = Math.min(w, h);
  const colours = [p.warm, p.cool, p.hi, p.warm, p.cool, p.b];
  return Array.from({ length: 56 }, (_, i) => {
    const s = unit * (0.012 + motionSeed(i, 80) * 0.012);
    const dot = i % 5 === 0;
    const dur = 9 + motionSeed(i, 81) * 8;
    return box({
      left: motionSeed(i, 82) * w,
      top: -s * 3,
      width: s,
      height: dot ? s : s * 0.45,
      round: dot,
      fill: { kind: 'solid', color: colours[i % colours.length]!, a: 0.9 },
      anim: {
        name: 'tumble',
        d: dur,
        dl: -motionSeed(i, 83) * dur,
        x: (i % 2 ? 1 : -1) * w * (0.015 + motionSeed(i, 84) * 0.03),
        y: h + s * 6,
        r: (motionSeed(i, 85) > 0.5 ? 1 : -1) * (360 + motionSeed(i, 86) * 540),
        // At rest (reduced motion) the pieces hang where they would be this far down.
        rest: motionSeed(i, 87),
      },
    });
  });
}

// ── Threads: fine lines of light weaving past each other at their own paces. ───────────────────
export function Threads({ w, h }: MotionSize, p: MotionPaint): MotionNode[] {
  const unit = Math.min(w, h);
  const colours = [p.hi, p.cool, p.warm];
  const threads = Array.from({ length: 9 }, (_, i): MotionWave => {
    const dur = 18 + motionSeed(i, 90) * 22;
    return {
      type: 'wave',
      w,
      h,
      amp: h * (0.06 + motionSeed(i, 91) * 0.16),
      base: h * (0.4 + motionSeed(i, 92) * 0.22),
      // Even, so the line meets itself where the loop starts again.
      periods: i % 3 === 0 ? 4 : 2,
      color: colours[i % colours.length]!,
      a: 0.35 + motionSeed(i, 93) * 0.3,
      stroke: Math.max(1, unit * 0.0022) * (1 + motionSeed(i, 94)),
      anim: {
        name: i % 2 ? 'slide-x-back' : 'slide-x-neg',
        d: dur,
        dl: -motionSeed(i, 95) * dur,
        x: -w,
      },
    };
  });
  return [
    box({
      left: 0,
      top: h * 0.2,
      width: w,
      height: h * 0.7,
      fill: { kind: 'fade', color: p.cool, a: 0.3 },
    }),
    ...threads,
  ];
}
