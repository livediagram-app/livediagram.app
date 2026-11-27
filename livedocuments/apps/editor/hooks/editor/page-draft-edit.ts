// Describe a Page's edit (docs/specs/007-editor/describe-a-page.md "The dialog"; blueprint "The edit"): the page the
// api drafted, made as Add Page makes the next page (like the last, right after the page here, on its background),
// then laid out and written through the engine an agent's edits run on (@livedocuments/edit-operations): change_pages'
// "layout" op for a slide or an infographic page, write_article for an article or a card. Pure: the tab in, the tab
// out, so the editor commits it as one edit (one undo). The engine is loaded by the dialog, never with the editor.
import {
  MAX_PAGES,
  nextArticleFlowId,
  nextPageId,
  pageAddedLike,
  pageKindOf,
  pagesOf,
  type Tab,
} from '@livedocuments/document';
import type { PageDraft } from '@livedocuments/api-schema';
import type {
  applyArticleWrite,
  applyPageChanges,
  markDropped,
  withoutDroppedSlots,
} from '@livedocuments/edit-operations/pages';

// The longest a page's name is kept, from its heading.
const NAME_MAX = 80;

/** The engine's edits the page is made through, and its marking of the slots the words leave empty. */
export type DraftEngine = {
  applyPageChanges: typeof applyPageChanges;
  applyArticleWrite: typeof applyArticleWrite;
  markDropped: typeof markDropped;
  withoutDroppedSlots: typeof withoutDroppedSlots;
};

/** The page made: the tab with it, its id, and its writing's flow for an article or a card. */
export type DraftedPage = { tab: Tab; pageId: string; flow: string | null };

const writes = (kind: string) => kind === 'article' || kind === 'flashcard';

/** The tab with the drafted page added after `after` (else after the last), like `sourceId` (else the last page):
 *  null when it cannot be (the page limit, a tab of another kind now, a refusal of the engine's). */
export function withDraftedPage(
  tab: Tab,
  draft: PageDraft,
  engine: DraftEngine,
  opts: { sourceId?: string; after?: string; themed?: (tab: Tab, pageId: string) => Tab },
): DraftedPage | null {
  const pages = pagesOf(tab);
  const source = pages.find((p) => p.id === opts.sourceId) ?? pages.at(-1);
  if (!source || pages.length >= MAX_PAGES) return null;
  // The tab's kind changed while the words were drafted (the last page went, a first page chose another kind).
  if ((draft.kind === 'writing') !== writes(pageKindOf(source))) return null;
  const pageId = nextPageId(pages);
  const flow = nextArticleFlowId(new Set(pages.flatMap((p) => (p.flow ? [p.flow] : []))));
  const added = pageAddedLike(tab, source.id, pageId, flow, opts.after);
  if (!('tab' in added)) return null;
  const next = opts.themed ? opts.themed(added.tab, pageId) : added.tab;
  if (draft.kind === 'layout') {
    // Slots the words leave empty are marked, written in, then taken off with their boxes (the engine's
    // dropped-slots.ts).
    const out = engine.applyPageChanges(next, [
      { op: 'layout', page: pageId, layout: draft.layout, text: engine.markDropped(draft.text) },
    ]);
    if ('refusal' in out) return null;
    const tidied = engine.withoutDroppedSlots(out.tab);
    // Contents names the page by its heading, not by whichever text is largest (a card's big figure).
    const name = draft.name?.trim().slice(0, NAME_MAX);
    const named = name
      ? { ...tidied, pages: pagesOf(tidied).map((p) => (p.id === pageId ? { ...p, name } : p)) }
      : tidied;
    return { tab: named, pageId, flow: null };
  }
  const out = engine.applyArticleWrite(next, {
    article: flow,
    markdown: draft.markdown,
    mode: 'replace',
  });
  return 'refusal' in out ? null : { tab: out.tab, pageId, flow };
}
