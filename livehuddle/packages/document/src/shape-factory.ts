// How a shape of kind K is born: the per-kind default size table, and the
// factory that turns a kind into a ShapeElement with that kind's own starting
// content. Lifted out of ./factories, which had reached 719 lines holding this
// alongside the factories for every OTHER element type; those stayed behind.
//
// Runtime constants come from the LEAF modules ('./data-shapes',
// './selection-mode', './collab-shapes'), NOT from './index':
// SHAPE_DEFAULT_SIZE reads RAIL_* at module-init time, and a runtime read
// through the index cycle TDZ-crashes plain-Node ESM consumers. Only TYPES
// come from './index', and those are erased at build.
import { DEFAULT_ROOM_DOOR, isOfficeShape } from './office';
import { isMeetingPieceShape, MEETING_PIECE_SIZE } from './meeting-pieces';
import { isTimerPieceShape, TIMER_PIECE_SIZE } from './timer-pieces';
import { DEFAULT_BUTTON_MODE } from './selection-mode';
import { DEFAULT_CHAIR_FACING } from './collab-shapes';
import { DEFAULT_SEATING_FACING } from './seating';
import { FENCE_DEFAULT_SIZE } from '@liveworkspace/avatar/fence';
import { AVATAR_PAD_DEFAULT_SIZE } from '@liveworkspace/avatar/pad-art';
import type { ShapeElement, ShapeKind } from './index';

// --- Factories -------------------------------------------------------------

