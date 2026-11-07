// Where everyone arrives in a Space (docs/specs/009-elements/avatar-pad.md "Every Space and blank tab has one"): its
// Avatar Pad, in the middle of the action (the busiest shared room, the courtyard, the lobby), on open floor, with the
// how-to line beside it, so someone joining lands where the people are and reads what to do at their feet. It
// replaced the way in under the plan's bottom-right corner, which left the newcomer at the edge of the Space and, seen
// from a seat at 100%, under the canvas's bottom-right cluster (Work Tracker #601, #584).
//
// Pure: arrival returns a fresh [how-to line, pad].

import {
  AVATAR_PAD_DEFAULT_SIZE,
  createShape,
  createText,
  type Element,
} from '@livehuddle/document';

// Which side of the pad the how-to line stands on: under it, centred, where the floor is wide enough; otherwise
// beside it, ending (left) or starting (right) ARRIVAL_HINT_BESIDE px from the pad, level with it.
type ArrivalHintSide = 'below' | 'left' | 'right';

export type Arrival = {
  // The pad's centre, canvas px.
  x: number;
  y: number;
  hint: string;
  side?: ArrivalHintSide;
  hintW?: number;
};

const PAD_W = AVATAR_PAD_DEFAULT_SIZE.width;
const PAD_H = AVATAR_PAD_DEFAULT_SIZE.height;

// The how-to line's default width, and its gap under the pad or beside it.
const ARRIVAL_HINT_W = 400;
const ARRIVAL_HINT_BELOW = 8;
const ARRIVAL_HINT_BESIDE = 20;
// A small (`sm`) line of the canvas's text: its height, and the average width of a character, so the box is as tall
// as the wrapped line and no taller (an over-tall box reaches into the furniture the tests keep it clear of).
const LINE_H = 22;
const CHAR_W = 7.4;

/** How tall the how-to line wraps to at `width`. */
function arrivalHintHeight(hint: string, width: number): number {
  return Math.max(1, Math.ceil((hint.length * CHAR_W) / width)) * LINE_H;
}

/** The how-to line's box for a pad centred on (x, y). */
function arrivalHintBox({ x, y, hint, side = 'below', hintW = ARRIVAL_HINT_W }: Arrival): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const height = arrivalHintHeight(hint, hintW);
  if (side === 'below')
    return { x: x - hintW / 2, y: y + PAD_H / 2 + ARRIVAL_HINT_BELOW, width: hintW, height };
  const left =
    side === 'left'
      ? x - PAD_W / 2 - ARRIVAL_HINT_BESIDE - hintW
      : x + PAD_W / 2 + ARRIVAL_HINT_BESIDE;
  return { x: left, y: y - height / 2, width: hintW, height };
}

/** The Space's arrival: its Avatar Pad centred on (x, y) and the how-to line on `side` of it. */
export function arrival(spot: Arrival): Element[] {
  const box = arrivalHintBox(spot);
  const side = spot.side ?? 'below';
  return [
    {
      ...createText(box.x, box.y),
      ...box,
      label: spot.hint,
      textSize: 'sm',
      textAlignX: side === 'below' ? 'center' : side === 'left' ? 'right' : 'left',
      // No ink of its own: it lies on a room's floor, a lobby or the lawn, each light in a light half and dark in a dark
      // one, so the half's own ink reads on all of them (a fixed slate sank into the dark lawn, and the light one).
    },
    createShape('avatar-pad', spot.x - PAD_W / 2, spot.y - PAD_H / 2),
  ];
}
