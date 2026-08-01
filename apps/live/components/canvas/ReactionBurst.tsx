'use client';

import { useEffect, useMemo, useState } from 'react';

import { REACTION_EMOJI, type Reaction } from '@livediagram/diagram';

// The burst a Reaction Pad throws (spec/135).
//
// Particles are plain absolutely-positioned spans on a CSS animation, not a
// canvas: a burst lasts a second and a half and there are a dozen of them, so
// a second rendering surface (with its own resize, DPI and z-order problems,
// sitting over a canvas that already has an isometric 3D transform on it)
// would cost far more than it saves.
//
// Nothing here is document state. A burst is not stored, not undoable, and not
// replayed to somebody who arrives late — see the `reaction` room op. It plays
// and it is gone.

/** How long a burst lives, in ms. Matches the CSS animation duration. */
export const BURST_MS = 1500;

type Particle = {
  id: number;
  /** Horizontal landing offset, in element widths from the centre. */
  dx: number;
  /** Vertical landing offset, in element heights from the centre. */
  dy: number;
  rotate: number;
  scale: number;
  delay: number;
};

// Each reaction throws its particles differently, because the SHAPE of the
// motion is most of what distinguishes them at a glance:
//   confetti  — up and out, then down past the bottom: thrown paper
//   sparkles  — a tight twinkle close to the pad, barely moving
//   hearts    — a slow, narrow float straight up
//   applause  — a wide low arc, like hands raised on both sides
//   fireworks — a hard radial burst, even in every direction
function makeParticles(reaction: Reaction, seed: number): Particle[] {
  // Deterministic per burst rather than Math.random: two bursts from the same
  // pad should not be identical, but a single burst must not resample itself
  // on a re-render mid-flight and have every particle jump.
  let s = seed || 1;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const count = reaction === 'sparkles' ? 10 : reaction === 'hearts' ? 8 : 14;
  return Array.from({ length: count }, (_, id) => {
    const t = rand();
    const u = rand();
    switch (reaction) {
      case 'sparkles':
        return {
          id,
          dx: (t - 0.5) * 1.6,
          dy: (u - 0.5) * 1.6,
          rotate: 0,
          scale: 0.5 + u * 0.5,
          delay: t * 260,
        };
      case 'hearts':
        return {
          id,
          dx: (t - 0.5) * 0.9,
          dy: -1.4 - u * 1.2,
          rotate: (t - 0.5) * 30,
          scale: 0.6 + u * 0.6,
          delay: t * 420,
        };
      case 'applause':
        return {
          id,
          // Pushed to the sides rather than up: hands, not fireworks.
          dx: (t < 0.5 ? -1 : 1) * (0.9 + u * 1.5),
          dy: -0.3 - u * 0.9,
          rotate: (t < 0.5 ? -1 : 1) * (10 + u * 25),
          scale: 0.6 + u * 0.5,
          delay: t * 300,
        };
      case 'fireworks': {
        const angle = (id / count) * Math.PI * 2;
        const radius = 1.5 + u * 0.9;
        return {
          id,
          dx: Math.cos(angle) * radius,
          dy: Math.sin(angle) * radius,
          rotate: (angle * 180) / Math.PI,
          scale: 0.55 + u * 0.5,
          delay: u * 120,
        };
      }
      case 'confetti':
      default:
        return {
          id,
          dx: (t - 0.5) * 3,
          // Ends BELOW the pad: thrown up, then gravity.
          dy: 1.1 + u * 1.4,
          rotate: (t - 0.5) * 540,
          scale: 0.5 + u * 0.6,
          delay: t * 200,
        };
    }
  });
}

export function ReactionBurst({
  reaction,
  seed,
  onDone,
}: {
  reaction: Reaction;
  // Changes per burst, so the particles differ each press and React remounts.
  seed: number;
  onDone: () => void;
}) {
  const particles = useMemo(() => makeParticles(reaction, seed), [reaction, seed]);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setGone(true);
      onDone();
    }, BURST_MS);
    return () => window.clearTimeout(id);
    // `onDone` is a fresh closure each render; the timer is keyed on the burst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, reaction]);

  if (gone) return null;
  return (
    // Pointer-inert and overflow-visible: the burst leaves the element's box on
    // purpose, and must never take a click away from the pad it came from.
    // The container the particles measure against, for BOTH their size and
    // their travel. `container-type: size` rather than Tailwind's `@container`
    // (which is inline-size only) because the offsets are in element HEIGHTS
    // as well as widths; the span is `absolute inset-0`, so it has the
    // definite height that needs.
    <span
      className="pointer-events-none absolute inset-0 z-10 block"
      style={{ containerType: 'size' }}
      aria-hidden
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="lvd-reaction-particle absolute left-1/2 top-1/2 block leading-none"
          style={
            {
              fontSize: '18cqw',
              animationDelay: `${p.delay}ms`,
              // Container units, NOT percentages. A percentage inside
              // `translate()` resolves against the element being transformed —
              // the 27px particle — so `dx: 3` moved it 81px instead of three
              // pad-widths, and the whole burst stayed huddled on the pad.
              '--lvd-rx': `${p.dx * 100}cqw`,
              '--lvd-ry': `${p.dy * 100}cqh`,
              '--lvd-rot': `${p.rotate}deg`,
              '--lvd-rscale': String(p.scale),
            } as React.CSSProperties
          }
        >
          {REACTION_EMOJI[reaction]}
        </span>
      ))}
    </span>
  );
}
