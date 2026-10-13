// The Contents popover's list (docs/specs/007-editor/illustrate-pages.md "Contents"): a row per
// page in row order, what each says about itself, which page is in view, and the Find a Page
// narrowing. Pure: pages and the view in, rows out.
import {
  articleTitleOf,
  pageHasOrientation,
  pageKindOf,
  pageSizeLabel,
  type ArticleFlow,
  type LaidOutPage,
} from '@livediagram/document';

export type ContentsRow = {
  id: string;
  // Its place in the row, from 1.
  number: number;
  // Its own name, else "Page n".
  name: string;
  // What it is: "Infographic · A4 Portrait", "Slide · In the deck", "Article · Its Title", "Logo".
  line: string;
  locked: boolean;
  // Its shape on the sheet, for the thumbnail's frame.
  aspect: number;
};

// More pages than this show the Find a Page box.
export const CONTENTS_FIND_AFTER = 6;

const KIND_NAME = {
  infographic: 'Infographic',
  slide: 'Slide',
  article: 'Article',
  logo: 'Logo',
} as const;

export function contentsRows(
  pages: readonly LaidOutPage[],
  opts: {
    // Whether the deck has a slide of the page; absent where there is no deck to ask.
    inDeck?: (pageId: string) => boolean;
    articles?: Readonly<Record<string, ArticleFlow>>;
  } = {},
): ContentsRow[] {
  return pages.map((p, i) => {
    const kind = pageKindOf(p);
    let line: string = KIND_NAME[kind];
    if (kind === 'infographic') {
      const size = pageSizeLabel(p);
      const turn = pageHasOrientation(p) && ['a4', 'letter', 'a3'].includes(p.size ?? 'a4');
      line += ` · ${size}${turn ? ` ${p.orientation === 'portrait' ? 'Portrait' : 'Landscape'}` : ''}`;
    } else if (kind === 'slide' && opts.inDeck) {
      line += opts.inDeck(p.id) ? ' · In the deck' : ' · Not in the deck';
    } else if (kind === 'article' && p.flow) {
      const flow = opts.articles?.[p.flow];
      const title = flow ? articleTitleOf(flow).trim() : '';
      if (title) line += ` · ${title}`;
    }
    return {
      id: p.id,
      number: i + 1,
      name: p.name?.trim() || `Page ${i + 1}`,
      line,
      locked: p.locked === true,
      aspect: p.rect.width / p.rect.height,
    };
  });
}

/** The rows a Find a Page query keeps: every word found in the name, the line or the number. */
export function filterContents(rows: readonly ContentsRow[], query: string): ContentsRow[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...rows];
  return rows.filter((r) => {
    const hay = `${r.number} ${r.name} ${r.line}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** The page in view: the one whose rectangle holds the middle of the screen, else the nearest to
 *  it. `view` is the canvas's (a screen point is (canvas + offset) × zoom) and `screen` the canvas
 *  area's size in screen px. */
export function pageInView(
  pages: readonly LaidOutPage[],
  view: { zoom: number; offset: { x: number; y: number } },
  screen: { width: number; height: number },
): string | undefined {
  if (pages.length === 0) return undefined;
  const cx = screen.width / 2 / view.zoom - view.offset.x;
  const cy = screen.height / 2 / view.zoom - view.offset.y;
  let best: LaidOutPage | undefined;
  let bestD = Infinity;
  for (const p of pages) {
    const dx = Math.max(p.rect.x - cx, 0, cx - (p.rect.x + p.rect.width));
    const dy = Math.max(p.rect.y - cy, 0, cy - (p.rect.y + p.rect.height));
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best?.id;
}
