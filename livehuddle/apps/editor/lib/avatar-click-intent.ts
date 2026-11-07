import { pieceFacing, type Element as CanvasElement, type ShapeKind } from '@livehuddle/document';
import { officeFootprint } from '@liveworkspace/avatar/office-geometry';

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
  stairs: U,
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
  'bean-bag': W,
  'reading-nook': W,
  // Walk: the office amenities (docs/specs/009-elements/office-amenities.md): scenery you stand by, and the hand dryer,
  // microwave and kettle, walked past as wall pieces (the counter under the last two is what you walk to).
  printer: W,
  copier: W,
  lockers: W,
  'coat-rack': W,
  'umbrella-stand': W,
  'kitchen-counter': W,
  'kitchen-sink': W,
  fridge: W,
  microwave: W,
  kettle: W,
  'toilet-cubicle': W,
  washbasin: W,
  'hand-dryer': W,
  // Walk: the venue pieces (docs/specs/009-elements/venue-pieces.md): scenery you stand by, the pool's deck, and the
  // stage curtains, walked between as a wall piece (the stage under them is what you walk to).
  pillar: W,
  column: W,
  'car-park': W,
  'bike-rack': W,
  'swimming-pool': W,
  'stage-curtains': W,
  podium: W,
  // Walk: the workday pieces (docs/specs/009-elements/workday-pieces.md): seats you sit or stand in (arriving sits
  // you, and may set your status), the pet bed you walk over, and the reception desk you walk up to (Welcome).
  'nap-pod': W,
  treadmill: W,
  'weight-bench': W,
  'phone-booth': W,
  'standing-desk': W,
  'hot-desk': W,
  'pet-bed': W,
  'reception-desk': W,
  // The team pieces (docs/specs/009-elements/team-pieces.md): the calendar and the box open, the signpost walks to its
  // top board's place; the photo wall is walked to, like a picture.
  'calendar-wall': U,
  'suggestion-box': U,
  signpost: U,
  'photo-wall': W,
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
  'pool-table': W,
  'foosball-table': W,
  'vending-machine': W,
  // Walk: a wall piece, walked past, never rung: a click is a click on the floor in front of it.
  dartboard: W,
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

/**
 * The Use pieces that are only a control: a press of their main action is all they offer, so with none of yours right
 * now (a Participant or a Viewer, who always walk; an Editor while someone else holds the baton; a Viewer's Timer) a
 * click does nothing. Their reader would be the same face, larger and still not pressable (docs/specs/008-canvas/
 * avatar-mode.md "Clicking a piece"; docs/specs/013-workspace/share-roles.md "Always walking").
 */
export const NO_READER_KINDS: ReadonlySet<AvatarClickKind> = new Set<AvatarClickKind>([
  'focus-button',
  'mode-button',
  'timer',
  'stopwatch',
  // A Signpost with no places yet has no arrow to press (team-pieces.md "Signpost").
  'signpost',
]);

/** What a walking click on a piece does, once its intent and whether it has a main action right now are known. */
export type AvatarPressOutcome = 'walk' | 'press' | 'read' | 'nothing';

export function avatarPressOutcome(
  kind: string | null | undefined,
  hasMain: boolean,
): AvatarPressOutcome {
  const intent = avatarClickIntent(kind);
  if (intent === 'walk') return 'walk';
  if (intent === 'use' && hasMain) return 'press';
  if (intent === 'use' && NO_READER_KINDS.has(kind as AvatarClickKind)) return 'nothing';
  return 'read';
}

/** The kind a box carries for `ELEMENT_KIND_ATTR`. */
export function elementClickKind(el: CanvasElement): AvatarClickKind {
  return el.type === 'shape' ? el.shape : el.type;
}

// The pieces walked up to at their front, which is where arriving does its thing (the Reception Desk's Welcome, the
// Arcade's Insert Coin): a click anywhere on one walks you to the floor just in front of it, under the click, as a seat
// sits you wherever on it you click, never to the floor behind or inside it (docs/specs/008-canvas/avatar-mode.md
// "Clicking a piece").
const FRONT_KINDS: ReadonlySet<string> = new Set(['reception-desk', 'arcade-machine']);
/** How far below a front piece's box its walk ends, in canvas px: clear of its footprint and inside its front strip. */
export const FRONT_STAND = 16;
/** How far in from a front piece's ends its walk ends, as a share of its width: on its front, never round its side. */
const FRONT_END = 0.12;

/**
 * Where a walking click on `el` at `point` walks to: the point itself, or, on an unturned Reception Desk or Arcade
 * Machine, the floor FRONT_STAND below its box under the click (kept off its ends). One turned to face
 * another way (docs/specs/009-elements/furniture-facing.md) has its front there: the floor FRONT_STAND beyond its
 * footprint on that side, beside the middle of its footprint's depth on its side, under the click from behind.
 */
export function walkPointFor(
  el: CanvasElement | null,
  point: { x: number; y: number },
): { x: number; y: number } {
  if (!el || el.type !== 'shape' || !FRONT_KINDS.has(el.shape) || (el.rotation ?? 0) % 360 !== 0)
    return point;
  // The arcade's bubble and the Reception Desk's Welcome follow their turned front (useSocialPieces arcadeAt,
  // useWorkdayPieces receptionAt), so the walk ends there.
  const facing = pieceFacing(el);
  const foot = facing === 'n' ? null : officeFootprint({ ...el, chairFacing: facing });
  if (foot && (facing === 'e' || facing === 'w'))
    return {
      x: facing === 'e' ? foot.x - FRONT_STAND : foot.x + foot.width + FRONT_STAND,
      y: foot.y + foot.height / 2,
    };
  const lo = el.x + el.width * FRONT_END;
  const hi = el.x + el.width * (1 - FRONT_END);
  const x = Math.min(hi, Math.max(lo, point.x));
  return foot ? { x, y: foot.y - FRONT_STAND } : { x, y: el.y + el.height + FRONT_STAND };
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
