// The web components (docs/specs/009-elements/web-components-and-no-groups.md): Banner, Callout, Stat row, Process steps and
// Header as single shape kinds, plus the Hero's caption card on an image.
//
// They used to be bundles of primitives held together by a shared groupId,
// which meant a resize was a uniform zoom of loose boxes and a stray drag
// pulled one apart. As single elements they lay themselves out, and the
// layouts below are PURE so the canvas view and the headless SVG renderer
// call the same maths: an export matches the editor.
//
// A leaf module (types only from './index') like data-shapes.ts, so the
// validator and the shape factory can read its constants at module-init time
// without walking the index cycle.

import { clamp, type Rect } from './geometry-primitives';
import type { ShapeKind } from './index';

// --- Vocabulary -------------------------------------------------------------

export type WebComponentShape = 'banner' | 'callout' | 'stat-row' | 'process' | 'site-header';

export function isWebComponentShape(kind: ShapeKind): kind is WebComponentShape {
  return (
    kind === 'banner' ||
    kind === 'callout' ||
    kind === 'stat-row' ||
    kind === 'process' ||
    kind === 'site-header'
  );
}

// The two that are a solid ACCENT BAR under white text. Their bar paints in
// `fillColor`, falling back to the stroke (the theme accent), and theme
// switches retheme only the stroke: writing the theme's pale element fill
// into an accent bar under white text is how the grouped banner used to go
// unreadable after a theme change.
export function isAccentBarShape(kind: ShapeKind): boolean {
  return kind === 'banner' || kind === 'site-header';
}

// White: the one text colour an accent bar is guaranteed to carry.
export const ACCENT_BAR_TEXT = '#ffffff';

// --- Rows -------------------------------------------------------------------

export type StatItem = { value: string; caption: string };

// Per-string bound for every row of text these elements carry: a stat's value
// or caption, a step, a nav link. Short on purpose; these are labels.
export const WEB_TEXT_MAX = 80;
export const STATS_MIN = 1;
export const STATS_MAX = 6;
export const PROCESS_MIN_STEPS = 2;
export const PROCESS_MAX_STEPS = 8;
export const NAV_LINKS_MAX = 6;

export const STAT_DEFAULTS: readonly StatItem[] = [
  { value: '1.2k', caption: 'Users' },
  { value: '98%', caption: 'Uptime' },
  { value: '4.7', caption: 'Rating' },
];
export const PROCESS_DEFAULT_STEPS: readonly string[] = ['Plan', 'Build', 'Ship'];
export const NAV_DEFAULT_LINKS: readonly string[] = ['Home', 'About', 'Contact'];

// The Hero's caption card (docs/specs/009-elements/web-components-and-no-groups.md): on an ImageElement, present = shown.
export type HeroCaption = { title: string; subtitle: string };
export const HERO_DEFAULT_CAPTION: HeroCaption = {
  title: 'Hero title',
  subtitle: 'A short supporting line of text over the image.',
};

// Trim + bound a row string the way every write path should.
export function clampWebText(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, WEB_TEXT_MAX);
}

// --- Layout -----------------------------------------------------------------

export type LayoutRect = Rect;

// Stat row: the cards share the width equally with a fixed gap, and the
// value's size follows the card height, so a taller row gets bigger numbers
// rather than more empty card. Rects are element-relative.
export const STAT_GAP = 16;
export function statRowLayout(
  width: number,
  height: number,
  count: number,
): { cards: LayoutRect[]; valuePx: number; captionPx: number } {
  const n = Math.max(1, count);
  const gap = Math.min(STAT_GAP, (width * 0.2) / Math.max(1, n - 1));
  const cardW = Math.max(0, (width - gap * (n - 1)) / n);
  const cards = Array.from({ length: n }, (_, i) => ({
    x: i * (cardW + gap),
    y: 0,
    width: cardW,
    height,
  }));
  // Height drives the numbers, width caps them so a long value still fits a
  // narrow card.
  const valuePx = Math.round(clamp(Math.min(height * 0.34, cardW * 0.28), 12, 72));
  const captionPx = Math.round(clamp(valuePx * 0.45, 10, 22));
  return { cards, valuePx, captionPx };
}

