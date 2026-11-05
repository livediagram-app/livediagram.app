import type { Element as CanvasElement, ShapeKind } from '@livehuddle/document';

// What a click on a piece means in Avatar mode (docs/specs/008-canvas/avatar-mode.md "Clicking a piece"): `walk`
// walks the character there (and arriving does what it does: sit, drink, travel), `use` does the piece's main action
// in place, and `read` opens the element large in the reader. Only `walk` moves the character. The canvas layer is
// pointer-inert while walking, so the piece under a click is found from the click's point (lib/avatar-press-target).
//
// One entry per element type and shape kind, typed exhaustively so a new kind fails to compile until it is
// classified (and the test enumerates the runtime lists too). A constant-time lookup: it runs once per click.

export type AvatarClickIntent = 'walk' | 'use' | 'read';

/** The kind a press reads off an element: a shape's kind, else the element's type. */
export type AvatarClickKind = ShapeKind | Exclude<CanvasElement['type'], 'shape'>;

/** What a box marks itself with, so a press can read its kind without a lookup. */
export const ELEMENT_KIND_ATTR = 'data-element-kind';

/** The face control that is a `use` piece's main action, pressed from anywhere on the piece while walking. */
export const PIECE_MAIN_ATTR = 'data-piece-main';

const W = 'walk';
const U = 'use';
const R = 'read';

/** Every kind's intent: exported so the test can hold its keys against the runtime kind lists. */
export const AVATAR_CLICK_INTENTS: Readonly<Record<AvatarClickKind, AvatarClickIntent>> = {
  // Use: the piece's main action from anywhere on its footprint (data-piece-main), or the reader when it has none.
  directory: U,
  elevator: U,
  portal: U,
  'mode-button': U,
  'focus-button': U,
  'notice-board': U,
  'world-clock': U,
  screen: U,
  'room-sign': U,
  // The Timer and Stopwatch (docs/specs/009-elements/timer-and-stopwatch.md): Start or Pause from anywhere on them.
  timer: U,
  stopwatch: U,
  jukebox: U,
  'link-card': U,
  video: U,
  // Walk: standing on it, or going into it, is the point.
  'avatar-pad': W,
  stage: W,
  room: W,
  'office-pod': W,
  rug: W,
  grass: W,
  'garden-path': W,
  // Walk: a Door, swung instead when the character is next to it (the gesture adds that: lib/avatar-door-press).
  door: W,
  // Walk: seats; arriving sits you.
  chair: W,
  desk: W,
  sofa: W,
  'meeting-table': W,
  'bar-stool': W,
  bench: W,
  'picnic-table': W,
  hammock: W,
  'ping-pong-table': W,
  // Walk: arriving gives you a drink.
  'water-cooler': W,
  'coffee-machine': W,
  'drinks-cabinet': W,
  'drinks-fridge': W,
  // Walk: proximity is the point (Insert Coin).
  'arcade-machine': W,
  // Walk: scenery; the walk stops beside it.
  plant: W,
  bookshelf: W,
  'outdoor-plant': W,
  tree: W,
  fence: W,
  'garden-fence': W,
  bar: W,
  fireplace: W,
  campfire: W,
  fountain: W,
  pond: W,
  'garden-umbrella': W,
  // Walk: areas drawn round other things, and lines and marks with nothing to read.
  lane: W,
  boundary: W,
  arrow: W,
  freehand: W,
  path: W,
  sticker: W,
  icon: W,
  // Read: their own reader bodies.
  sticky: R,
  text: R,
  image: R,
  // Read: the element's own drawing, scaled up in the reader.
  square: R,
  circle: R,
  diamond: R,
  cylinder: R,
  parallelogram: R,
  hexagon: R,
  document: R,
  page: R,
  banner: R,
  callout: R,
  card: R,
  badge: R,
  step: R,
  'pointer-note': R,
  'diagram-key': R,
  stack: R,
  'stat-row': R,
  process: R,
  'site-header': R,
  stadium: R,
  actor: R,
  'final-state': R,
  cloud: R,
  triangle: R,
  trapezoid: R,
  star: R,
  'speech-bubble': R,
  'progress-bar': R,
  'progress-ring': R,
  'timeline-rail': R,
  rating: R,
  'pie-chart': R,
  'bar-chart': R,
  'line-chart': R,
  'code-block': R,
  checklist: R,
  legend: R,
  table: R,
  annotation: R,
};

/** A click's intent on a kind; an unknown (retired) kind walks, as the floor does. */
export function avatarClickIntent(kind: string | null | undefined): AvatarClickIntent {
  return (
    (kind &&
      Object.hasOwn(AVATAR_CLICK_INTENTS, kind) &&
      AVATAR_CLICK_INTENTS[kind as AvatarClickKind]) ||
    'walk'
  );
}

/** The kind a box carries for `ELEMENT_KIND_ATTR`. */
export function elementClickKind(el: CanvasElement): AvatarClickKind {
  return el.type === 'shape' ? el.shape : el.type;
}

/** Whether a press in Avatar mode landed on a pressable part of a piece that is not walked to, so it acts there. */
export function isInPlacePress(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false;
  const box = target.closest(`[${ELEMENT_KIND_ATTR}]`);
  return box !== null && avatarClickIntent(box.getAttribute(ELEMENT_KIND_ATTR)) !== 'walk';
}

/** Presses a piece's main action (its `data-piece-main` control); false when it has none right now. */
export function pressPieceMain(elementId: string): boolean {
  if (typeof document === 'undefined') return false;
  const main = document.querySelector<HTMLElement>(
    `[data-element-id="${CSS.escape(elementId)}"] [${PIECE_MAIN_ATTR}]`,
  );
  if (!main) return false;
  main.click();
  return true;
}
