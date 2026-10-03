// Margin notes (docs/specs/007-editor/article-pages.md "Comments and actions"): a comment thread
// or an action on a stretch of an article's writing lives on a marker element (an annotation) in
// the page's right margin, level with the first line of that text, and is kept there as the
// writing moves (the text carries a `note` mark naming the marker). Everything a comment or an
// action does on an element (threads, mentions, assignees, Activity, email) it does here, because
// the marker is an element. Pure: the writing is measured by the editor, settled here.
import { articleMarginPx } from './article-style';
import { articlesOf, normaliseRuns } from './article-flow';
import { withArticleFlow } from './article-pages';
import { illustratePagesOf, layOutIllustratePages, type LaidOutPage } from './illustrate-page';
import type { AnnotationElement, Element, Tab } from './index';

/** A margin note's marker size, canvas px: small enough for the narrowest margin (48 px). */
export const ARTICLE_NOTE_SIZE = 32;
/** The room between margin notes stacked down a page's margin, canvas px. */
export const ARTICLE_NOTE_GAP = 6;

export type ArticleNoteKind = 'comment' | 'action';

/** Where a note's text was laid out: its page (by index among the article's pages), and its first
 *  line's top and height from that page's corner, in canvas px. */
export type ArticleNotePlace = { id: string; index: number; y: number; height: number };

/** The marker's corner for a note whose first line is at `place` on `page`: centred in the page's
 *  right margin, level with the line. */
export function articleNoteCorner(
  page: LaidOutPage,
  margin: number,
  place: Pick<ArticleNotePlace, 'y' | 'height'>,
): { x: number; y: number } {
  const half = ARTICLE_NOTE_SIZE / 2;
  return {
    x: Math.round(page.rect.x + page.rect.width - margin / 2 - half),
    y: Math.round(page.rect.y + place.y + place.height / 2 - half),
  };
}

/** A new note's marker, at its place. */
export function newArticleNote(
  id: string,
  kind: ArticleNoteKind,
  corner: { x: number; y: number },
): AnnotationElement {
  return {
    id,
    type: 'annotation',
    x: corner.x,
    y: corner.y,
    width: ARTICLE_NOTE_SIZE,
    height: ARTICLE_NOTE_SIZE,
    aspectLocked: true,
    articleNote: kind,
  };
}

type NotesTab = Pick<Tab, 'elements'> & { pages?: unknown; articles?: unknown };

/** The tab with an article's note markers beside their text as laid out now. The same tab back
 *  when none moved; a marker whose text is gone stays where it last was. */
export function withNotesSettled<T extends NotesTab>(
  tab: T,
  flow: string,
  places: readonly ArticleNotePlace[],
): T {
  const doc = articlesOf(tab)[flow];
  if (!doc || places.length === 0) return tab;
  const own = layOutIllustratePages(illustratePagesOf(tab)).filter((p) => p.flow === flow);
  const margin = articleMarginPx(doc.style);
  // In the writing's order, each beside its text; several close together on a page stack down
  // the margin, ARTICLE_NOTE_GAP apart, rather than covering each other.
  const at = new Map<string, { x: number; y: number }>();
  const bottom = new Map<number, number>();
  for (const place of places) {
    const page = own[place.index];
    if (!page || at.has(place.id)) continue;
    const corner = articleNoteCorner(page, margin, place);
    const below = bottom.get(place.index);
    if (below !== undefined && corner.y < below) corner.y = below;
    bottom.set(place.index, corner.y + ARTICLE_NOTE_SIZE + ARTICLE_NOTE_GAP);
    at.set(place.id, corner);
  }
  let moved = false;
  const elements = (tab.elements as Element[]).map((el) => {
    if (el.type !== 'annotation' || !el.articleNote) return el;
    const to = at.get(el.id);
    if (!to || (Math.abs(el.x - to.x) < 0.5 && Math.abs(el.y - to.y) < 0.5)) return el;
    moved = true;
    return { ...el, x: to.x, y: to.y };
  });
  return moved ? { ...tab, elements } : tab;
}

/** The tab with the note marks of markers that are gone (`ids`) taken off every article's text, so
 *  no tint is left pointing at nothing. The same tab back when no text carried them. */
export function withNoteMarksRemoved<T extends NotesTab>(tab: T, ids: ReadonlySet<string>): T {
  if (ids.size === 0) return tab;
  let next = tab;
  for (const [flow, doc] of Object.entries(articlesOf(tab))) {
    let changed = false;
    const blocks = doc.blocks.map((b) => {
      if (!('runs' in b) || !b.runs.some((r) => r.note && ids.has(r.note))) return b;
      changed = true;
      const runs = b.runs.map((r) => {
        if (!r.note || !ids.has(r.note)) return r;
        const { note: _n, nk: _k, ...rest } = r;
        void _n;
        void _k;
        return rest;
      });
      return { ...b, runs: normaliseRuns(runs) };
    });
    if (changed)
      next = withArticleFlow(next, flow, doc.style ? { blocks, style: doc.style } : { blocks });
  }
  return next;
}

/** Every margin note id the writing of `articles` carries. */
export function articleNoteIds(
  articles: Readonly<Record<string, { blocks: readonly unknown[] }>>,
): Set<string> {
  const out = new Set<string>();
  for (const doc of Object.values(articles))
    for (const b of doc.blocks as { runs?: { note?: string }[] }[])
      for (const r of b.runs ?? []) if (r.note) out.add(r.note);
  return out;
}

/** The tab without the markers of margin notes whose text is gone from the writing (`ids`): the
 *  comment thread or action on deleted text goes with it. Markers no longer notes stay. */
export function withNoteMarkersRemoved<T extends NotesTab>(tab: T, ids: ReadonlySet<string>): T {
  if (ids.size === 0) return tab;
  const elements = (tab.elements as Element[]).filter(
    (el) => !(el.type === 'annotation' && el.articleNote && ids.has(el.id)),
  );
  return elements.length === tab.elements.length ? tab : { ...tab, elements };
}
