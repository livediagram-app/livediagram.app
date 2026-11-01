// The Avatar Pad's part in Avatar mode (docs/specs/009-elements/avatar-pad.md): which pad a character starts on, and
// which characters have just arrived on one. Pure: no React, no DOM, so the spawn rule and the arrival rule are
// unit-testable without a canvas.

import { avatarPadCore, avatarPadFootprint } from './pad-art';
import { isSceneShape, type AvatarSceneElement, type SceneShapeOf } from './scene';
import type { AvatarPoint } from './walk';

// A pad as the spawn and arrival rules read it: its id and its box.
export type AvatarPadBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
};

// How long an arrival beam plays, in ms (the `avatar-pad-beam` keyframes in canvas-motion.css run this long).
export const AVATAR_PAD_ARRIVAL_MS = 900;
// The most beams one screen plays at once; the oldest goes first. A room of forty arriving together would otherwise
// fill the canvas with light.
export const AVATAR_PAD_MAX_ARRIVALS = 8;

const isPad = <E extends AvatarSceneElement>(el: E): el is SceneShapeOf<E> =>
  isSceneShape(el) && el.shape === 'avatar-pad';

/** The tab's pads, in layer order (back to front). The caller passes what is drawn: a hidden layer's are gone. */
export function avatarPads<E extends AvatarSceneElement>(
  elements: readonly E[],
): SceneShapeOf<E>[] {
  return elements.filter(isPad);
}

/**
 * The pad a character entering Avatar mode starts on (docs/specs/009-elements/avatar-pad.md "Starting on the pad"):
 * the one whose core is nearest the centre of the view, the first in layer order on a tie. Null when the tab has none.
 */
export function pickSpawnPad<P extends AvatarPadBox>(
  pads: readonly P[],
  viewCentre: AvatarPoint | null,
): P | null {
  let best: P | null = null;
  let bestDistance = Infinity;
  for (const pad of pads) {
    if (!viewCentre) return pad;
    const core = avatarPadCore(pad);
    const distance = Math.hypot(core.x - viewCentre.x, core.y - viewCentre.y);
    // Strictly nearer: an exact tie keeps the earlier (further back) pad, the same on every screen.
    if (distance < bestDistance) {
      best = pad;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Where entering Avatar mode puts the character when the tab has a pad: its feet on the chosen pad's core, and
 * whether the view must centre on it (the core is off screen). Null when the tab has no pad, so entry falls through to
 * the button, the remembered spot and the view's centre.
 */
export function padEntry<E extends AvatarSceneElement>(
  elements: readonly E[],
  viewCentre: AvatarPoint | null,
  onScreen: (point: AvatarPoint) => boolean,
): { pad: SceneShapeOf<E>; feet: AvatarPoint; recentre: boolean } | null {
  const pad = pickSpawnPad(avatarPads(elements), viewCentre);
  if (!pad) return null;
  const feet = avatarPadCore(pad);
  return { pad, feet, recentre: !onScreen(feet) };
}

/** The pad a character's feet stand on, or null: inside the top face's ellipse, the frontmost pad winning. */
export function padUnderFeet<P extends AvatarPadBox>(
  pads: readonly P[],
  feet: AvatarPoint,
): P | null {
  let hit: P | null = null;
  for (const pad of pads) {
    const core = avatarPadCore(pad);
    const { rx, ry } = avatarPadFootprint(pad);
    if (rx <= 0 || ry <= 0) continue;
    if (((feet.x - core.x) / rx) ** 2 + ((feet.y - core.y) / ry) ** 2 <= 1) hit = pad;
  }
  return hit;
}

/** A character on screen, as the arrival tracker sees it: who, where its feet are, and its colour. */
export type ArrivalCandidate = { id: string; x: number; y: number; color: string };

/** One beam playing: on which pad, in whose colour, since when. `key` changes with every arrival. */
export type PadArrival = {
  key: string;
  personId: string;
  padId: string;
  x: number;
  y: number;
  color: string;
  startedAt: number;
};

/**
 * The arrivals after this frame of presence (docs/specs/009-elements/avatar-pad.md "The arrival"): a character
 * that was not on screen before (`seen`) and now stands on a pad starts a beam on it. Finished beams are dropped,
 * a person's new beam replaces theirs, and at most `AVATAR_PAD_MAX_ARRIVALS` play, oldest dropped first. Returns
 * the SAME array when nothing changed, so a caller holding it in state skips the render.
 */
export function nextArrivals(input: {
  arrivals: readonly PadArrival[];
  seen: ReadonlySet<string>;
  present: readonly ArrivalCandidate[];
  pads: readonly AvatarPadBox[];
  now: number;
}): readonly PadArrival[] {
  const { arrivals, seen, present, pads, now } = input;
  let next = arrivals.filter((a) => now - a.startedAt < AVATAR_PAD_ARRIVAL_MS);
  let changed = next.length !== arrivals.length;
  if (pads.length > 0) {
    for (const person of present) {
      if (seen.has(person.id)) continue;
      const pad = padUnderFeet(pads, person);
      if (!pad) continue;
      next = next.filter((a) => a.personId !== person.id);
      next.push({
        key: `${person.id}:${now}`,
        personId: person.id,
        padId: pad.id,
        x: person.x,
        y: person.y,
        color: person.color,
        startedAt: now,
      });
      changed = true;
    }
  }
  if (next.length > AVATAR_PAD_MAX_ARRIVALS) next = next.slice(-AVATAR_PAD_MAX_ARRIVALS);
  return changed ? next : arrivals;
}
