// Composite "ready-made component" factories (spec/09): banner, avatar, hero,
// website header, callout, KPI stat row, and numbered process steps, plus the
// createComponent dispatcher and their dimension constants. Each builds a
// grouped set of primitive elements (it's not a new element kind), so this
// lives beside the primitive factories rather than inside them. Split out of
// factories.ts to keep that file focused on the per-kind primitives.

import {
  type ArrowElement,
  type BoxedElement,
  type Element,
  type ElementId,
  type ImageElement,
  type ShapeElement,
  type TextElement,
} from './index';
import { createImage, createPinnedArrow, createShape, createText } from './factories';

// Banner (spec/09): a decorative title block, built as a COMPOSITE group of
// existing primitives rather than a new element type — an accent-filled
// rounded bar with a bold title and a muted subtitle, all sharing one
// `groupId` so they move / lock / copy as a unit yet stay individually
// editable (and ungroupable). Laid out around the CENTRE (cx, cy) since it's
// dropped at the viewport centre. `accent` is the theme's accent colour (the
// caller maps theme -> colour, keeping this package theme-agnostic); the bar
// is filled with it and the text is white for contrast. Returned in paint
// order (bar first, so the text sits on top).
const BANNER_WIDTH = 440;
const BANNER_HEIGHT = 104;
export function createBanner(cx: number, cy: number, accent: string): BoxedElement[] {
  const groupId: ElementId = crypto.randomUUID();
  const left = cx - BANNER_WIDTH / 2;
  const top = cy - BANNER_HEIGHT / 2;
  const inset = 24;
  const titleHeight = 42;

  // Accent bar: a rounded square shape stretched wide, filled with the
  // accent and borderless so it reads as a solid band.
  const bar: ShapeElement = {
    ...createShape('square', left, top),
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    fillColor: accent,
    strokeColor: accent,
    strokeWidth: 'none',
    borderRadius: 'lg',
    groupId,
  };
  // Title: large, bold, centred, white on the accent.
  const title: TextElement = {
    ...createText(left + inset, top + 20),
    width: BANNER_WIDTH - inset * 2,
    height: titleHeight,
    label: 'Banner title',
    textSize: 'lg',
    textBold: true,
    textAlignX: 'center',
    textAlignY: 'middle',
    textColor: '#ffffff',
    groupId,
  };
  // Subtitle: smaller, centred, slightly muted white beneath the title.
  const subtitle: TextElement = {
    ...createText(left + inset, top + 20 + titleHeight - 4),
    width: BANNER_WIDTH - inset * 2,
    height: 26,
    label: 'Subtitle or description',
    textSize: 'sm',
    textAlignX: 'center',
    textAlignY: 'middle',
    textColor: '#ffffff',
    opacity: 0.85,
    groupId,
  };
  return [bar, title, subtitle];
}

// Avatar (spec/09): a circular image. Just an ImageElement that's square +
// aspect-locked with a 'full' corner radius (CSS clamps that to a circle).
// Built to back the Header component but also useful standalone. Centred on
// (cx, cy); imageId is null until the picker fills it.
const AVATAR_SIZE = 96;
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

