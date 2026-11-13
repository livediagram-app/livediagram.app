// The palette's ready-made components (docs/specs/008-canvas/canvas-and-palette.md, docs/specs/009-elements/web-components-and-no-groups.md): Banner, Callout,
// Stat row, Process steps, Header, Hero and Avatar, plus the createComponent
// dispatcher and their natural sizes.
//
// Each is ONE element. They used to be bundles of primitives sharing a
// groupId; now the five that are shapes are their own shape kinds (laid out by
// web-components.ts), the Hero is an image carrying a caption card, and the
// Avatar is a circular image. What this module adds over createShape /
// createImage is the THEME: the caller maps the tab theme to colours (keeping
// this package theme-agnostic) and each component takes the ones it wears.

import type { Element as ModelElement } from './element';
import { createImage } from './factories';
import { FLOWCHART_STEP_SIZE } from './flowchart';
import { applyShapeVariant } from './shape-variants';
import { ACCENT_BAR_TEXT, HERO_DEFAULT_CAPTION } from './web-components';

// livediagram and liveplanner share the catalogue; each binds it to its own shape factory, kind sizes and
// flowchart start (componentFactoriesFor).
type ShapeKind = string;
type Size = { width: number; height: number };

// The component catalogue. The ids are the palette's (tile ids, favourites
// and telemetry types all key off them), so they stay as they were even
// where the shape kind behind one is spelled differently.
export type ComponentKind =
  | 'banner'
  | 'hero'
  | 'header'
  // The Callout is a Card preset (docs/specs/009-elements/card.md); the Card itself is a plain shape tile.
  | 'callout'
  | 'stat'
  | 'process'
  | 'avatar'
  // The flowchart's first step (docs/specs/009-elements/flowchart.md): a component because it is placed
  // like one (tap or drag, at its own size) and is more than its shape kind: a Start that IS a chart.
  | 'flowchart';

/** What the components are made of in a product: its shape factory and kind sizes, and its flowchart's Start. */
export type ComponentDeps<E extends ModelElement> = {
  createShape: (kind: never, x: number, y: number) => Extract<E, { type: 'shape' }>;
  shapeDefaultSize: Readonly<Record<string, Size>>;
  createFlowchartStart: (cx: number, cy: number) => Extract<E, { type: 'shape' }>;
};

