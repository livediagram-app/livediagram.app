// The colour maths (a written colour to channels, contrast, tint and shade, the paper a colour amounts to): one
// copy for every product, @liveworkspace/element-model/colour-math.
export * from '@liveworkspace/element-model/colour-math';
import type { CanvasSurface } from '@liveworkspace/element-model/colour-math';
import { isMeetingPieceShape } from './meeting-pieces';
import {
  type BoxedElement,
  type Element,
  type Padding,
  type ShapeElement,
  type TextAlignX,
  type TextAlignY,
} from './index';
import type { BorderRadius } from '@liveworkspace/model-core/border-style';
import { PEN_INK } from './pen-colours';
import { MODE_BUTTON_SKIN } from './selection-mode';
import { hasOwnFace } from './collab-shapes';
import { FENCE_WOOD } from '@livehuddle/avatar/fence';
import { isOfficeShape, ROOM_FLOOR, RUG_FILL, STAGE_FLOOR, STAGE_FLOOR_DARK } from './office';
import {
  GARDEN_PATH_FILL,
  GARDEN_PATH_FILL_DARK,
  GRASS_FILL,
  GRASS_FILL_DARK,
} from './office-garden';
import { POND_FILL, POND_FILL_DARK } from './office-social';
import { POOL_FILL, POOL_FILL_DARK } from './office-venue';
import { isSeatingShape } from './seating';

// Per-type default padding bucket (was beside the Padding type).
export function defaultPadding(element: BoxedElement): Padding {
  switch (element.type) {
    case 'shape':
      // A room's name sits in its back wall's face (docs/specs/009-elements/office.md "Room"): the roomier
      // padding clears the wall's top.
      return element.shape === 'room' ? 'md' : 'sm';
    case 'text':
      return 'none';
    case 'sticky':
      return 'md';
    case 'image':
      return 'none';
    case 'link-card':
    case 'video':
    case 'table':
    case 'freehand':
    case 'path':
    case 'annotation':
      return 'none';
  }
}


// The ink for dark paper: the blue-slate set of the Default scheme's dark half
// (docs/specs/008-canvas/canvas-and-palette.md) — fill a step above the backdrop, a slate-500 stroke
// at 3:1 or better on both, white text. Sticky notes, images, link cards
// and videos are absent on purpose: their colours are their identity, and they
// look the same on any paper.
export const DARK_INK = {
  fill: '#141b26',
  stroke: '#64748b',
  text: '#ffffff',
} as const;

// The Behaviour elements that look like controls or furniture store no
// colour (behaviour-skin.ts); these are their unstyled looks per surface. The
// mode button wears a real UI button's skin, a light card on light paper and a
// raised slate one on dark, never the shape default, so it reads as pressable
// before anyone styles it. The chair paints itself; only its outline and label
// ink follow the paper.
const CONTROL_SKIN_DARK = { fill: '#1e293b', stroke: '#475569', text: '#f1f5f9' } as const;
const OUTLINE_SKIN_LIGHT = { stroke: '#94a3b8', text: '#0f172a' } as const;

// The floor pieces' unstyled fills, [light paper, dark paper] (docs/specs/009-elements/blueprints/DEFAULTS.md D210, D214).
const FLOOR_FILLS: Record<
  | 'room'
  | 'corridor'
  | 'rug'
  | 'stage'
  | 'garden-path'
  | 'grass'
  | 'door'
  | 'window'
  | 'pond'
  | 'swimming-pool',
  readonly [string, string]
> = {
  // A pond's water (docs/specs/009-elements/social-pieces.md "Pond").
  pond: [POND_FILL, POND_FILL_DARK],
  // A swimming pool's water (docs/specs/009-elements/venue-pieces.md "Swimming Pool").
  'swimming-pool': [POOL_FILL, POOL_FILL_DARK],
  // A door paints the gap it cuts in a wall in the room's floor (docs/specs/009-elements/room-builder.md "Door").
  door: [ROOM_FLOOR, '#292524'],
  // A window's frame is the wall's band in the room's floor (room-builder.md "Window").
  window: [ROOM_FLOOR, '#292524'],
  'garden-path': [GARDEN_PATH_FILL, GARDEN_PATH_FILL_DARK],
  grass: [GRASS_FILL, GRASS_FILL_DARK],
  room: [ROOM_FLOOR, '#292524'],
  // A corridor's floor is a room's (docs/specs/009-elements/corridor.md).
  corridor: [ROOM_FLOOR, '#292524'],
  rug: [RUG_FILL, '#713f12'],
  stage: [STAGE_FLOOR, STAGE_FLOOR_DARK],
};