// Hero (spec/09): a large image with a title + supporting line on a themed
// caption card, as a composite GROUP (image + card + title + body sharing one
// groupId). The card is the theme accent (the hero follows the tab theme),
// inset near the bottom rather than covering the whole image — so the image
// stays double-clickable to set / change it (the picker is no longer opened
// automatically). `accent` is supplied by the caller (theme -> colour mapping
// stays in the app). Returned in paint order: image, then card, then text.
const HERO_WIDTH = 520;
const HERO_HEIGHT = 300;
export function createHero(cx: number, cy: number, accent: string): BoxedElement[] {
  const groupId: ElementId = crypto.randomUUID();
  const left = cx - HERO_WIDTH / 2;
  const top = cy - HERO_HEIGHT / 2;
  const cardMargin = 22;
  const cardHeight = 96;
  const cardLeft = left + cardMargin;
  const cardWidth = HERO_WIDTH - cardMargin * 2;
  const cardTop = top + HERO_HEIGHT - cardMargin - cardHeight;
  const textInset = 20;
  const image: ImageElement = {
    ...createImage(left, top),
    width: HERO_WIDTH,
    height: HERO_HEIGHT,
    borderRadius: 'lg',
    objectFit: 'cover',
    groupId,
  };
  // Caption card: accent at high opacity so the white text reads regardless of
  // the photo behind it, but inset so the image is reachable above / around it.
  const card: ShapeElement = {
    ...createShape('square', cardLeft, cardTop),
    width: cardWidth,
    height: cardHeight,
    fillColor: accent,
    strokeColor: accent,
    strokeWidth: 'none',
    borderRadius: 'lg',
    opacity: 0.82,
    groupId,
  };
  const title: TextElement = {
    ...createText(cardLeft + textInset, cardTop + 16),
    width: cardWidth - textInset * 2,
    height: 34,
    label: 'Hero title',
    textSize: 'lg',
    textBold: true,
    textAlignX: 'center',
    textAlignY: 'middle',
    textColor: '#ffffff',
    groupId,
  };
  const body: TextElement = {
    ...createText(cardLeft + textInset, cardTop + 16 + 32),
    width: cardWidth - textInset * 2,
    height: 30,
    label: 'A short supporting line of text over the image.',
    textSize: 'sm',
    textAlignX: 'center',
    textAlignY: 'middle',
    textColor: '#ffffff',
    opacity: 0.92,
    groupId,
  };
  return [image, card, title, body];
}

// Header (spec/09): a website-style header bar as a composite GROUP — an
// accent bar with a circular avatar on the left, a brand/logo title beside
// it, and a row of nav links on the right, all sharing one groupId. Follows
// the tab theme via the accent bar + white text. Returned in paint order
// (bar first). Centred on (cx, cy).
const HEADER_WIDTH = 640;
const HEADER_HEIGHT = 84;
const HEADER_LINKS = ['Home', 'About', 'Contact'] as const;
export function createHeader(cx: number, cy: number, accent: string): BoxedElement[] {
  const groupId: ElementId = crypto.randomUUID();
  const left = cx - HEADER_WIDTH / 2;
  const top = cy - HEADER_HEIGHT / 2;
  const pad = 22;
  const avatarSize = 48;
  const bar: ShapeElement = {
    ...createShape('square', left, top),
    width: HEADER_WIDTH,
    height: HEADER_HEIGHT,
    fillColor: accent,
    strokeColor: accent,
    strokeWidth: 'none',
    borderRadius: 'md',
    groupId,
  };
  const avatar: ImageElement = {
    ...createImage(left + pad, top + (HEADER_HEIGHT - avatarSize) / 2),
    width: avatarSize,
    height: avatarSize,
    borderRadius: 'full',
    objectFit: 'cover',
    aspectLocked: true,
    groupId,
  };
  const titleHeight = 30;
  const title: TextElement = {
    ...createText(left + pad + avatarSize + 14, top + (HEADER_HEIGHT - titleHeight) / 2),
    width: 200,
    height: titleHeight,
    label: 'Brand',
    textSize: 'md',
    textBold: true,
    textAlignX: 'left',
    textAlignY: 'middle',
    textColor: '#ffffff',
    groupId,
  };
  const linkW = 92;
  const linkH = 28;
  const gap = 4;
  const linkY = top + (HEADER_HEIGHT - linkH) / 2;
  const rowWidth = HEADER_LINKS.length * linkW + (HEADER_LINKS.length - 1) * gap;
  const rowStart = left + HEADER_WIDTH - pad - rowWidth;
  const links: TextElement[] = HEADER_LINKS.map((label, i) => ({
    ...createText(rowStart + i * (linkW + gap), linkY),
    width: linkW,
    height: linkH,
    label,
    textSize: 'sm',
    textAlignX: 'center',
    textAlignY: 'middle',
    textColor: '#ffffff',
    opacity: 0.9,
    groupId,
  }));
  return [bar, avatar, title, ...links];
}

// Theme colours a component is built from. `accent` is the theme accent
// (elementStroke); `surface` is the light element fill; `ink` is the element
// text colour. The fill/text pair is what every theme guarantees legible
// together, so components built on a `surface` card with `ink` text stay
// readable on light AND dark themes (the caller maps theme -> these, keeping
// this package theme-agnostic).
export type ComponentColors = { accent: string; surface: string; ink: string };

