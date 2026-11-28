// Where everyone arrives in a Space (docs/specs/009-elements/avatar-pad.md "Every Space and blank tab has one"): its
// Avatar Pad, in the middle of the action (the busiest shared room, the courtyard, the lobby), on open floor, so
// someone joining lands where the people are. It replaced the way in under the plan's bottom-right corner, which left
// the newcomer at the edge of the Space and, seen from a seat at 100%, under the canvas's bottom-right cluster (Work
// Tracker #601, #584). The how-to line that stood under it went with every text element
// (docs/specs/002-project-scope/not-in-livehuddle.md "The Write category").
//
// Pure: arrival returns a fresh [pad].

import { AVATAR_PAD_DEFAULT_SIZE, createShape, type Element } from '@livehuddle/document';

export type Arrival = {
  // The pad's centre, canvas px.
  x: number;
  y: number;
};

const PAD_W = AVATAR_PAD_DEFAULT_SIZE.width;
const PAD_H = AVATAR_PAD_DEFAULT_SIZE.height;

/** The Space's arrival: its Avatar Pad centred on (x, y). */
export function arrival({ x, y }: Arrival): Element[] {
  return [createShape('avatar-pad', x - PAD_W / 2, y - PAD_H / 2)];
}
