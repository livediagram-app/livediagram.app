// Where everyone arrives in a Space (docs/specs/009-elements/avatar-pad.md "Every Space and blank tab has one"): its
// Avatar Pad, in the middle of the action (the busiest shared room, the courtyard, the lobby), on open floor, with the
// how-to line centred under it, so someone joining lands where the people are and reads what to do at their feet. It
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

export type Arrival = {
  // The pad's centre, canvas px.
  x: number;
  y: number;
  hint: string;
  // At most ARRIVAL_HINT_W: the line stays within 180 px either side of the pad's centre, so a phone's view centred
  // on someone arriving (390 px wide at 100%) shows it whole.
  hintW?: number;
};

const PAD_W = AVATAR_PAD_DEFAULT_SIZE.width;
const PAD_H = AVATAR_PAD_DEFAULT_SIZE.height;

// The how-to line's widest, and its gap under the pad.
export const ARRIVAL_HINT_W = 360;
const ARRIVAL_HINT_BELOW = 8;
// A small (`sm`) line of the canvas's text: its height, and the average width of a character, so the box is as tall
// as the wrapped line and no taller (an over-tall box reaches into the furniture the tests keep it clear of).
const LINE_H = 22;
const CHAR_W = 7.4;

/** How tall the how-to line wraps to at `width`. */
function arrivalHintHeight(hint: string, width: number): number {
  return Math.max(1, Math.ceil((hint.length * CHAR_W) / width)) * LINE_H;
}

/** The Space's arrival: its Avatar Pad centred on (x, y) and the how-to line centred under it. */
export function arrival({ x, y, hint, hintW = ARRIVAL_HINT_W }: Arrival): Element[] {
  const width = Math.min(hintW, ARRIVAL_HINT_W);
  return [
    {
      ...createText(x - width / 2, y + PAD_H / 2 + ARRIVAL_HINT_BELOW),
      width,
      height: arrivalHintHeight(hint, width),
      label: hint,
      textSize: 'sm',
      textAlignX: 'center',
      // No ink of its own: it lies on a room's floor, a lobby or the lawn, each light in a light half and dark in a dark
      // one, so the half's own ink reads on all of them (a fixed slate sank into the dark lawn, and the light one).
    },
    createShape('avatar-pad', x - PAD_W / 2, y - PAD_H / 2),
  ];
}
