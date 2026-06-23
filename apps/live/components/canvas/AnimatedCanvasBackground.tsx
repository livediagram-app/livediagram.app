'use client';

// The animated canvas backdrops (spec/09). Five softly-moving patterns
// (Flow / Drift / Aurora / Ripple / Ribbons) that bring an otherwise-static
// canvas to life. They render as a single full-bleed, pointer-transparent overlay
// layered behind the diagram content rather than as a CSS `background-image`
// (the static patterns' route), because none of these can be expressed as a
// tiling image: they need independent per-element motion.
//
// Design rules that keep them tasteful + cheap:
//   - Theme-matched: every glyph paints in the tab's `patternColor` (read
//     from the `--lvd-pat` custom property the container sets).
//   - Ambient, not pan-locked: the motion is decorative and independent of
//     the canvas pan (matching the new-diagram page's AnimatedLinesBackdrop).
//   - Size-aware: the pattern-size slider (`scale`, spec/09) scales each
//     motif so "bigger pattern" reads consistently with the static ones.
//   - Opacity-aware: the whole layer fades with the backdrop-opacity slider.
//   - Reduced-motion safe: every element's *resting* style is already a
//     pleasant still pattern, and the animation is purely additive, so
//     `prefers-reduced-motion` simply freezes it into that still frame.
//   - Deterministic: all positions / delays come from fixed tables (no
//     Math.random) so server and client markup match.

import { shade, tint, type AnimatedBackgroundPattern } from '@livediagram/diagram';
import type { CSSProperties } from 'react';

type Props = {
  variant: AnimatedBackgroundPattern;
  // The tab's pattern colour; every glyph paints in it.
  color: string;
  // Pattern-size slider value (0.5..2), scales each motif.
  scale: number;
  // Backdrop-opacity slider value (0..1), fades the whole layer.
  opacity: number;
};

// CSS var helper: lets per-element inline styles feed the keyframes
// (duration / delay / drift vectors) without a style tag per element.
type Vars = CSSProperties & Record<`--${string}`, string | number>;

export function AnimatedCanvasBackground({ variant, color, scale, opacity }: Props) {
  return (
    <div
      aria-hidden
      data-animated-pattern={variant}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ ['--lvd-pat']: color, opacity } as Vars}
    >
      <style>{KEYFRAMES}</style>
      {variant === 'flow' ? <Flow scale={scale} /> : null}
      {variant === 'drift' ? <Drift scale={scale} /> : null}
      {variant === 'aurora' ? <Aurora scale={scale} /> : null}
      {variant === 'ripple' ? <Ripple scale={scale} /> : null}
      {variant === 'ribbons' ? <Ribbons scale={scale} color={color} /> : null}
    </div>
  );
}

// ── Flow ────────────────────────────────────────────────────────────────
// Parallel diagonal lines whose dashes stream along their length, the
// canvas-wide cousin of the new-diagram page's AnimatedLinesBackdrop.
// Resting frame: evenly spaced dashed diagonals.
function Flow({ scale }: { scale: number }) {
  const gap = 150 * scale;
  // Cover the sliced viewBox with diagonals of slope -1: x from well past
  // the right edge to well before the left so the field is seamless.
  const lines: number[] = [];
  for (let x = -800; x <= 2400; x += gap) lines.push(x);
  const dash = 70 * scale;
  return (
    <svg
      className="h-full w-full"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      {lines.map((x, i) => (
        <line
          key={i}
          x1={x}
          y1={-100}
          x2={x - 1000}
          y2={1000}
          stroke="var(--lvd-pat)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${dash}`}
          className="lvd-flow-line"
          style={{ ['--dur']: `${5 + (i % 4)}s` } as Vars}
        />
      ))}
    </svg>
  );
}

