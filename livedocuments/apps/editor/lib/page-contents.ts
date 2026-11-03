// Contents' rows (docs/specs/007-editor/pages-mode.md "Contents"): a row per page in row order, what
// each says about itself, and where a dropped page lands. Pure: pages in, rows out. Which page is in
// view and the Find a Page narrowing read the same in every editor with pages, so they are shared
// (@liveworkspace/workbench/lib/page-contents) and re-exported here for the editor's own callers.
import {
  articleTitleOf,
  flashcardSpeakingSeconds,
  speakingTimeLabel,
  pageHasOrientation,
  pageKindOf,
  pageSizeLabel,
  pageUnits,
  type ArticleFlow,
  type Page,
  type LaidOutPage,
  type PageKind,
} from '@livedocuments/document';
import { rowDropIndex, type RowDrop } from '@liveworkspace/workbench/hooks/ui/useRowReorderDrag';
import type { ContentsRowBase } from '@liveworkspace/workbench/lib/page-contents';

export { filterContents, pageInView } from '@liveworkspace/workbench/lib/page-contents';

// The shared row (its number, name, kind line, lock and shape), with what this editor adds.
export type ContentsRow = ContentsRowBase & {
  kind: PageKind;
  // A slide page with a slide in the deck; absent where there is no deck to ask.
  inDeck?: boolean;
  // A page (any kind) whose slide the deck skips when presenting: its row shows a crossed eye.
  hiddenInSlides?: boolean;
  // A card's speaking time ("45 sec"), shown beside its name; absent off a card or on an empty one.
  speakingTime?: string;
};

const KIND_NAME = {
  infographic: 'Infographic',
  slide: 'Slide',
  article: 'Article',
  flashcard: 'Flashcard',
} as const;

export function contentsRows(
  pages: readonly LaidOutPage[],
  opts: {
    // Whether the deck has a slide of the page; absent where there is no deck to ask.
    inDeck?: (pageId: string) => boolean;
    // Whether the deck's slide of the page is hidden; absent where there is no deck to ask.
    hiddenInSlides?: (pageId: string) => boolean;
    articles?: Readonly<Record<string, ArticleFlow>>;
  } = {},
): ContentsRow[] {
  return pages.map((p, i) => {
    const kind = pageKindOf(p);
    let line: string = KIND_NAME[kind];
    let speakingTime: string | null = null;
    if (kind === 'infographic') {
      const size = pageSizeLabel(p);
      const turn = pageHasOrientation(p) && ['a4', 'letter', 'a3'].includes(p.size ?? 'a4');
      line += ` · ${size}${turn ? ` ${p.orientation === 'portrait' ? 'Portrait' : 'Landscape'}` : ''}`;
    } else if (kind === 'slide' && opts.inDeck) {
      line += opts.inDeck(p.id) ? ' · In the deck' : ' · Not in the deck';
    } else if ((kind === 'article' || kind === 'flashcard') && p.flow) {
      const flow = opts.articles?.[p.flow];
      const title = flow ? articleTitleOf(flow).trim() : '';
      if (title) line += ` · ${title}`;
      // A card says how long it takes to say (docs/specs/007-editor/flashcards.md "Card number and
      // speaking time").
      speakingTime =
        kind === 'flashcard' && flow ? speakingTimeLabel(flashcardSpeakingSeconds(flow)) : null;
      if (speakingTime) line += ` · ${speakingTime}`;
    }
    return {
      id: p.id,
      number: i + 1,
      name: p.name?.trim() || `${kind === 'flashcard' ? 'Card' : 'Page'} ${i + 1}`,
      line,
      locked: p.locked === true,
      aspect: p.rect.width / p.rect.height,
      kind,
      ...(kind === 'slide' && opts.inDeck ? { inDeck: opts.inDeck(p.id) } : {}),
      ...(opts.hiddenInSlides?.(p.id) ? { hiddenInSlides: true } : {}),
      ...(speakingTime ? { speakingTime } : {}),
    };
  });
}

/** The place (among the row's units, 0 first) a page dropped beside the row at `drop.index` moves
 *  to, or null when it stays put (docs/specs/007-editor/pages-mode.md "Contents"). A page moves
 *  with its unit: an article's pages go together, so a drop beside any of its pages is a drop beside
 *  the whole article. */
export function contentsDropUnit(
  pages: readonly Pick<Page, 'id' | 'flow'>[],
  pageId: string,
  drop: RowDrop,
): number | null {
  const units = pageUnits(pages as Page[]);
  const unitOf = (id: string) => units.findIndex((u) => u.pageIds.includes(id));
  const from = unitOf(pageId);
  const target = pages[drop.index];
  if (from < 0 || !target) return null;
  const at = unitOf(target.id);
  if (at === from) return null;
  // Among units, the list's own rule (rowDropIndex): the caret sits between units.
  return rowDropIndex(from, { index: at, side: drop.side }, units.length);
}