function behaviourSkin(
  element: BoxedElement,
  surface: CanvasSurface,
): { fill: string; stroke: string; text: string } | null {
  if (element.type !== 'shape') return null;
  const kind = element.shape;
  if (kind === 'mode-button') {
    return surface === 'dark' ? CONTROL_SKIN_DARK : MODE_BUTTON_SKIN;
  }
  // A fence (docs/specs/009-elements/fence.md) is timber: a wood brown on each paper, no box.
  if (kind === 'fence') {
    return { fill: 'transparent', stroke: FENCE_WOOD[surface], text: OUTLINE_SKIN_LIGHT.text };
  }
  // A room's floor, a rug and a stage's top are the element's fill (docs/specs/009-elements/office.md): warm on
  // light paper, deep on dark, a stage a little lighter than the room it stands in. Their outlines are the
  // furniture's.
  if (
    kind === 'room' ||
    kind === 'corridor' ||
    kind === 'rug' ||
    kind === 'stage' ||
    kind === 'garden-path' ||
    kind === 'grass' ||
    kind === 'door' ||
    kind === 'window' ||
    kind === 'pond' ||
    kind === 'swimming-pool'
  ) {
    const fill = FLOOR_FILLS[kind][surface === 'dark' ? 1 : 0];
    return surface === 'dark'
      ? { fill, stroke: DARK_INK.stroke, text: DARK_INK.text }
      : { fill, ...OUTLINE_SKIN_LIGHT };
  }
  // The Screen and the Room Sign (docs/specs/009-elements/screen-and-room-sign.md) paint themselves like the furniture,
  // and so does an Avatar Pad (docs/specs/009-elements/avatar-pad.md): its outlines in the furniture's ink, no box.
  if (
    isSeatingShape(kind) ||
    isOfficeShape(kind) ||
    isMeetingPieceShape(kind) ||
    kind === 'avatar-pad'
  ) {
    return surface === 'dark'
      ? { fill: 'transparent', stroke: DARK_INK.stroke, text: DARK_INK.text }
      : { fill: 'transparent', ...OUTLINE_SKIN_LIGHT };
  }
  return null;
}

export function defaultTextColor(element: BoxedElement, surface: CanvasSurface = 'light'): string {
  const skin = behaviourSkin(element, surface);
  if (skin) return skin.text;
  // Text with no colour of its own is written in Ink, on every theme and in either editor mode
  // (docs/specs/007-editor/editor-modes.md "One look").
  if (element.type === 'text') return PEN_INK[surface];
  if (surface === 'dark') {
    switch (element.type) {
      case 'shape':
      case 'image':
        return DARK_INK.text;
      case 'sticky':
      case 'link-card':
      case 'video':
      case 'table':
      case 'freehand':
      case 'path':
      case 'annotation':
        break; // keeps its own ink on any paper
    }
  }
  switch (element.type) {
    case 'shape':
      return '#075985'; // brand-800
    case 'sticky':
      return '#451a03'; // amber-950-ish
    case 'image':
      return '#1e293b'; // slate-800 (only used for alt-text rendering)
    case 'link-card':
      return '#1e293b'; // slate-800 — card title text
    // The retired types draw as the placeholder, in its own colours; these only answer the union.
    case 'video':
    case 'table':
    case 'freehand':
    case 'path':
    case 'annotation':
      return '#e2e8f0'; // slate-200 — caption over the dark player surface
  }
}

// The ink a plain shape wears when it carries no colour of its own, on the
// given paper: what the Default scheme's elements look like, and so what a
// "theme default" swatch shows there (docs/specs/008-canvas/quick-style-panel.md).
const PLAIN_SHAPE: ShapeElement = {
  id: '',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 0,
  height: 0,
};
export function unpaintedShapeInk(surface: CanvasSurface): {
  fill: string;
  stroke: string;
  text: string;
} {
  return {
    fill: defaultFillColor(PLAIN_SHAPE, surface),
    stroke: defaultStrokeColor(PLAIN_SHAPE, surface),
    text: defaultTextColor(PLAIN_SHAPE, surface),
  };
}

