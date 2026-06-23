// Spotlight presenter tool state (spec/09), lifted out of Canvas so the
// click handlers, the pointer-move tracker, and the overlay all share one
// source of truth without bloating Canvas.tsx further.
//
// Spotlight is a LOCAL view aid: it dims the canvas and keeps a soft circle
// of light around the cursor clear. The light follows the pointer in SCREEN
// space (it must not pan / zoom with the diagram), so `pos` is stored in
// pixels relative to the canvas <main>, not in canvas-coords. Left-click
// grows the light, right-click shrinks it; the radius is clamped and
// persists across tool switches (the hook outlives a Pan/Select detour
// because Canvas stays mounted).

import { useState } from 'react';

// Light radius bounds + the default it opens at, in screen px. The min keeps
// the beam from collapsing into a useless pinhole; the max stops it from
// lighting the whole canvas (at which point the tool does nothing).
const SPOTLIGHT_MIN_RADIUS = 70;
const SPOTLIGHT_MAX_RADIUS = 600;
const SPOTLIGHT_DEFAULT_RADIUS = 170;
// Multiplicative step per click — a geometric ramp so each click feels like
// the same proportional change whether the light is small or large.
const SPOTLIGHT_STEP = 1.25;

const clampRadius = (r: number) =>
  Math.round(Math.max(SPOTLIGHT_MIN_RADIUS, Math.min(SPOTLIGHT_MAX_RADIUS, r)));

export function useSpotlight() {
  // Light centre in <main>-relative px. Null until the pointer first moves
  // over the canvas; the overlay centres the beam in the meantime so the
  // shroud is visible the instant the tool is picked.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [radius, setRadius] = useState(SPOTLIGHT_DEFAULT_RADIUS);
  const grow = () => setRadius((r) => clampRadius(r * SPOTLIGHT_STEP));
  const shrink = () => setRadius((r) => clampRadius(r / SPOTLIGHT_STEP));
  return { pos, setPos, radius, grow, shrink };
}