// Process steps: the steps spread evenly across the width, connectors run
// between neighbouring circles, and the diameter follows the smaller of the
// height and the step spacing, so adding a step on a narrow element shrinks
// the circles instead of overlapping them.
export type ProcessStepLayout = { cx: number; cy: number; r: number; caption: LayoutRect };
export function processLayout(
  width: number,
  height: number,
  count: number,
): {
  steps: ProcessStepLayout[];
  connectors: { x1: number; x2: number; y: number }[];
  numberPx: number;
  captionPx: number;
} {
  const n = Math.max(1, count);
  const colW = width / n;
  const captionPx = Math.round(clamp(height * 0.14, 10, 20));
  const captionH = Math.round(captionPx * 1.6);
  const captionGap = 6;
  const d = Math.max(8, Math.min(height - captionH - captionGap, colW * 0.62));
  const r = d / 2;
  const cy = r;
  const steps = Array.from({ length: n }, (_, i) => {
    const cx = colW * i + colW / 2;
    return {
      cx,
      cy,
      r,
      caption: { x: colW * i, y: d + captionGap, width: colW, height: captionH },
    };
  });
  // A connector stops short of each circle so its arrowhead reads.
  const inset = Math.min(8, colW * 0.06);
  const connectors = steps.slice(0, -1).map((s, i) => ({
    x1: s.cx + r + inset,
    x2: steps[i + 1]!.cx - r - inset,
    y: cy,
  }));
  const numberPx = Math.round(clamp(d * 0.4, 10, 48));
  return { steps, connectors, numberPx, captionPx };
}

// Header: logo + brand on the left, links right-aligned. Widening the bar
// opens the gap between them; links that no longer fit are dropped from the
// right rather than overlapping the brand. Widths are estimated from the
// character count (a headless renderer has no DOM to measure), and the canvas
// view positions from the same rects so the two agree.
export const HEADER_BRAND_MIN = 90;
export function headerLayout(
  width: number,
  height: number,
  links: readonly string[],
): {
  pad: number;
  logo: { cx: number; cy: number; r: number };
  brand: LayoutRect;
  links: { text: string; rect: LayoutRect }[];
  linkPx: number;
} {
  const pad = Math.round(clamp(height * 0.26, 10, 28));
  const r = Math.max(6, Math.min(height * 0.29, 32));
  const logo = { cx: pad + r, cy: height / 2, r };
  const linkPx = Math.round(clamp(height * 0.18, 11, 20));
  const linkPadX = Math.round(linkPx * 0.8);
  const brandX = pad + r * 2 + Math.round(pad * 0.6);
  const right = width - pad;
  // Links read left to right, so keep the leading ones: measure them all,
  // then drop from the END until the rest fit beside the brand's minimum.
  const widths = links.map((t) => Math.ceil(t.length * linkPx * 0.58) + linkPadX * 2);
  const total = (k: number) => widths.slice(0, k).reduce((a, b) => a + b, 0);
  let count = links.length;
  while (count > 0 && right - total(count) < brandX + HEADER_BRAND_MIN) count--;
  const placed: { text: string; rect: LayoutRect }[] = [];
  let x = right - total(count);
  for (let i = 0; i < count; i++) {
    placed.push({ text: links[i]!, rect: { x, y: 0, width: widths[i]!, height } });
    x += widths[i]!;
  }
  const brandRight = placed.length > 0 ? placed[0]!.rect.x : right;
  const brand = { x: brandX, y: 0, width: Math.max(0, brandRight - brandX - 8), height };
  return { pad, logo, brand, links: placed, linkPx };
}

// Banner / Callout: the text region inside the padding. A banner's subtitle
// sits under the title; a callout's badge takes a column on the left.
export function bannerLayout(
  width: number,
  height: number,
): { title: LayoutRect; subtitle: LayoutRect; subtitlePx: number } {
  const pad = Math.round(clamp(Math.min(width, height) * 0.16, 8, 32));
  const subtitlePx = Math.round(clamp(height * 0.13, 11, 22));
  const subH = Math.round(subtitlePx * 1.5);
  const inner = { x: pad, y: pad, width: Math.max(0, width - pad * 2), height: height - pad * 2 };
  return {
    title: { ...inner, height: Math.max(0, inner.height - subH) },
    subtitle: { x: inner.x, y: inner.y + inner.height - subH, width: inner.width, height: subH },
    subtitlePx,
  };
}

export function calloutLayout(
  width: number,
  height: number,
): {
  badge: { cx: number; cy: number; r: number };
  heading: LayoutRect;
  body: LayoutRect;
  headingPx: number;
} {
  const pad = Math.round(clamp(Math.min(width, height) * 0.15, 8, 24));
  const r = Math.round(clamp(Math.min(width, height) * 0.13, 8, 22));
  const badge = { cx: pad + r, cy: pad + r, r };
  const textX = pad + r * 2 + Math.round(pad * 0.75);
  const headingPx = Math.round(clamp(height * 0.14, 12, 24));
  const headingH = Math.round(headingPx * 1.4);
  const textW = Math.max(0, width - textX - pad);
  return {
    badge,
    heading: { x: textX, y: pad, width: textW, height: headingH },
    body: {
      x: textX,
      y: pad + headingH + 2,
      width: textW,
      height: Math.max(0, height - pad * 2 - headingH - 2),
    },
    headingPx,
  };
}