// ── Drift ───────────────────────────────────────────────────────────────
// Soft motes that rise and gently fade, like dust in a sunbeam. Resting
// frame: a calm scattered dot field.
const MOTES: { left: number; size: number; dur: number; delay: number }[] = [
  { left: 6, size: 6, dur: 13, delay: 0 },
  { left: 15, size: 10, dur: 17, delay: 3 },
  { left: 23, size: 5, dur: 11, delay: 6 },
  { left: 31, size: 8, dur: 15, delay: 1.5 },
  { left: 39, size: 12, dur: 19, delay: 4.5 },
  { left: 47, size: 6, dur: 12, delay: 8 },
  { left: 55, size: 9, dur: 16, delay: 2 },
  { left: 63, size: 5, dur: 14, delay: 5.5 },
  { left: 71, size: 11, dur: 18, delay: 0.8 },
  { left: 79, size: 7, dur: 13, delay: 7 },
  { left: 87, size: 9, dur: 16, delay: 3.6 },
  { left: 94, size: 6, dur: 12, delay: 9 },
];
function Drift({ scale }: { scale: number }) {
  return (
    <>
      {MOTES.map((m, i) => {
        const d = m.size * scale;
        return (
          <span
            key={i}
            className="lvd-drift-mote absolute rounded-full"
            style={
              {
                left: `${m.left}%`,
                bottom: '-5%',
                width: d,
                height: d,
                background: 'var(--lvd-pat)',
                ['--dur']: `${m.dur}s`,
                ['--delay']: `${m.delay}s`,
              } as Vars
            }
          />
        );
      })}
    </>
  );
}

// ── Aurora ──────────────────────────────────────────────────────────────
// Large blurred glows that slowly drift and breathe, a calm coloured wash.
// Resting frame: soft static glows.
const GLOWS: { top: number; left: number; size: number; dx: number; dy: number; dur: number }[] = [
  { top: 8, left: 12, size: 46, dx: 8, dy: 6, dur: 26 },
  { top: 44, left: 58, size: 54, dx: -10, dy: 8, dur: 32 },
  { top: 62, left: 18, size: 40, dx: 7, dy: -9, dur: 29 },
  { top: 18, left: 70, size: 50, dx: -6, dy: -7, dur: 35 },
];
function Aurora({ scale }: { scale: number }) {
  return (
    <>
      {GLOWS.map((g, i) => {
        const s = g.size * scale;
        return (
          <span
            key={i}
            className="lvd-aurora-glow absolute rounded-full"
            style={
              {
                top: `${g.top}%`,
                left: `${g.left}%`,
                width: `${s}vmax`,
                height: `${s}vmax`,
                background: 'radial-gradient(circle, var(--lvd-pat) 0%, transparent 70%)',
                filter: 'blur(28px)',
                ['--dx']: `${g.dx}%`,
                ['--dy']: `${g.dy}%`,
                ['--dur']: `${g.dur}s`,
              } as Vars
            }
          />
        );
      })}
    </>
  );
}

// ── Ripple ──────────────────────────────────────────────────────────────
// Concentric rings that expand and fade from a handful of origins, like
// raindrops on water. Resting frame: a set of still concentric rings.
const RIPPLE_ORIGINS: { top: number; left: number; dur: number }[] = [
  { top: 26, left: 20, dur: 9 },
  { top: 68, left: 40, dur: 11 },
  { top: 38, left: 72, dur: 10 },
  { top: 80, left: 82, dur: 12 },
];
const RINGS_PER_ORIGIN = 3;
function Ripple({ scale }: { scale: number }) {
  const base = 26 * scale; // resting ring diameter in vmax units feels right small
  return (
    <>
      {RIPPLE_ORIGINS.map((o, i) =>
        Array.from({ length: RINGS_PER_ORIGIN }, (_, r) => (
          <span
            key={`${i}-${r}`}
            className="lvd-ripple-ring absolute rounded-full"
            style={
              {
                top: `${o.top}%`,
                left: `${o.left}%`,
                width: `${base}vmax`,
                height: `${base}vmax`,
                marginTop: `${-base / 2}vmax`,
                marginLeft: `${-base / 2}vmax`,
                border: '2px solid var(--lvd-pat)',
                ['--dur']: `${o.dur}s`,
                // Stagger the rings of one origin across its period so a
                // new ring is always emerging as the outer one fades.
                ['--delay']: `${(o.dur / RINGS_PER_ORIGIN) * r}s`,
              } as Vars
            }
          />
        )),
      )}
    </>
  );
}