// Callout / note box (spec/09): a soft surface card with an accent badge, a
// bold title, and a body line — for annotating a diagram. Composite group.
const CALLOUT_WIDTH = 380;
const CALLOUT_HEIGHT = 116;
export function createCallout(cx: number, cy: number, c: ComponentColors): BoxedElement[] {
  const groupId: ElementId = crypto.randomUUID();
  const left = cx - CALLOUT_WIDTH / 2;
  const top = cy - CALLOUT_HEIGHT / 2;
  const pad = 18;
  const badge = 30;
  const box: ShapeElement = {
    ...createShape('square', left, top),
    width: CALLOUT_WIDTH,
    height: CALLOUT_HEIGHT,
    fillColor: c.surface,
    strokeColor: c.accent,
    strokeWidth: 'thin',
    borderRadius: 'md',
    groupId,
  };
  // Accent badge with an "i" — an info marker built from a circle + its label.
  const badgeEl: ShapeElement = {
    ...createShape('circle', left + pad, top + pad),
    width: badge,
    height: badge,
    fillColor: c.accent,
    strokeColor: c.accent,
    strokeWidth: 'none',
    label: 'i',
    textColor: '#ffffff',
    textBold: true,
    textSize: 'sm',
    aspectLocked: true,
    groupId,
  };
  const textLeft = left + pad + badge + 14;
  const textWidth = CALLOUT_WIDTH - pad - (pad + badge + 14);
  const title: TextElement = {
    ...createText(textLeft, top + pad - 2),
    width: textWidth,
    height: 24,
    label: 'Heads up',
    textSize: 'md',
    textBold: true,
    textAlignX: 'left',
    textAlignY: 'middle',
    textColor: c.ink,
    groupId,
  };
  const body: TextElement = {
    ...createText(textLeft, top + pad + 24),
    width: textWidth,
    height: CALLOUT_HEIGHT - pad * 2 - 24,
    label: 'A short note with some supporting detail.',
    textSize: 'sm',
    textAlignX: 'left',
    textAlignY: 'top',
    textColor: c.ink,
    opacity: 0.8,
    groupId,
  };
  return [box, badgeEl, title, body];
}

// Stat row (spec/09): three KPI cards (big number + caption) side by side, as
// one composite group. The number pops in the accent; the card is the theme
// surface with a thin accent border, the caption muted ink.
const STAT_CARD_WIDTH = 150;
const STAT_CARD_HEIGHT = 96;
const STAT_GAP = 16;
const STAT_PRESETS = [
  { value: '1.2k', caption: 'Users' },
  { value: '98%', caption: 'Uptime' },
  { value: '4.7', caption: 'Rating' },
] as const;
const STAT_ROW_WIDTH = STAT_PRESETS.length * STAT_CARD_WIDTH + (STAT_PRESETS.length - 1) * STAT_GAP;
export function createStatRow(cx: number, cy: number, c: ComponentColors): BoxedElement[] {
  const groupId: ElementId = crypto.randomUUID();
  const left = cx - STAT_ROW_WIDTH / 2;
  const top = cy - STAT_CARD_HEIGHT / 2;
  const out: BoxedElement[] = [];
  STAT_PRESETS.forEach((s, i) => {
    const x = left + i * (STAT_CARD_WIDTH + STAT_GAP);
    out.push({
      ...createShape('square', x, top),
      width: STAT_CARD_WIDTH,
      height: STAT_CARD_HEIGHT,
      fillColor: c.surface,
      strokeColor: c.accent,
      strokeWidth: 'thin',
      borderRadius: 'md',
      groupId,
    });
    out.push({
      ...createText(x + 10, top + 16),
      width: STAT_CARD_WIDTH - 20,
      height: 36,
      label: s.value,
      textSize: 'lg',
      textBold: true,
      textAlignX: 'center',
      textAlignY: 'middle',
      textColor: c.accent,
      groupId,
    });
    out.push({
      ...createText(x + 10, top + 16 + 34),
      width: STAT_CARD_WIDTH - 20,
      height: 22,
      label: s.caption,
      textSize: 'sm',
      textAlignX: 'center',
      textAlignY: 'middle',
      textColor: c.ink,
      opacity: 0.7,
      groupId,
    });
  });
  return out;
}