// Default size per shape kind. Uniform 120 for square / circle / diamond,
// natural aspect ratios for the flowchart-vocabulary shapes (cylinder
// taller than wide, parallelogram + hexagon + document wider than tall).
// Exported so the editor can offer "reset to default aspect ratio" — the
// width:height proportion here is each shape's canonical look.
export const SHAPE_DEFAULT_SIZE: Record<ShapeKind, { width: number; height: number }> = {
  square: { width: 120, height: 120 },
  circle: { width: 120, height: 120 },
  diamond: { width: 120, height: 120 },
  cylinder: { width: 100, height: 140 },
  parallelogram: { width: 160, height: 100 },
  hexagon: { width: 140, height: 120 },
  document: { width: 140, height: 110 },
  // Lane (docs/specs/009-elements/lane.md): a band, not a box — wide enough to lay a flow across and
  // tall enough for a row of steps.
  lane: { width: 900, height: 200 },
  // Reaction pad: a press-me square, sized like the other Behaviour buttons.
  // Stadium / pill — the conventional flowchart "Start / End" terminator
  // shape. Wider than tall by default; the CSS `border-radius: 9999px`
  // render path means the ends stay perfectly semicircular at any
  // aspect ratio the user resizes to.
  stadium: { width: 160, height: 64 },
  // Actor (UML stickman): line-art figure with its label below. Taller
  // than wide and aspect-locked on create so the figure never distorts.
  // Default size hugs the figure tightly — earlier 90×150 left a 38-
  // unit band below the legs which read as wasted padding under bare
  // (unlabelled) stickmen. 90×130 keeps room for a short label
  // (y 112..130) without dominating the box.
  actor: { width: 90, height: 130 },
  'final-state': { width: 32, height: 32 },
  // Cloud: a container shape (networking / architecture). Stretches to
  // fit its label like the other flowchart shapes.
  cloud: { width: 180, height: 140 },
  triangle: { width: 130, height: 120 },
  trapezoid: { width: 160, height: 110 },
  star: { width: 130, height: 130 },
  // Speech bubble: wider than tall, with room for the tail beneath the body.
  'speech-bubble': { width: 180, height: 130 },
  // Curated glyph. Square + aspect-locked on create (set in createShape) so
  // the line art never distorts; the label sits below. Sized generously so a
  // two-line caption (e.g. "Durable Objects") clears the glyph rather than
  // crowding it.
  icon: { width: 120, height: 120 },
  // A sticker's default is square, which is right for the emoji half; the
  // creation path widens it for a word badge off STICKER_ASPECT, since the
  // default table is per-kind and a badge and an emoji are one kind.
  sticker: { width: 104, height: 104 },
  // Timeline (docs/specs/009-elements/timeline.md): four milestones, words above and below.
  'timeline-rail': { width: 720, height: 240 },
  // Mode button (docs/specs/009-elements/mode-button.md): a square-ish tile, sized for an icon ABOVE its
  // label — the shape a toolbar button has, rather than a wide pill that read
  // as just another labelled box.
  'mode-button': { width: 104, height: 96 },
  // Bring Focus (docs/specs/012-collaboration/bring-focus.md): the mode button's shape, a touch wider because its
  // label is a sentence fragment ("The problem") rather than a mode's one word.
  'focus-button': { width: 120, height: 96 },
  // Portal (docs/specs/009-elements/portal-element.md): portal-shaped — taller than it is wide, like a portal.
  portal: { width: 72, height: 112 },
  // Chair (docs/specs/009-elements/chair.md): furniture at human scale beside a 40px-wide Avatar-mode
  // character — a seat the sprite fits into rather than a throne it rattles
  // around in.
  chair: { width: 76, height: 84 },
  // Fence (docs/specs/009-elements/fence.md): a short run across, thin enough to read as a barrier.
  fence: { ...FENCE_DEFAULT_SIZE },
  // Avatar Pad (docs/specs/009-elements/avatar-pad.md): its pixel grid at four canvas px a pixel.
  'avatar-pad': { ...AVATAR_PAD_DEFAULT_SIZE },
  // Desk and sofa (docs/specs/009-elements/chair.md "Desk and sofa"): their drawings' grids, at the
  // chair's scale, so a character fits the seat.
  desk: { width: 120, height: 112 },
  sofa: { width: 152, height: 85 },
  // The virtual office (docs/specs/009-elements/office.md): each at its drawing's grid, at the chair's scale; a
  // room is a floor big enough to furnish.
  room: { width: 480, height: 320 },
  // A Corridor (docs/specs/009-elements/corridor.md): the Straight, one arm wide.
  corridor: { width: 480, height: 120 },
  // A Door (docs/specs/009-elements/room-builder.md): a Room's doorway wide, a wall and its jambs deep.
  door: { width: 96, height: 24 },
  // A Window (docs/specs/009-elements/room-builder.md "Window", DEFAULTS.md D228): a wall's band deep.
  window: { width: 120, height: 24 },
  'meeting-table': { width: 232, height: 168 },
  plant: { width: 56, height: 88 },
  bookshelf: { width: 120, height: 132 },
  'water-cooler': { width: 56, height: 112 },
  'coffee-machine': { width: 72, height: 96 },
  rug: { width: 200, height: 120 },
  // A stage (docs/specs/009-elements/office.md "Stage"): room for a few speakers side by side, and its front edge.
  stage: { width: 360, height: 140 },
  // The Office Pod, the bar and the garden (docs/specs/009-elements/office.md "Office Pod" to "Garden Fence").
  'office-pod': { width: 176, height: 144 },
  bar: { width: 240, height: 120 },
  'bar-stool': { width: 44, height: 64 },
  'drinks-cabinet': { width: 88, height: 120 },
  'drinks-fridge': { width: 72, height: 128 },
  'outdoor-plant': { width: 72, height: 80 },
  tree: { width: 120, height: 160 },
  'garden-path': { width: 240, height: 64 },
  grass: { width: 240, height: 160 },
  'garden-fence': { width: 200, height: 28 },
  // The social pieces (docs/specs/009-elements/social-pieces.md): each at its drawing's grid; a pond any size.
  'notice-board': { width: 176, height: 128 },
  'world-clock': { width: 168, height: 72 },
  jukebox: { width: 72, height: 112 },
  'ping-pong-table': { width: 184, height: 112 },
  'arcade-machine': { width: 64, height: 112 },
  fireplace: { width: 128, height: 120 },
  campfire: { width: 80, height: 72 },
  bench: { width: 136, height: 64 },
  'picnic-table': { width: 200, height: 152 },
  hammock: { width: 152, height: 80 },
  'garden-umbrella': { width: 120, height: 152 },
  fountain: { width: 136, height: 120 },
  pond: { width: 240, height: 152 },
  'pool-table': { width: 200, height: 128 },
  'foosball-table': { width: 168, height: 104 },
  dartboard: { width: 80, height: 96 },
  'vending-machine': { width: 72, height: 128 },
  'bean-bag': { width: 64, height: 56 },
  'reading-nook': { width: 160, height: 112 },
  // The office amenities (docs/specs/009-elements/office-amenities.md).
  printer: { width: 72, height: 80 },
  copier: { width: 104, height: 128 },
  lockers: { width: 136, height: 132 },
  'coat-rack': { width: 56, height: 128 },
  'umbrella-stand': { width: 40, height: 64 },
  'kitchen-counter': { width: 112, height: 88 },
  'kitchen-sink': { width: 112, height: 88 },
  fridge: { width: 72, height: 136 },
  microwave: { width: 60, height: 40 },
  kettle: { width: 32, height: 36 },
  'toilet-cubicle': { width: 96, height: 152 },
  washbasin: { width: 72, height: 112 },
  'hand-dryer': { width: 36, height: 44 },
  // The venue pieces (docs/specs/009-elements/venue-pieces.md).
  pillar: { width: 48, height: 152 },
  column: { width: 64, height: 168 },
  'car-park': { width: 240, height: 128 },
  'bike-rack': { width: 136, height: 80 },
  'swimming-pool': { width: 320, height: 200 },
  'stage-curtains': { width: 360, height: 120 },
  podium: { width: 56, height: 88 },
  // The workday pieces (docs/specs/009-elements/workday-pieces.md).
  'nap-pod': { width: 120, height: 112 },
  treadmill: { width: 72, height: 112 },
  'weight-bench': { width: 136, height: 88 },
  'phone-booth': { width: 80, height: 136 },
  'standing-desk': { width: 112, height: 104 },
  'hot-desk': { width: 120, height: 112 },
  'pet-bed': { width: 72, height: 48 },
  'reception-desk': { width: 200, height: 112 },
  // The team pieces (docs/specs/009-elements/team-pieces.md).
  'calendar-wall': { width: 200, height: 160 },
  'suggestion-box': { width: 64, height: 112 },
  signpost: { width: 120, height: 144 },
  'photo-wall': { width: 176, height: 112 },
  // Wayfinding (docs/specs/009-elements/directory.md, elevator.md).
  directory: { width: 72, height: 124 },
  elevator: { width: 112, height: 140 },
  // Stairs (docs/specs/009-elements/stairs.md): a flight to the floor above or below.
  stairs: { width: 96, height: 128 },
  // The meeting pieces (docs/specs/009-elements/screen-and-room-sign.md): a wall screen and a door plaque.
  screen: MEETING_PIECE_SIZE.screen,
  'room-sign': MEETING_PIECE_SIZE['room-sign'],
  // The Timer and Stopwatch (docs/specs/009-elements/timer-and-stopwatch.md).
  timer: TIMER_PIECE_SIZE.timer,
  stopwatch: TIMER_PIECE_SIZE.stopwatch,
  // The Callout (docs/specs/009-elements/card.md), at the size the grouped composite it replaced arrived at.
  callout: { width: 380, height: 116 },
  // Card (docs/specs/009-elements/card.md): room for a title, a meta line, two body lines and a tag row.
  card: { width: 300, height: 150 },
  // Badge (docs/specs/009-elements/badge.md): fitted to its text on every commit (badgeSize); this is "New" (BADGE_NEW_LABEL).
  badge: { width: 40, height: 24 },
  // Step number (docs/specs/009-elements/step-number.md): a small disc.
  step: { width: 28, height: 28 },
  // Pointer note (docs/specs/009-elements/pointer-note.md): a short note; its tip hangs below it (D190).
  'pointer-note': { width: 180, height: 64 },
  // Diagram key (docs/specs/009-elements/diagram-key.md): one row's height until it settles (D191).
  'diagram-key': { width: 260, height: 68 },
  // Stack (docs/specs/009-elements/stack.md): an empty row to drop into (D192).
  stack: { width: 360, height: 160 },
  // Boundary (docs/specs/009-elements/boundary.md): room for a few nodes inside.
  boundary: { width: 480, height: 300 },
};