export function defaultTextAlign(element: BoxedElement): { x: TextAlignX; y: TextAlignY } {
  if (element.type === 'sticky') return { x: 'left', y: 'top' };
  return { x: 'center', y: 'middle' };
}

// Default fill / stroke colours per boxed element type. Used when the element
// doesn't override them with explicit `fillColor` / `strokeColor` fields.
// Hex strings so they can also seed the colour picker UI.
export function defaultFillColor(element: BoxedElement, surface: CanvasSurface = 'light'): string {
  const skin = behaviourSkin(element, surface);
  if (skin) return skin.fill;
  if (surface === 'dark') {
    switch (element.type) {
      case 'shape':
        return DARK_INK.fill;
      case 'text':
      case 'image':
      case 'sticky':
      case 'link-card':
      case 'video':
      case 'table':
      case 'freehand':
      case 'path':
      case 'annotation':
        break; // transparent, or a fill that is the element's identity
    }
  }
  switch (element.type) {
    case 'shape':
      return '#f0f9ff'; // brand-50
    case 'sticky':
      return '#fef3c7'; // amber-100
    case 'text':
      return 'transparent';
    case 'image':
      return 'transparent';
    case 'link-card':
      return '#ffffff'; // white card surface
    case 'video':
    case 'table':
    case 'freehand':
    case 'path':
    case 'annotation':
      return '#0f172a'; // slate-900 — a player letterboxes against black, not white
  }
}

export function defaultStrokeColor(
  element: BoxedElement,
  surface: CanvasSurface = 'light',
): string {
  const skin = behaviourSkin(element, surface);
  if (skin) return skin.stroke;
  if (surface === 'dark') {
    switch (element.type) {
      case 'shape':
        return DARK_INK.stroke;
      case 'text':
      case 'image':
      case 'sticky':
      case 'link-card':
      case 'video':
      case 'table':
      case 'freehand':
      case 'path':
      case 'annotation':
        break; // transparent, or a border that is the element's identity
    }
  }
  switch (element.type) {
    case 'shape':
      return '#0ea5e9'; // brand-500
    case 'sticky':
      return '#fde68a'; // amber-200
    case 'text':
      return 'transparent';
    case 'image':
      return 'transparent';
    case 'link-card':
      return '#e2e8f0'; // slate-200 — card border
    case 'video':
    case 'table':
    case 'freehand':
    case 'path':
    case 'annotation':
      return '#1e293b'; // slate-800 — a hairline barely off the player surface
  }
}

// Whether an element exposes a BACKGROUND colour control. Text and images
// have no fill to expose; everything else does, including a boundary, whose fill
// merely defaults to transparent.
//
// Call sites used to ask `defaultFillColor(el) !== 'transparent'` as a proxy
// for this, which was the same question right up until a fillable element
// defaulted to transparent, at which point the proxy hid the very control
// that would set it.
export function supportsFillColor(element: Element): boolean {
  if (!supportsColours(element)) return false;
  // An icon is a glyph, not a box: the wrapper is in SELF_PAINTING_SHAPES, so
  // it paints no background, and neither icon renderer reads fillColor (a
  // Technology mark carries its own tile, a line-art glyph is stroke-tinted).
  // The control was inert on both, and picking a colour still wrote to the
  // element, autosaved, logged a change and broadcast an op for nothing.
  if (element.type === 'shape' && element.shape === 'icon') return false;
  return element.type !== 'text' && element.type !== 'image';
}

export function supportsColours(element: Element): boolean {
  // A sticker's colours are the sticker (docs/specs/010-palette/stickers.md): a green APPROVED that
  // could be recoloured violet would be a worse APPROVED, and there is no
  // fill or stroke on a die-cut plate to expose anyway.
  if (element.type === 'shape' && element.shape === 'sticker') return false;
  return (
    element.type === 'shape' ||
    // A text element is its words (docs/specs/008-canvas/canvas-and-palette.md "Text element"):
    // the Colours category shows only its Text row (no fill, no border).
    element.type === 'text' ||
    element.type === 'sticky' ||
    element.type === 'link-card' ||
    element.type === 'video' ||
    element.type === 'table'
  );
}

