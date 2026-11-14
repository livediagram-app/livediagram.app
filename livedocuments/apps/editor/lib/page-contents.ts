// Contents' rows (docs/specs/007-editor/pages-mode.md "Contents"): a row per page in row order, what
// each says about itself, and where a dropped page lands. Pure: pages in, rows out. Which page is in
// view reads the same in every editor with pages, so it is shared
// (@liveworkspace/workbench/lib/page-contents) and re-exported here for the editor's own callers.
import { articleOwnTitle } from './article-page-name';
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

export { pageInView } from '@liveworkspace/workbench/lib/page-contents';

// The shared row (its number, name, kind line, lock and shape), with what this editor adds.
export type ContentsRow = ContentsRowBase & {
  kind: PageKind;
  // A slide page with a slide in the deck; absent where there is no deck to ask.
  inDeck?: boolean;
  // A card's speaking time ("45 sec"), shown beside its name; absent off a card or on an empty one.
  speakingTime?: string;
};

const HIDDEN_IN_SLIDES = 'Hidden in Slides';

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
    // How many builds a slide page has (presentation-mode.md "Setting builds up"); absent where none are counted.
    buildsOf?: (pageId: string) => number;
    articles?: Readonly<Record<string, ArticleFlow>>;
    // A slide's or an infographic's own title (lib/page-title.ts), the name it goes by until someone
    // names it; absent where its words are not read.
    titleOf?: (pageId: string) => string | undefined;
  } = {},
): ContentsRow[] {
  return pages.map((p, i) => {
    const kind = pageKindOf(p);
    let line: string = KIND_NAME[kind];
    let speakingTime: string | null = null;
    // What the page goes by when nobody has named it: its own title (an article's, a card deck's, or
    // the biggest words on a slide or an infographic), then its place.
    let titled = opts.titleOf?.(p.id);
    if (kind === 'infographic') {
      const size = pageSizeLabel(p);
      const turn = pageHasOrientation(p) && ['a4', 'letter', 'a3'].includes(p.size ?? 'a4');
      line += ` · ${size}${turn ? ` ${p.orientation === 'portrait' ? 'Portrait' : 'Landscape'}` : ''}`;
    } else if (kind === 'slide' && opts.inDeck) {
      line += opts.inDeck(p.id) ? ' · In the deck' : ' · Not in the deck';
      const builds = opts.buildsOf?.(p.id) ?? 0;
      if (builds > 0) line += ` · ${builds} ${builds === 1 ? 'build' : 'builds'}`;
    } else if ((kind === 'article' || kind === 'flashcard') && p.flow) {
      const flow = opts.articles?.[p.flow];
      const title = flow ? articleTitleOf(flow).trim() : '';
      // A real title names the row (articleOwnTitle, as the page's label does), and is said again on
      // the line only when the page has a name of its own; an untitled article keeps its place's name.
      const own = articleOwnTitle(flow);
      titled = own;
      if (title && (p.name?.trim() || !own)) line += ` · ${title}`;
      // A card says how long it takes to say (docs/specs/007-editor/flashcards.md "Card number and
      // speaking time").
      speakingTime =
        kind === 'flashcard' && flow ? speakingTimeLabel(flashcardSpeakingSeconds(flow)) : null;
      if (speakingTime) line += ` · ${speakingTime}`;
    }
    return {
      id: p.id,
      number: i + 1,
      name: p.name?.trim() || titled || `${kind === 'flashcard' ? 'Card' : 'Page'} ${i + 1}`,
      line,
      locked: p.locked === true,
      aspect: p.rect.width / p.rect.height,
      kind,
      ...(kind === 'slide' && opts.inDeck ? { inDeck: opts.inDeck(p.id) } : {}),
      // A page (any kind) whose slide the deck skips when presenting: set aside under a Hidden veil.
      ...(opts.hiddenInSlides?.(p.id) ? { setAside: HIDDEN_IN_SLIDES } : {}),
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
