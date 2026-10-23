// The Design templates' pages (docs/specs/008-canvas/canvas-and-palette.md "Templates on pages"): the
// Floor Plan and the Storyboard open in Pages, each on one infographic page sized for what it is: an
// A3 landscape sheet, the paper a plan and a shoot's boards are printed on. Each drawing keeps its own builder and its own size
// (the floor plan is to a captioned metric scale, so it is never scaled): it is built once to be
// measured, then again centred on its page.
//
// Pure: kind in, pages or elements out.
import { elementBounds, layOutPages, type Element, type Page } from '@livedocuments/document';
import { templatePage } from './template-page-kit';
import type { TemplateKind } from './templates';

type DesignTemplateKind = 'floor-plan' | 'storyboard';

// White for the storyboard's printed sheet; the floor plan's sheet ruled in a grid, since a plan is
// a scale drawing. (On the open canvas they rode the canvas's graph paper; on a page the page
// carries its own.)
const DRAFTING = { pattern: 'grid' } as const;

const DESIGN_PAGES: Readonly<Record<DesignTemplateKind, Page>> = {
  'floor-plan': templatePage(1, 'a3', 'landscape', 'Floor Plan', DRAFTING),
  storyboard: templatePage(1, 'a3', 'landscape', 'Storyboard'),
};

export function isDesignTemplate(kind: TemplateKind): kind is DesignTemplateKind {
  return kind in DESIGN_PAGES;
}

/** A Design template's one page. */
export function designTemplatePages(kind: DesignTemplateKind): Page[] {
  return [DESIGN_PAGES[kind]];
}

/** A Design template's drawing, centred on its page: `build` is its builder, which draws about the
 *  centre it is given. */
export function buildOnDesignPage(
  kind: DesignTemplateKind,
  build: (cx: number, cy: number) => Element[],
): Element[] {
  const [page] = layOutPages(designTemplatePages(kind));
  const { x, y, width, height } = page!.rect;
  const probe = build(0, 0);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const el of probe) {
    const b = elementBounds(el, probe);
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width);
    y1 = Math.max(y1, b.y + b.height);
  }
  // Whole pixels, so the drawing's own grid stays on whole pixels.
  return build(
    Math.round(x + width / 2 - (x0 + x1) / 2),
    Math.round(y + height / 2 - (y0 + y1) / 2),
  );
}
