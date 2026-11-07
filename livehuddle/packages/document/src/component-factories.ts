// The palette's ready-made components (docs/specs/008-canvas/canvas-and-palette.md, docs/specs/009-elements/web-components-and-no-groups.md)
// livehuddle still carries: Callout, Hero and Avatar, plus the createComponent dispatcher and their natural sizes.
// The Banner, Stat row, Process steps and Header left its element engine
// (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine").
//
// Each is ONE element: the Callout is a Card preset, the Hero is an image carrying a caption card, and the
// Avatar is a circular image. What this module adds over createShape /
// createImage is the THEME: the caller maps the tab theme to colours (keeping
// this package theme-agnostic) and each component takes the ones it wears.

import type { Element, ImageElement, ShapeElement } from './index';
import { createImage } from './factories';
import { createShape, SHAPE_DEFAULT_SIZE } from './shape-factory';
import { applyShapeVariant } from './shape-variants';
import { ACCENT_BAR_TEXT, HERO_DEFAULT_CAPTION } from './web-components';

// Theme colours a component is built from. `accent` is the theme accent
// (elementStroke); `surface` is the light element fill; `ink` is the element
// text colour. The fill/text pair is what every theme guarantees legible
// together, so the card components built on a `surface` with `ink` text stay
// readable on light AND dark themes.
type ComponentColors = { accent: string; surface: string; ink: string };

// The component catalogue. The ids are the palette's (tile ids, favourites
// and telemetry types all key off them), so they stay as they were even
// where the shape kind behind one is spelled differently.
export type ComponentKind =
  | 'hero'
  // The Callout is a Card preset (docs/specs/009-elements/card.md); the Card itself is a plain shape tile.
  | 'callout'
  | 'avatar';

/** The shape kind a single-shape component is placed as; undefined for the composites (hero, avatar). */
export function componentShapeKind(kind: ComponentKind): 'card' | undefined {
  return kind === 'callout' ? 'card' : undefined;
}

const AVATAR_SIZE = 96;
const HERO_WIDTH = 520;
const HERO_HEIGHT = 300;

// Natural bounds: the tap-to-drop size, and the aspect a drag-to-draw keeps
// when Shift is held.
export const COMPONENT_SIZE: Record<ComponentKind, { width: number; height: number }> = {
  callout: SHAPE_DEFAULT_SIZE.callout,
  hero: { width: HERO_WIDTH, height: HERO_HEIGHT },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE },
};

// Avatar (docs/specs/008-canvas/canvas-and-palette.md): a circular image. Square + aspect-locked with a 'full'
// corner radius (CSS clamps that to a circle). Centred on (cx, cy); imageId
// is null until the picker fills it.
export function createAvatar(cx: number, cy: number): ImageElement {
  return {
    ...createImage(cx - AVATAR_SIZE / 2, cy - AVATAR_SIZE / 2),
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 'full',
    objectFit: 'cover',
    aspectLocked: true,
  };
}

// Hero (docs/specs/009-elements/web-components-and-no-groups.md): a large cover-fit image with a caption card inset near the
// bottom, in the theme accent under white text. The card is inset rather than
// covering the image so the image stays double-clickable to set / change it.
export function createHero(cx: number, cy: number, accent: string): ImageElement {
  return {
    ...createImage(cx - HERO_WIDTH / 2, cy - HERO_HEIGHT / 2),
    width: HERO_WIDTH,
    height: HERO_HEIGHT,
    borderRadius: 'lg',
    objectFit: 'cover',
    heroCaption: { ...HERO_DEFAULT_CAPTION },
    fillColor: accent,
    textColor: ACCENT_BAR_TEXT,
  };
}

// A card centred on (cx, cy) and dressed in the theme: the surface + ink with the accent as its border and emphasis.
function createWebShape(cx: number, cy: number, c: ComponentColors): ShapeElement {
  const { width, height } = SHAPE_DEFAULT_SIZE.card;
  const base = createShape('card', cx - width / 2, cy - height / 2);
  return { ...base, fillColor: c.surface, strokeColor: c.accent, textColor: c.ink };
}

/** A Callout (docs/specs/009-elements/card.md "The Callout is a Card preset") at (x, y), unpainted, for templates
 *  and agents: a card with badge media and the callout's size and copy. */
export function createCalloutCard(x: number, y: number): ShapeElement {
  return applyShapeVariant(createShape('card', x, y), 'callout');
}

export function createComponent(
  kind: ComponentKind,
  cx: number,
  cy: number,
  colors: ComponentColors,
): Element {
  if (kind === 'avatar') return createAvatar(cx, cy);
  if (kind === 'hero') return createHero(cx, cy, colors.accent);
  // The Callout is a Card preset (docs/specs/009-elements/card.md): the callout's own size and copy, as a card with
  // badge media.
  const callout = applyShapeVariant(createWebShape(cx, cy, colors), 'callout');
  return {
    ...callout,
    x: cx - callout.width / 2,
    y: cy - callout.height / 2,
  };
}
