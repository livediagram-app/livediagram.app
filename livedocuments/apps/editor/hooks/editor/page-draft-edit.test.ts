import { describe, expect, it, vi } from 'vitest';
import {
  articlesOf,
  articleTitleOf,
  elementsOnPage,
  layOutPages,
  pagesOf,
  type Tab,
} from '@livedocuments/document';
import * as engine from '@livedocuments/edit-operations/pages';
import type { PageDraft } from '@livedocuments/api-schema';
import { withDraftedPage } from './page-draft-edit';
import { pageEdits } from './page-edits';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/007-editor/describe-a-page.md "The dialog": the drafted page made as Add Page makes the next page, laid
// out and written through the agents' engine, one edit.
const deck = (n = 2): Tab =>
  ({
    id: 't',
    name: 'Deck',
    elements: [],
    pages: Array.from({ length: n }, (_, i) => ({
      id: `page-${i + 1}`,
      kind: 'slide',
      size: 'slide-16x9',
      orientation: 'landscape',
    })),
  }) as unknown as Tab;

const articleTab = (): Tab =>
  ({
    id: 't',
    name: 'Writing',
    elements: [],
    pages: [{ id: 'page-1', kind: 'article', flow: 'flow-a', orientation: 'portrait' }],
    articles: { 'flow-a': { blocks: [{ id: 'b1', type: 'paragraph', runs: [] }] } },
  }) as unknown as Tab;

const slide: PageDraft = {
  kind: 'layout',
  layout: 'agenda',
  label: 'Agenda',
  text: { title: 'Team Offsite' },
};
const labels = (tab: Tab, pageId: string) =>
  elementsOnPage(tab.elements, layOutPages(pagesOf(tab)), pageId).map((el) =>
    'label' in el ? el.label : undefined,
  );

describe('withDraftedPage', () => {
  it('adds a slide right after the page asked, laid out on the layout with its words', () => {
    const made = withDraftedPage(deck(), slide, engine, { after: 'page-1' })!;
    const ids = pagesOf(made.tab).map((p) => p.id);
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe('page-1');
    expect(ids[1]).toBe(made.pageId);
    expect(made.flow).toBeNull();
    expect(labels(made.tab, made.pageId)).toContain('Team Offsite');
  });

  it('after the last page by default, dressed by the editor’s new-page look', () => {
    const themed = vi.fn((t: Tab) => t);
    const made = withDraftedPage(deck(), slide, engine, { themed })!;
    expect(pagesOf(made.tab).at(-1)!.id).toBe(made.pageId);
    expect(themed).toHaveBeenCalledWith(expect.anything(), made.pageId);
  });

  it('writes an article as write_article does, as a new article after the page here', () => {
    const made = withDraftedPage(
      articleTab(),
      { kind: 'writing', markdown: '---\ntitle: Remote Work\n---\n\nWhy it works.' },
      engine,
      {},
    )!;
    expect(made.flow).not.toBeNull();
    expect(articleTitleOf(articlesOf(made.tab)[made.flow!]!)).toBe('Remote Work');
    expect(Object.keys(articlesOf(made.tab))).toHaveLength(2);
  });

  it('makes nothing for a kind the tab no longer holds, a full tab, no page, or a refusal', () => {
    expect(withDraftedPage(articleTab(), slide, engine, {})).toBeNull();
    expect(withDraftedPage(deck(), { kind: 'writing', markdown: 'x' }, engine, {})).toBeNull();
    expect(withDraftedPage(deck(100), slide, engine, {})).toBeNull();
    expect(withDraftedPage({ ...deck(), pages: [] }, slide, engine, {})).not.toBeNull();
    expect(
      withDraftedPage(deck(), { ...slide, layout: 'no-such-layout-at-all' }, engine, {}),
    ).toBeNull();
    expect(
      withDraftedPage(deck(), slide, engine, { sourceId: 'gone', after: 'page-9' }),
    ).not.toBeNull();
    const refused = {
      ...engine,
      applyArticleWrite: () => ({ refusal: { code: 'x', message: 'x' } }),
    };
    expect(
      withDraftedPage(articleTab(), { kind: 'writing', markdown: 'x' }, refused as never, {}),
    ).toBeNull();
  });
});

describe('pageEdits().addDraftedPage', () => {
  function harness(tab: Tab, current: () => string | null = () => null) {
    let tabs = [tab];
    const onGoTo = vi.fn();
    const onLayoutPlaced = vi.fn();
    const onArticleCreated = vi.fn();
    const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
      tabs = map(tabs);
    });
    const edits = (mayEdit = () => true) =>
      pageEdits({
        tabId: tab.id,
        tab: tabs[0]!,
        current: pagesOf(tabs[0]),
        elements: tabs[0]!.elements,
        commitTabs,
        onGoTo,
        onLayoutPlaced,
        onArticleCreated,
        mayEdit,
        currentPage: current,
      });
    return { edits, tab: () => tabs[0]!, commitTabs, onGoTo, onLayoutPlaced, onArticleCreated };
  }

  it('commits the page as one edit after the page here, goes to it and clears the selection', () => {
    const h = harness(deck(3), () => 'page-1');
    expect(h.edits().addDraftedPage!(slide, engine)).toBe(true);
    expect(h.commitTabs).toHaveBeenCalledTimes(1);
    const made = pagesOf(h.tab())[1]!.id;
    expect(h.onGoTo).toHaveBeenCalledWith(made);
    expect(h.onLayoutPlaced).toHaveBeenCalled();
    expect(labels(h.tab(), made)).toContain('Team Offsite');
  });

  it('builds on a tab a peer changed meanwhile', () => {
    const h = harness(deck(2));
    const stale = h.edits();
    h.edits().rename('page-2', 'Peer');
    expect(stale.addDraftedPage!(slide, engine, 'page-2')).toBe(true);
    expect(pagesOf(h.tab()).map((p) => p.name ?? null)).toEqual([null, 'Peer', null]);
  });

  it('puts the caret in a new article, and refuses where it cannot land', () => {
    const h = harness(articleTab());
    expect(h.edits().addDraftedPage!({ kind: 'writing', markdown: 'Hello' }, engine)).toBe(true);
    expect(h.onArticleCreated).toHaveBeenCalledTimes(1);
    expect(h.edits().addDraftedPage!(slide, engine)).toBe(false);
    expect(h.edits(() => false).addDraftedPage!(slide, engine)).toBe(false);
    expect(harness(deck(100)).edits().addDraftedPage).toBeUndefined();
  });
});
