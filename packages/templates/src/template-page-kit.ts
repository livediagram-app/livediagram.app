// The kit a template that opens on Illustrate pages builds with (docs/specs/008-canvas/
// canvas-and-palette.md "Templates on pages"): its pages, declared once, and a page-scale layout kit
// for each (page-layout-kit.ts) over that page's content box, the page less its margin. The pages
// sit where Illustrate lays them out (layOutIllustratePages), so a paged template's elements are
// built in page coordinates and ignore the centre every other template is built around.
import {
  layOutIllustratePages,
  newSlidePage,
  pageMargin,
  type IllustratePage,
  type PageBackground,
  type PageOrientation,
  type PageSizeId,
} from '@livediagram/document';
import { kit, type Kit } from './page-layout-kit';

/** An infographic page of a template: `page-n`, already an infographic page so the first page's
 *  kind choice is not offered. */
export function templatePage(
  n: number,
  size: PageSizeId,
  orientation: PageOrientation,
  name: string,
  background?: PageBackground,
): IllustratePage {
  return {
    id: `page-${n}`,
    orientation,
    ...(size !== 'a4' ? { size } : {}),
    ...(background ? { background } : {}),
    name,
    kind: 'infographic',
  };
}

/** A slide page of a template (docs/specs/007-editor/illustrate-pages.md "Page kinds"): `page-n`,
 *  landscape in a slide size (16:9 by default), so it offers the slide sizes and layouts and its
 *  deck button. */
export function templateSlidePage(
  n: number,
  name: string,
  background?: PageBackground,
  size: PageSizeId = 'slide',
): IllustratePage {
  return {
    ...newSlidePage(`page-${n}`, size),
    ...(background ? { background } : {}),
    name,
  };
}

/** One layout kit per page, in page order, each over its page's content box. */
export function pageKits(pages: readonly IllustratePage[]): Kit[] {
  return layOutIllustratePages(pages).map((p) => {
    const m = pageMargin(p);
    const { x, y, width, height } = p.rect;
    return kit({ x: x + m, y: y + m, width: width - m * 2, height: height - m * 2 });
  });
}