// ── Ribbons ──────────────────────────────────────────────────────────────
// Thick curved lines that slowly draw + flow along their paths: the canvas
// port of the new-diagram page's AnimatedLinesBackdrop, but coloured from
// the theme. The new-page version uses a fixed rainbow palette; here every
// ribbon is a tint / shade of the tab's pattern colour, so the effect stays
// "theme related" while keeping the layered, multi-tone depth. Resting
// frame: the dashed curves, drawn in place.
const RIBBONS: { d: string; width: number; dur: number; delay: number }[] = [
  { d: 'M-50 160 C 250 60, 520 300, 820 170 S 1320 60, 1500 220', width: 10, dur: 58, delay: 0 },
  {
    d: 'M-50 360 C 200 480, 540 240, 800 400 S 1280 520, 1500 360',
    width: 12,
    dur: 70,
    delay: -14,
  },
  { d: 'M-50 560 C 260 460, 520 700, 840 560 S 1300 460, 1500 600', width: 9, dur: 64, delay: -28 },
  { d: 'M-50 700 C 240 620, 560 820, 860 700 S 1280 640, 1500 760', width: 11, dur: 80, delay: -8 },
  { d: 'M-50 40 C 300 140, 560 -40, 880 80 S 1320 200, 1500 60', width: 8, dur: 74, delay: -40 },
];
function Ribbons({ scale, color }: { scale: number; color: string }) {
  // Five tones of the one pattern colour give the layered look without
  // leaving the theme: the base, two lighter tints, two darker shades.
  const tones = [color, tint(color, 0.4), shade(color, 0.3), tint(color, 0.7), shade(color, 0.5)];
  return (
    <svg
      className="h-full w-full"
      viewBox="0 0 1450 800"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      {RIBBONS.map((r, i) => (
        <path
          key={i}
          className="lvd-ribbon"
          d={r.d}
          stroke={tones[i % tones.length]}
          strokeWidth={r.width * scale}
          strokeLinecap="round"
          pathLength={100}
          style={{ ['--dur']: `${r.dur}s`, ['--delay']: `${r.delay}s` } as Vars}
        />
      ))}
    </svg>
  );
}

// All keyframes + the reduced-motion freeze in one block. Element opacities
// are kept modest so the patterns stay a backdrop, never competing with the
// diagram content on top.
const KEYFRAMES = `
  .lvd-flow-line {
    opacity: 0.4;
    animation: lvd-flow var(--dur) linear infinite;
  }
  @keyframes lvd-flow { to { stroke-dashoffset: -280; } }

  .lvd-drift-mote {
    opacity: 0.4;
    animation: lvd-drift var(--dur) ease-in-out var(--delay) infinite;
  }
  @keyframes lvd-drift {
    0% { transform: translateY(0); opacity: 0; }
    12% { opacity: 0.5; }
    85% { opacity: 0.45; }
    100% { transform: translateY(-115vh); opacity: 0; }
  }

  .lvd-aurora-glow {
    opacity: 0.72;
    animation: lvd-aurora var(--dur) ease-in-out infinite;
  }
  @keyframes lvd-aurora {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(var(--dx), var(--dy)) scale(1.3); }
  }

  .lvd-ripple-ring {
    opacity: 0.35;
    animation: lvd-ripple var(--dur) ease-out var(--delay) infinite;
  }
  @keyframes lvd-ripple {
    0% { transform: scale(0.25); opacity: 0.5; }
    100% { transform: scale(1.7); opacity: 0; }
  }

  .lvd-ribbon {
    opacity: 0.45;
    stroke-dasharray: 45 55;
    animation: lvd-ribbon-flow var(--dur) linear var(--delay) infinite;
  }
  @keyframes lvd-ribbon-flow { to { stroke-dashoffset: -200; } }

  @media (prefers-reduced-motion: reduce) {
    .lvd-flow-line,
    .lvd-drift-mote,
    .lvd-aurora-glow,
    .lvd-ripple-ring,
    .lvd-ribbon { animation: none; }
  }
`;