// New boxed elements default to Medium text size per spec 09 ("Text size").
export function createShape(kind: ShapeKind, x: number, y: number): ShapeElement {
  const { width, height } = SHAPE_DEFAULT_SIZE[kind];
  const base: ShapeElement = {
    id: crypto.randomUUID(),
    type: 'shape',
    shape: kind,
    x,
    y,
    width,
    height,
    textSize: 'md',
  };
  // Mode button (docs/specs/009-elements/mode-button.md): looks like a button, so it arrives pill-shaped
  // with a call to action already written and pointed at Avatar mode — the
  // walkthrough case it exists for. The author retypes the label like any
  // other shape's, and picks a different mode from the element menu.
  if (kind === 'mode-button') {
    return {
      ...base,
      // NO default label: the face reads "Switch to <Mode>", derived from the
      // mode it carries, so re-pointing a button relabels it instead of leaving
      // yesterday's copy on it. An author who types their own label wins — it
      // is still a shape's label — but the useful default is the derived one.
      mode: DEFAULT_BUTTON_MODE,
      // A button has to look pressable BEFORE anyone styles it, and the
      // theme-derived shape fill made it read as one more labelled box on the
      // canvas. So it ships with a real UI button's colours: a light surface, a
      // hairline border, dark text, and a soft lift off the canvas (docs/specs/008-canvas/element-shadows.md).
      // Deliberately NOT a saturated brand block — a solid slab of colour on
      // the canvas reads as a shape someone drew, not as a control, and it
      // fought every canvas's own palette. The skin is NOT stored: it is the
      // kind's default per surface (behaviourSkin in colors.ts), so an
      // unstyled button follows light / dark and the tab theme like any shape.
      shadow: { offsetX: 0, offsetY: 2, blur: 6, opacity: 0.24 },
      borderRadius: 'lg',
      textSize: 'sm',
      textBold: true,
    };
  }
  // Portal (docs/specs/009-elements/portal-element.md): ships unlinked (there is nothing to link to until a
  // second portal exists) with a label the author replaces. It paints its own
  // ring, so the box behind it is transparent, and `strokeColor` is the colour
  // of the energy rather than of a border — electric blue by default, the
  // colour everyone already reads as "portal", and recolourable like any other
  // element (an orange pair is the obvious second half).
  if (kind === 'portal') {
    return {
      ...base,
      // Deliberately UNLABELLED: an unnamed portal is named positionally
      // ("Portal 1", "Portal 2") wherever it's shown, so a canvas full of them
      // is navigable without anyone typing a name. A label the author types
      // wins over the number. See portalName in apps/editor/lib/portals.ts.
      fillColor: 'transparent',
      strokeColor: '#38bdf8',
      textColor: '#ffffff',
      textSize: 'sm',
      textBold: true,
      // A portal has a natural shape: stretched wide it stops reading as one at
      // all (the panel and knob distort with the box). Locking the aspect keeps
      // drag-to-draw and every later resize portal-shaped; the user can still
      // unlock it from the menu like any other element.
      aspectLocked: true,
    };
  }
  // Chair (docs/specs/009-elements/chair.md): furniture, so it paints its own seat and back and the
  // element box carries no fill. The label (a name, a role) sits UNDER the
  // chair, out of the way of the character that will sit in it.
  if (kind === 'chair') {
    return {
      ...base,
      chairFacing: DEFAULT_CHAIR_FACING,
      textSize: 'sm',
      textAlignY: 'bottom',
      // A chair stretched wide stops reading as a chair, the same reason the
      // portal locks its aspect. Unlockable from the menu like any element.
      aspectLocked: true,
    };
  }
  // Desk and sofa (docs/specs/009-elements/chair.md "Desk and sofa"): furniture like the chair, each
  // with the facing it is drawn at, its label under it, and its proportions held.
  // Avatar Pad (docs/specs/009-elements/avatar-pad.md): pixels and no words, its grid kept square.
  if (kind === 'avatar-pad') {
    return { ...base, label: '', aspectLocked: true };
  }
  if (kind === 'desk' || kind === 'sofa') {
    return {
      ...base,
      chairFacing: DEFAULT_SEATING_FACING[kind],
      textSize: 'sm',
      textAlignY: 'bottom',
      aspectLocked: true,
    };
  }
  // The virtual office (docs/specs/009-elements/office.md). A room is any rectangle, its name on a plate at the
  // top left of its back wall; everything else keeps its drawing's proportions, a table's label under it.
  if (kind === 'room') {
    return {
      ...base,
      label: 'Room',
      roomDoor: DEFAULT_ROOM_DOOR,
      textSize: 'sm',
      textAlignX: 'left',
      textAlignY: 'top',
    };
  }
  // A stage (docs/specs/009-elements/office.md "Stage") is any width of platform, its name on the plate centred on its
  // front edge. Who may speak and Show Cameras are not stored until set: absent reads as the defaults.
  if (kind === 'stage') {
    return { ...base, label: 'Stage', textSize: 'sm', textAlignY: 'bottom' };
  }
  // A Door keeps any width along its wall: not aspect locked, no label.
  if (kind === 'door') return base;
  // A Window has no words on it.
  if (kind === 'window') return { ...base, label: '' };
  // A Corridor (docs/specs/009-elements/corridor.md) is any size of passage, with no words on it.
  if (kind === 'corridor') return { ...base, label: '' };
  // A garden path, grass and a garden fence (docs/specs/009-elements/office.md) are any size, drawn to it, with no
  // words on them.
  if (
    kind === 'garden-path' ||
    kind === 'grass' ||
    kind === 'garden-fence' ||
    kind === 'pond' ||
    kind === 'swimming-pool'
  ) {
    return { ...base, label: '' };
  }
  // The Screen and the Room Sign (docs/specs/009-elements/screen-and-room-sign.md): placed at their size, aspect locked,
  // no words of their own (a sign's name is its room's).
  if (isMeetingPieceShape(kind)) return { ...base, label: '', aspectLocked: true };
  // The Timer and Stopwatch (docs/specs/009-elements/timer-and-stopwatch.md): placed at their size, aspect locked, no
  // words; idle until first pressed, so nothing is stored.
  if (isTimerPieceShape(kind)) return { ...base, label: '', aspectLocked: true };
  // An Elevator (docs/specs/009-elements/elevator.md "Names") arrives unnamed: it reads "Elevator 1", "Elevator 2" by
  // position on its floor until someone names it, the name under the piece.
  if (kind === 'elevator') {
    return { ...base, label: '', textSize: 'sm', textAlignY: 'bottom', aspectLocked: true };
  }
  if (isOfficeShape(kind)) {
    return {
      ...base,
      // A piece people sit at keeps its label under it; the social pieces show none (social-pieces.md).
      ...(kind === 'notice-board' ||
      kind === 'world-clock' ||
      kind === 'jukebox' ||
      kind === 'ping-pong-table' ||
      kind === 'arcade-machine' ||
      kind === 'fireplace' ||
      kind === 'campfire' ||
      kind === 'bench' ||
      kind === 'picnic-table' ||
      kind === 'hammock' ||
      kind === 'garden-umbrella' ||
      kind === 'fountain' ||
      kind === 'pool-table' ||
      kind === 'foosball-table' ||
      kind === 'dartboard' ||
      kind === 'vending-machine' ||
      kind === 'bean-bag' ||
      kind === 'reading-nook' ||
      kind === 'printer' ||
      kind === 'copier' ||
      kind === 'lockers' ||
      kind === 'coat-rack' ||
      kind === 'umbrella-stand' ||
      kind === 'kitchen-counter' ||
      kind === 'kitchen-sink' ||
      kind === 'fridge' ||
      kind === 'microwave' ||
      kind === 'kettle' ||
      kind === 'toilet-cubicle' ||
      kind === 'washbasin' ||
      kind === 'hand-dryer' ||
      kind === 'pillar' ||
      kind === 'column' ||
      kind === 'car-park' ||
      kind === 'bike-rack' ||
      kind === 'stage-curtains' ||
      kind === 'podium' ||
      kind === 'nap-pod' ||
      kind === 'treadmill' ||
      kind === 'weight-bench' ||
      kind === 'phone-booth' ||
      kind === 'standing-desk' ||
      kind === 'hot-desk' ||
      kind === 'pet-bed' ||
      kind === 'reception-desk' ||
      kind === 'calendar-wall' ||
      kind === 'suggestion-box' ||
      kind === 'signpost' ||
      kind === 'photo-wall' ||
      // Stairs (docs/specs/009-elements/stairs.md) carry no name.
      kind === 'stairs'
        ? { label: '' }
        : {}),
      ...(kind === 'meeting-table' || kind === 'office-pod'
        ? { textSize: 'sm' as const, textAlignY: 'bottom' as const }
        : {}),
      aspectLocked: true,
    };
  }
  if (kind === 'lane') {
    return {
      ...base,
      // The title lives in the left gutter (docs/specs/009-elements/lane.md), so it aligns to the
      // leading edge rather than floating over the work.
      textAlignX: 'left',
      textAlignY: 'middle',
      // A generous inset so the title sits IN its gutter rather than against
      // the lane's edge — the default padding put it hard up on the border.
      padding: 'lg',
      label: 'Lane',
    };
  }
  // The actor is a figure with its label beneath the legs, not text
  // inside a box. Lock the aspect ratio so resizing never warps the
  // stickman, and default the label to the bottom band.
  if (kind === 'actor') {
    return { ...base, aspectLocked: true, textAlignY: 'bottom' };
  }
  // Icons: aspect-locked so the glyph never warps, label sits beneath
  // the glyph (the icon fills the box, text below reads as a caption).
  if (kind === 'icon') {
    return { ...base, aspectLocked: true, textAlignY: 'bottom' };
  }
  // Stickers (docs/specs/010-palette/stickers.md): aspect-locked, because the plate + its content are
  // one drawn object and stretching it is never what anyone wants. No label
  // at all — a sticker says what it says in its own art, and the caption band
  // an icon carries would undo the die-cut look.
  if (kind === 'sticker') {
    return { ...base, aspectLocked: true };
  }
  // A Timeline's milestones, each with its when (docs/specs/009-elements/timeline.md).
  if (kind === 'timeline-rail')
    return {
      ...base,
      conceptRows: [
        { label: 'Kick-off', note: 'Jan' },
        { label: 'First prototype', note: 'Mar' },
        { label: 'Beta with customers', note: 'Jun' },
        { label: 'Launch', note: 'Sep' },
      ],
    };
  // Boundary (docs/specs/009-elements/boundary.md): a titled, dashed container.
  if (kind === 'boundary')
    return {
      ...base,
      label: 'Region',
      strokeStyle: 'dashed',
      borderRadius: 'md',
      textSize: 'sm',
      textBold: true,
      // The title sits in its tab or corner (boundaryLayout), so the label takes the region whole.
      textAlignX: 'left',
      textAlignY: 'middle',
      padding: 'none',
    };
  // Badge (docs/specs/009-elements/badge.md): a word to start from; a step takes its number when it lands
  // (settleChips), so it starts with none.
  // Their text is centred with no padding: the face is the pill, the label its word.
  if (kind === 'badge')
    return { ...base, label: 'New', textSize: 'sm', textBold: true, padding: 'none' };
  if (kind === 'stack')
    return {
      ...base,
      label: '',
      strokeStyle: 'dashed',
      strokeWidth: 'thin',
      borderRadius: 'md',
      textSize: 'sm',
      textAlignX: 'left',
      textAlignY: 'top',
    };
  if (kind === 'diagram-key')
    return {
      ...base,
      label: 'Key',
      textSize: 'sm',
      textBold: true,
      textAlignX: 'left',
      textAlignY: 'top',
      // The title sits in its own 20 px band (diagramKeyLayout); padding there clipped its descenders.
      padding: 'none',
      borderRadius: 'md',
      strokeWidth: 'thin',
    };
  if (kind === 'pointer-note')
    return {
      ...base,
      label: 'Stale for 60 s after a price change',
      textSize: 'sm',
      textAlignX: 'left',
      textAlignY: 'top',
      borderRadius: 'md',
      strokeColor: '#d97706',
      fillColor: '#fffbeb',
      textColor: '#78350f',
      pointerTip: { x: -24, y: 120 },
    };
  if (kind === 'step')
    return { ...base, aspectLocked: true, textSize: 14, textBold: true, padding: 'none' };
  // Card (docs/specs/009-elements/card.md): every slot but the band on, so the first one shows what a card is made of.
  if (kind === 'card') {
    return {
      ...base,
      cardMedia: 'tile',
      iconId: 'credit-card',
      pageTitle: 'Payments',
      pageSubtitle: 'Stripe, EU region',
      label: 'Takes card payments and issues refunds.',
      tags: ['PCI', 'v2'],
      textSize: 'sm',
      textAlignX: 'left',
      textAlignY: 'top',
      strokeWidth: 'thin',
      borderRadius: 'md',
    };
  }
  if (kind === 'callout') {
    return {
      ...base,
      pageTitle: 'Heads up',
      label: 'A short note with some supporting detail.',
      textSize: 'sm',
      textAlignX: 'left',
      textAlignY: 'top',
      strokeWidth: 'thin',
      borderRadius: 'md',
    };
  }
  return base;
}