// Whether the element renders a stroke thickness + dash pattern
// (the Border accordion's strength + pattern rows). Same surface
// is used by both the per-element setters (useElementStyle) and the
// `paletteSelection.borderStroke / borderStyle` Canvas derivation;
// every consumer keying off "is this element border-styleable" goes
// through here, so a future element variant that paints a stroke
// only needs to be added in one place (was four before this
// predicate landed).
//
// Type-predicate (`element is ShapeElement`) so callers get TypeScript
// narrowing too: the `strokeWidth` / `strokeStyle` fields are typed as
// BorderStroke / BorderStyle on a shape.
export function supportsBorder(element: Element): element is ShapeElement {
  return element.type === 'shape';
}

// Whether the element exposes the Border CONTROLS (strength / pattern /
// radius) in the editor UI — distinct from supportsBorder, which also gates
// stroke-field writes + type narrowing. A boolean visibility gate: it drops the `actor`, a stick figure with no
// enclosing outline for which a border is meaningless.
// Shape kinds that DRAW THEIR OWN BODY, so the wrapper carries no border or
// background and every border control is dead for them. One list, exported,
// because the renderer and the menu were each keeping their own and drifted:
// the menu still offered Border on a code block, a checklist, a portal and a
// reveal long after the renderer stopped painting one.
//
// The actor, icons and stickers are here for a different reason — a stick
// figure, a glyph and a die-cut plate have no enclosing outline to stroke —
// but the outcome is the same, so they share the predicate rather than a
// second condition.
export const SELF_PAINTING_SHAPES = new Set<string>([
  'actor',
  // A UML final state draws its ring and dot itself (shape-geometry.ts): no box to border.
  'final-state',
  'icon',
  // A sticker paints its own plate, shadow and content (docs/specs/010-palette/stickers.md).
  'sticker',
  // Behaviour elements (docs/specs/009-elements/portal-element.md): the ring IS the element.
  'portal',
  // A chair (docs/specs/009-elements/chair.md) draws its own furniture and wants no box behind it,
  // which is what the canvas does too (isSvgRenderedShape excludes it).
  'chair',
  // A fence, a desk and a sofa (docs/specs/009-elements/fence.md, chair.md) draw themselves too.
  'fence',
  'desk',
  'sofa',
  // An Avatar Pad (docs/specs/009-elements/avatar-pad.md) is its pixels.
  'avatar-pad',
  // The office pieces (docs/specs/009-elements/office.md) draw themselves, the room its own floor.
  'room',
  // The Corridor (docs/specs/009-elements/corridor.md) draws its floor and walls.
  'corridor',
  'meeting-table',
  'plant',
  'bookshelf',
  'water-cooler',
  'coffee-machine',
  'rug',
  'stage',
  'office-pod',
  'bar',
  'bar-stool',
  'drinks-cabinet',
  'drinks-fridge',
  'outdoor-plant',
  'tree',
  'garden-path',
  'grass',
  'garden-fence',
  // The social pieces (docs/specs/009-elements/social-pieces.md). Each draws itself.
  'notice-board',
  'world-clock',
  'jukebox',
  'ping-pong-table',
  'arcade-machine',
  'fireplace',
  'campfire',
  'bench',
  'picnic-table',
  'hammock',
  'garden-umbrella',
  'fountain',
  'pond',
  'pool-table',
  'foosball-table',
  'dartboard',
  'vending-machine',
  'bean-bag',
  'reading-nook',
  'printer',
  'copier',
  'lockers',
  'coat-rack',
  'umbrella-stand',
  'kitchen-counter',
  'kitchen-sink',
  'fridge',
  'microwave',
  'kettle',
  'toilet-cubicle',
  'washbasin',
  'hand-dryer',
  'pillar',
  'column',
  'car-park',
  'bike-rack',
  'swimming-pool',
  'stage-curtains',
  'podium',
  // The workday pieces (docs/specs/009-elements/workday-pieces.md).
  'nap-pod',
  'treadmill',
  'weight-bench',
  'phone-booth',
  'standing-desk',
  'hot-desk',
  'pet-bed',
  'reception-desk',
  // The team pieces (docs/specs/009-elements/team-pieces.md).
  'calendar-wall',
  'suggestion-box',
  'signpost',
  'photo-wall',
  // The Directory and the Elevator (docs/specs/009-elements/directory.md, elevator.md) draw themselves.
  'directory',
  'elevator',
  // Stairs (docs/specs/009-elements/stairs.md) draw themselves.
  'stairs',
  // The Screen and the Room Sign (docs/specs/009-elements/screen-and-room-sign.md) draw themselves.
  'screen',
  'room-sign',
  // The Timer and Stopwatch (docs/specs/009-elements/timer-and-stopwatch.md).
  'timer',
  'stopwatch',
  // A Door (docs/specs/009-elements/room-builder.md "Door") draws its jambs, leaf and swing: no border of its own.
  'door',
  // A Window (room-builder.md "Window") draws its frame, pane and light.
  'window',
  // Web components (docs/specs/009-elements/web-components-and-no-groups.md) that lay out their own surfaces: an accent bar
  // (banner, header), a row of cards, circles and connectors. A callout is
  // NOT here: its card is an ordinary bordered box with content inside.
  'banner',
  'site-header',
  'stat-row',
  'process',
]);