export function componentFactoriesFor<E extends ModelElement, K extends string>(
  deps: Omit<ComponentDeps<E>, 'createShape'> & {
    createShape: (kind: K, x: number, y: number) => Extract<E, { type: 'shape' }>;
  },
) {
  type Element = E;
  type ShapeElement = Extract<E, { type: 'shape' }>;
  type ImageElement = Extract<E, { type: 'image' }>;
  const { createFlowchartStart } = deps;
  const createShape = deps.createShape as (kind: ShapeKind, x: number, y: number) => ShapeElement;
  const SHAPE_DEFAULT_SIZE = deps.shapeDefaultSize;

  // Theme colours a component is built from. `accent` is the theme accent
  // (elementStroke); `surface` is the light element fill; `ink` is the element
  // text colour. The fill/text pair is what every theme guarantees legible
  // together, so the card components built on a `surface` with `ink` text stay
  // readable on light AND dark themes.
  type ComponentColors = { accent: string; surface: string; ink: string };

  const COMPONENT_SHAPE: Partial<Record<ComponentKind, ShapeKind>> = {
    banner: 'banner',
    header: 'site-header',
    callout: 'card',
    stat: 'stat-row',
    process: 'process',
  };

  /** The shape kind a single-shape component is placed as; undefined for the composites (hero, avatar). */
  function componentShapeKind(kind: ComponentKind): ShapeKind | undefined {
    return COMPONENT_SHAPE[kind];
  }

  const AVATAR_SIZE = 96;
  const HERO_WIDTH = 520;
  const HERO_HEIGHT = 300;

  // Natural bounds: the tap-to-drop size, and the aspect a drag-to-draw keeps
  // when Shift is held.
  const COMPONENT_SIZE: Record<ComponentKind, { width: number; height: number }> = {
    banner: SHAPE_DEFAULT_SIZE.banner!,
    header: SHAPE_DEFAULT_SIZE['site-header']!,
    callout: SHAPE_DEFAULT_SIZE.callout!,
    stat: SHAPE_DEFAULT_SIZE['stat-row']!,
    process: SHAPE_DEFAULT_SIZE.process!,
    hero: { width: HERO_WIDTH, height: HERO_HEIGHT },
    avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE },
    flowchart: FLOWCHART_STEP_SIZE.terminator,
  };

  // Avatar (docs/specs/008-canvas/canvas-and-palette.md): a circular image. Square + aspect-locked with a 'full'
  // corner radius (CSS clamps that to a circle). Centred on (cx, cy); imageId
  // is null until the picker fills it.
  function createAvatar(cx: number, cy: number): ImageElement {
    return {
      ...createImage(cx - AVATAR_SIZE / 2, cy - AVATAR_SIZE / 2),
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: 'full',
      objectFit: 'cover',
      aspectLocked: true,
    } as unknown as ImageElement;
  }

  // Hero (docs/specs/009-elements/web-components-and-no-groups.md): a large cover-fit image with a caption card inset near the
  // bottom, in the theme accent under white text. The card is inset rather than
  // covering the image so the image stays double-clickable to set / change it.
  function createHero(cx: number, cy: number, accent: string): ImageElement {
    return {
      ...createImage(cx - HERO_WIDTH / 2, cy - HERO_HEIGHT / 2),
      width: HERO_WIDTH,
      height: HERO_HEIGHT,
      borderRadius: 'lg',
      objectFit: 'cover',
      heroCaption: { ...HERO_DEFAULT_CAPTION },
      fillColor: accent,
      textColor: ACCENT_BAR_TEXT,
    } as unknown as ImageElement;
  }

  // One web component shape (docs/specs/009-elements/web-components-and-no-groups.md), centred on (cx, cy) and dressed in the
  // theme. The accent-bar kinds (banner, header) take the accent as their
  // stroke, which the bar paints in, and keep white text; the cards take the
  // surface + ink with the accent as their border and emphasis.
  function createWebShape(
    kind: ShapeKind,
    cx: number,
    cy: number,
    c: ComponentColors,
  ): ShapeElement {
    const { width, height } = SHAPE_DEFAULT_SIZE[kind]!;
    const base = createShape(kind, cx - width / 2, cy - height / 2);
    if (kind === 'banner' || kind === 'site-header') {
      return { ...base, strokeColor: c.accent, textColor: ACCENT_BAR_TEXT };
    }
    return { ...base, fillColor: c.surface, strokeColor: c.accent, textColor: c.ink };
  }

  /** A Callout (docs/specs/009-elements/card.md "The Callout is a Card preset") at (x, y), unpainted, for templates
   *  and agents: a card with badge media and the callout's size and copy. */
  function createCalloutCard(x: number, y: number): ShapeElement {
    return applyShapeVariant(createShape('card', x, y), 'callout');
  }

  function createComponent(
    kind: ComponentKind,
    cx: number,
    cy: number,
    colors: ComponentColors,
  ): Element {
    if (kind === 'avatar') return createAvatar(cx, cy);
    // Unpainted, so the theme paints it like any shape the palette drops.
    if (kind === 'flowchart') return createFlowchartStart(cx, cy);
    if (kind === 'hero') return createHero(cx, cy, colors.accent);
    // The Callout is a Card preset (docs/specs/009-elements/card.md): the callout's own size and copy, as a card with
    // badge media.
    if (kind === 'callout') {
      const card = createWebShape('card', cx, cy, colors);
      const callout = applyShapeVariant(card, 'callout');
      return {
        ...callout,
        x: cx - callout.width / 2,
        y: cy - callout.height / 2,
      };
    }
    return createWebShape(COMPONENT_SHAPE[kind]!, cx, cy, colors);
  }

  return {
    componentShapeKind,
    createAvatar,
    createHero,
    createCalloutCard,
    createComponent,
    COMPONENT_SIZE,
  };
}
