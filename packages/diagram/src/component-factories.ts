// The palette's ready-made components (spec/09, spec/146): Banner, Callout,
// Stat row, Process steps, Header, Hero and Avatar, plus the createComponent
// dispatcher and their natural sizes.
//
// Each is ONE element. They used to be bundles of primitives sharing a
// groupId; now the five that are shapes are their own shape kinds (laid out by
// web-components.ts), the Hero is an image carrying a caption card, and the
// Avatar is a circular image. What this module adds over createShape /
// createImage is the THEME: the caller maps the tab theme to colours (keeping
// this package theme-agnostic) and each component takes the ones it wears.

import { type Element, type ImageElement, type ShapeElement, type ShapeKind } from './index';
import { createImage } from './factories';
import { createShape, SHAPE_DEFAULT_SIZE } from './shape-factory';
import { ACCENT_BAR_TEXT, HERO_DEFAULT_CAPTION } from './web-components';

// Theme colours a component is built from. `accent` is the theme accent
// (elementStroke); `surface` is the light element fill; `ink` is the element
// text colour. The fill/text pair is what every theme guarantees legible
// together, so the card components built on a `surface` with `ink` text stay
// readable on light AND dark themes.
export type ComponentColors = { accent: string; surface: string; ink: string };

// The component catalogue. The ids are the palette's (tile ids, favourites
// and telemetry types all key off them), so they stay as they were even
// where the shape kind behind one is spelled differently.
export type ComponentKind =
  'banner' | 'hero' | 'header' | 'callout' | 'stat' | 'process' | 'avatar';

const COMPONENT_SHAPE: Partial<Record<ComponentKind, ShapeKind>> = {
  banner: 'banner',
  header: 'site-header',
  callout: 'callout',
  stat: 'stat-row',
  process: 'process',
};

const AVATAR_SIZE = 96;
const HERO_WIDTH = 520;
const HERO_HEIGHT = 300;

// Natural bounds: the tap-to-drop size, and the aspect a drag-to-draw keeps
// when Shift is held.
export const COMPONENT_SIZE: Record<ComponentKind, { width: number; height: number }> = {
  banner: SHAPE_DEFAULT_SIZE.banner,
  header: SHAPE_DEFAULT_SIZE['site-header'],
  callout: SHAPE_DEFAULT_SIZE.callout,
  stat: SHAPE_DEFAULT_SIZE['stat-row'],
  process: SHAPE_DEFAULT_SIZE.process,
  hero: { width: HERO_WIDTH, height: HERO_HEIGHT },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE },
};

// Avatar (spec/09): a circular image. Square + aspect-locked with a 'full'
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

// Hero (spec/146): a large cover-fit image with a caption card inset near the
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

// One web component shape (spec/146), centred on (cx, cy) and dressed in the
// theme. The accent-bar kinds (banner, header) take the accent as their
// stroke, which the bar paints in, and keep white text; the cards take the
// surface + ink with the accent as their border and emphasis.
function createWebShape(kind: ShapeKind, cx: number, cy: number, c: ComponentColors): ShapeElement {
  const { width, height } = SHAPE_DEFAULT_SIZE[kind];
  const base = createShape(kind, cx - width / 2, cy - height / 2);
  if (kind === 'banner' || kind === 'site-header') {
    return { ...base, strokeColor: c.accent, textColor: ACCENT_BAR_TEXT };
  }
  return { ...base, fillColor: c.surface, strokeColor: c.accent, textColor: c.ink };
}

export function createComponent(
  kind: ComponentKind,
  cx: number,
  cy: number,
  colors: ComponentColors,
): Element {
  if (kind === 'avatar') return createAvatar(cx, cy);
  if (kind === 'hero') return createHero(cx, cy, colors.accent);
  return createWebShape(COMPONENT_SHAPE[kind]!, cx, cy, colors);
}