// The hero's caption card: inset near the bottom, so the image above and
// around it stays reachable (double-click to set / change it).
export function heroCaptionLayout(
  width: number,
  height: number,
): {
  card: LayoutRect;
  title: LayoutRect;
  subtitle: LayoutRect;
  titlePx: number;
  subtitlePx: number;
} {
  const margin = Math.round(clamp(Math.min(width, height) * 0.06, 6, 28));
  const titlePx = Math.round(clamp(height * 0.075, 12, 34));
  const subtitlePx = Math.round(clamp(titlePx * 0.55, 10, 18));
  const padY = Math.round(titlePx * 0.6);
  const cardH = Math.min(height - margin * 2, padY * 2 + titlePx * 1.35 + subtitlePx * 1.5);
  const card = {
    x: margin,
    y: height - margin - cardH,
    width: Math.max(0, width - margin * 2),
    height: Math.max(0, cardH),
  };
  const padX = Math.round(titlePx * 0.7);
  const title = {
    x: card.x + padX,
    y: card.y + padY,
    width: Math.max(0, card.width - padX * 2),
    height: titlePx * 1.35,
  };
  const subtitle = {
    x: title.x,
    y: title.y + title.height,
    width: title.width,
    height: subtitlePx * 1.5,
  };
  return { card, title, subtitle, titlePx, subtitlePx };
}

// --- Writes -----------------------------------------------------------------

// The rows a web component carries, as one patch. Each field only lands on
// its own kind, so a selection-wide write over a stat row and a header only
// touches what each one has.
export type WebRows = { stats?: StatItem[]; processSteps?: string[]; navLinks?: string[] };

const ROW_KIND: Record<keyof WebRows, ShapeKind> = {
  stats: 'stat-row',
  processSteps: 'process',
  navLinks: 'site-header',
};

// Apply `rows` to a shape, bounded the way validate.ts bounds them: each
// string clamped, the count held between the kind's minimum and maximum (a
// process with one step is not a process; the menu can't remove below it).
// Returns the element unchanged when none of the fields fit its kind.
export function withWebRows<T extends { shape: ShapeKind }>(el: T, rows: WebRows): T {
  const patch: WebRows = {};
  if (rows.stats && el.shape === ROW_KIND.stats) {
    const next = rows.stats
      .slice(0, STATS_MAX)
      .map((st) => ({ value: clampWebText(st.value), caption: clampWebText(st.caption) }));
    if (next.length >= STATS_MIN) patch.stats = next;
  }
  if (rows.processSteps && el.shape === ROW_KIND.processSteps) {
    const next = rows.processSteps.slice(0, PROCESS_MAX_STEPS).map(clampWebText);
    if (next.length >= PROCESS_MIN_STEPS) patch.processSteps = next;
  }
  if (rows.navLinks && el.shape === ROW_KIND.navLinks) {
    patch.navLinks = rows.navLinks.slice(0, NAV_LINKS_MAX).map(clampWebText);
  }
  return Object.keys(patch).length > 0 ? { ...el, ...patch } : el;
}

// The next row to append, and whether there is room for it. Used by both the
// canvas "+" and the menu's Add button, so they add the same thing.
export function appendWebRow<T extends { shape: ShapeKind } & WebRows>(el: T): T {
  if (!canAppendWebRow(el)) return el;
  if (el.shape === 'stat-row') {
    const stats = el.stats ?? [];
    return withWebRows(el, { stats: [...stats, { value: '0', caption: 'Metric' }] });
  }
  if (el.shape === 'process') {
    const steps = el.processSteps ?? [];
    return withWebRows(el, { processSteps: [...steps, `Step ${steps.length + 1}`] });
  }
  if (el.shape === 'site-header') {
    return withWebRows(el, { navLinks: [...(el.navLinks ?? []), 'Link'] });
  }
  return el;
}

export function canAppendWebRow(el: { shape: ShapeKind } & WebRows): boolean {
  if (el.shape === 'stat-row') return (el.stats?.length ?? 0) < STATS_MAX;
  if (el.shape === 'process') return (el.processSteps?.length ?? 0) < PROCESS_MAX_STEPS;
  if (el.shape === 'site-header') return (el.navLinks?.length ?? 0) < NAV_LINKS_MAX;
  return false;
}