export function supportsBorderControls(element: Element): boolean {
  if (!supportsBorder(element)) return false;
  return !(element.type === 'shape' && SELF_PAINTING_SHAPES.has(element.shape));
}

// Whether a shape can carry an INLINE icon beside its label — i.e. whether
// dropping a palette icon on it (or adding one while it's selected) folds
// the glyph INTO it. Regular shapes only: the dedicated `icon` shape IS a
// glyph, and a `stack` is a container you place elements INSIDE,
// not decorate (docs/specs/009-elements/annotations.md). An icon dropped on those becomes a
// standalone `icon` element instead of attaching. One predicate so all
// three fold paths (palette drag-drop, add-while-selected, drag an
// existing icon onto a shape) agree.
//
// Of the web components (docs/specs/009-elements/web-components-and-no-groups.md), the header takes the icon as its logo
// and the callout as its badge glyph; the banner, stat row and process have
// nowhere to put one, so an icon dropped on them stands alone.
//
// Nor do the Behaviour elements that draw their own face (hasOwnFace: the
// buttons, the chair, a retired element's placeholder...): their face never
// renders an inline icon, so one folded in would be invisible. Dropped on
// them, it stands alone too.
/** Whether a shape's inline icon goes where `iconPosition` says, so offering that choice does something. Every kind
 *  that takes one places it by `iconPosition` since the card, the callout and the boundary left
 *  (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine"). */
export function positionsInlineIcon(element: Element): boolean {
  return acceptsInlineIcon(element);
}

export function acceptsInlineIcon(element: Element): element is ShapeElement {
  return (
    element.type === 'shape' &&
    !hasOwnFace(element.shape) &&
    element.shape !== 'icon' &&
    element.shape !== 'sticker'
  );
}

// Whether an element exposes a user-adjustable corner radius. Only the
// free-corner rectangles qualify: the plain square, which renders as a
// CSS rounded rectangle so a real pixel radius applies. Every other shape
// either bakes its rounding into the silhouette (circle / stadium / cloud /
// actor) or is an SVG outline (diamond / cylinder / hexagon / document /
// parallelogram) where a corner radius is meaningless, so the Radius control
// is hidden for them.
//
// The web components with a rectangular surface (docs/specs/009-elements/web-components-and-no-groups.md) take it too: the
// banner and header bar, the callout card, and each of a stat row's cards.
export function supportsBorderRadius(element: Element): element is ShapeElement {
  return element.type === 'shape' && RADIUS_SHAPES.has(element.shape);
}
const RADIUS_SHAPES = new Set<string>(['square', 'banner', 'site-header', 'stat-row']);

// The corner preset the Radius control highlights: the element's own, else the preset nearest
// its kind's default corner (docs/specs/008-canvas/corner-radius.md): Small.
export function shownBorderRadius(element: ShapeElement): BorderRadius {
  return element.borderRadius ?? 'sm';
}
