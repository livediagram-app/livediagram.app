// The kit a template that opens on pages builds with (docs/specs/008-canvas/
// canvas-and-palette.md "Templates on pages"): its pages, declared once, and a page-scale layout kit
// for each (page-layout-kit.ts) over that page's content box, the page less its margin. The pages
// sit where Pages lays them out (layOutPages), so a paged template's elements are
// built in page coordinates and ignore the centre every other template is built around.
import {
  layOutPages,
  newLogoPage,
  pageMargin,
  type Page,
  type PageBackground,
} from '@livedesign/document';
import { kit, type Kit } from './page-layout-kit';

/** A template's logo page (docs/specs/007-editor/logo-pages.md): the 1024 artboard, named. */
export function templateLogoPage(n: number, name: string, background?: PageBackground): Page {
  return {
    ...newLogoPage(`page-${n}`),
    ...(background?.fill ? { background: { fill: background.fill } } : {}),
    name,
  };
}

/** One layout kit per page, in page order, each over its page's content box. */
export function pageKits(pages: readonly Page[]): Kit[] {
  return layOutPages(pages).map((p) => {
    const m = pageMargin(p);
    const { x, y, width, height } = p.rect;
    return kit({ x: x + m, y: y + m, width: width - m * 2, height: height - m * 2 });
  });
}