// Process steps (spec/09): numbered accent circles joined by arrows, with a
// caption under each. The circles + captions share a group; the connectors are
// arrows pinned to the circles, so they follow when the group moves / scales.
const PROCESS_STEP_SIZE = 60;
const PROCESS_STRIDE = PROCESS_STEP_SIZE + 96; // centre-to-centre spacing
const PROCESS_PRESETS = [
  { n: '1', caption: 'Plan' },
  { n: '2', caption: 'Build' },
  { n: '3', caption: 'Ship' },
] as const;
const PROCESS_WIDTH = (PROCESS_PRESETS.length - 1) * PROCESS_STRIDE + PROCESS_STEP_SIZE;
const PROCESS_HEIGHT = PROCESS_STEP_SIZE + 8 + 24;
export function createProcessSteps(cx: number, cy: number, c: ComponentColors): Element[] {
  const groupId: ElementId = crypto.randomUUID();
  const left = cx - PROCESS_WIDTH / 2;
  const top = cy - PROCESS_HEIGHT / 2;
  const captionW = 140;
  const circles: ShapeElement[] = PROCESS_PRESETS.map((s, i) => ({
    ...createShape('circle', left + i * PROCESS_STRIDE, top),
    width: PROCESS_STEP_SIZE,
    height: PROCESS_STEP_SIZE,
    fillColor: c.accent,
    strokeColor: c.accent,
    strokeWidth: 'none',
    label: s.n,
    textColor: '#ffffff',
    textBold: true,
    textSize: 'lg',
    aspectLocked: true,
    groupId,
  }));
  const captions: TextElement[] = PROCESS_PRESETS.map((s, i) => ({
    ...createText(
      left + i * PROCESS_STRIDE + PROCESS_STEP_SIZE / 2 - captionW / 2,
      top + PROCESS_STEP_SIZE + 8,
    ),
    width: captionW,
    height: 24,
    label: s.caption,
    textSize: 'sm',
    textAlignX: 'center',
    textAlignY: 'middle',
    textColor: c.ink,
    groupId,
  }));
  const arrows: ArrowElement[] = [];
  for (let i = 0; i < circles.length - 1; i++) {
    arrows.push({
      ...createPinnedArrow(circles[i]!.id, 'e', circles[i + 1]!.id, 'w'),
      arrowEnds: 'to',
      strokeColor: c.accent,
    });
  }
  // Arrows first (behind the circles), then circles, then captions.
  return [...arrows, ...circles, ...captions];
}

// The component catalogue: kinds, their natural bounds (for the tap-to-drop
// default size + the drag-to-draw scale denominator), and a single builder so
// the draw-to-size path (spec/09) treats every component uniformly. Banner /
// Hero / Header take just the accent; the rest take the full colour triple;
// Avatar is a lone circular image (its colours are irrelevant).
export type ComponentKind =
  | 'banner'
  | 'hero'
  | 'header'
  | 'callout'
  | 'stat'
  | 'process'
  | 'avatar';

export const COMPONENT_SIZE: Record<ComponentKind, { width: number; height: number }> = {
  banner: { width: BANNER_WIDTH, height: BANNER_HEIGHT },
  hero: { width: HERO_WIDTH, height: HERO_HEIGHT },
  header: { width: HEADER_WIDTH, height: HEADER_HEIGHT },
  callout: { width: CALLOUT_WIDTH, height: CALLOUT_HEIGHT },
  stat: { width: STAT_ROW_WIDTH, height: STAT_CARD_HEIGHT },
  process: { width: PROCESS_WIDTH, height: PROCESS_HEIGHT },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE },
};

export function createComponent(
  kind: ComponentKind,
  cx: number,
  cy: number,
  colors: ComponentColors,
): Element[] {
  switch (kind) {
    case 'banner':
      return createBanner(cx, cy, colors.accent);
    case 'hero':
      return createHero(cx, cy, colors.accent);
    case 'header':
      return createHeader(cx, cy, colors.accent);
    case 'callout':
      return createCallout(cx, cy, colors);
    case 'stat':
      return createStatRow(cx, cy, colors);
    case 'process':
      return createProcessSteps(cx, cy, colors);
    case 'avatar':
      return [createAvatar(cx, cy)];
  }
}
