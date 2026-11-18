// The slides a presented template seeds its document's deck with (docs/specs/012-collaboration/presentation-mode.md
// "Decks a template seeds"), found on the tab it built. Pure: the editor, the MCP and the api reach for the same
// answer. The slides themselves are data (template-slides-data.ts); here each anchor is found by its label, its panel
// (the smallest element around it, short of a board-sized one) joins it, and the slide shows every element whose
// centre lies in the region they cover. Arrows are left out: a slide shows an arrow whose two ends are on it.
import {
  appendToStoredPresentation,
  type Element,
  type Slide,
  type Tab,
} from '@livediagram/document';
import { TEMPLATE_SLIDES, type TemplateSlideSpec } from './template-slides-data';
import type { TemplateKind } from './templates';

type Box = { x: number; y: number; width: number; height: number };

// A panel bigger than this share of the board is the board's own backdrop, not a section's.
const PANEL_MAX_SHARE = 0.4;
// Room round a region so an element drawn flush to its edge still counts.
const SLACK = 2;

const boxOf = (el: Element): Box | null => {
  if (el.type === 'arrow') return null;
  const { x, y, width, height } = el as Partial<Box>;
  if (![x, y, width, height].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  return { x: x!, y: y!, width: width!, height: height! };
};

const firstLine = (el: Element): string => {
  const { label, pageTitle } = el as { label?: unknown; pageTitle?: unknown };
  const text = typeof pageTitle === 'string' && pageTitle ? pageTitle : label;
  return typeof text === 'string' ? (text.split('\n')[0] ?? '').trim() : '';
};

const union = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
};

const contains = (outer: Box, inner: Box) =>
  outer.x <= inner.x + SLACK &&
  outer.y <= inner.y + SLACK &&
  outer.x + outer.width >= inner.x + inner.width - SLACK &&
  outer.y + outer.height >= inner.y + inner.height - SLACK;

const area = (b: Box) => b.width * b.height;

/** Whether a template kind seeds a deck: the presented ones, whose talk track reads as slides. */
export function isPresentedTemplate(kind: TemplateKind): boolean {
  return TEMPLATE_SLIDES[kind] !== undefined;
}

/**
 * The slides a template's tab presents as, in talk order, with fresh ids from `newId`. Empty for a template that is
 * not presented, or when the tab no longer holds an anchor (a slide with nothing on it is left out, never seeded
 * empty).
 */
export function templateSlides(kind: TemplateKind, tab: Tab, newId: () => string): Slide[] {
  const specs = TEMPLATE_SLIDES[kind];
  if (!specs) return [];
  const boxed = tab.elements.flatMap((el) => {
    const box = boxOf(el);
    return box ? [{ el, box }] : [];
  });
  if (boxed.length === 0) return [];
  const board = boxed.map((b) => b.box).reduce(union);
  const slides: Slide[] = [];
  for (const spec of specs) {
    const elementIds = spec.anchors
      ? sectionMembers(spec, boxed, board)
      : boxed.map((b) => b.el.id);
    if (elementIds.length === 0) continue;
    slides.push({ id: newId(), name: spec.name, tabId: tab.id, elementIds, notes: spec.notes });
  }
  return slides;
}

function sectionMembers(
  spec: TemplateSlideSpec,
  boxed: { el: Element; box: Box }[],
  board: Box,
): string[] {
  let region: Box | null = null;
  for (const anchor of spec.anchors ?? []) {
    const found =
      boxed.find((b) => firstLine(b.el) === anchor) ??
      boxed.find((b) => firstLine(b.el).startsWith(anchor));
    if (!found) return [];
    // Its panel: the smallest element round it that is not the board's own backdrop.
    const panel = boxed
      .filter(
        (b) =>
          b !== found &&
          area(b.box) > area(found.box) &&
          area(b.box) < area(board) * PANEL_MAX_SHARE &&
          contains(b.box, found.box),
      )
      .sort((a, b) => area(a.box) - area(b.box))[0];
    const reach = panel ? union(found.box, panel.box) : found.box;
    region = region ? union(region, reach) : reach;
  }
  if (!region) return [];
  if (spec.rows) region = { ...region, x: board.x, width: board.width };
  if (spec.under) region = takeUnder(region, boxed);
  const r = region;
  return boxed
    .filter(({ box }) => {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      return (
        cx >= r.x - SLACK &&
        cx <= r.x + r.width + SLACK &&
        cy >= r.y - SLACK &&
        cy <= r.y + r.height + SLACK &&
        box.width <= r.width + SLACK &&
        box.height <= r.height + SLACK
      );
    })
    .map((b) => b.el.id);
}

// The most a heading's content may sit below it and still be its own.
const UNDER_GAP = 48;

// The region grown down over everything straight under it (starting no more than UNDER_GAP below
// its bottom, centred inside it), again and again until nothing more joins: a heading's table, or a column's entries.
function takeUnder(region: Box, boxed: { box: Box }[]): Box {
  let r = region;
  for (;;) {
    const bottom = r.y + r.height;
    const joining = boxed.filter(
      ({ box }) =>
        box.x + box.width / 2 >= r.x &&
        box.x + box.width / 2 <= r.x + r.width &&
        box.y > bottom - SLACK &&
        box.y <= bottom + UNDER_GAP,
    );
    if (joining.length === 0) return r;
    r = joining.map((j) => j.box).reduce(union, r);
  }
}

/**
 * A stored presentation (the document row's serialised deck, or null) with slides appended to its first deck, after
 * whatever it already shows; any later deck is kept as it was. A slide the deck already holds (by id) is not added
 * again, so a retried append is harmless.
 */
export function withAppendedSlides(
  presentation: string | null,
  added: readonly Slide[],
): string | null {
  return appendToStoredPresentation(presentation, added).presentation;
}
