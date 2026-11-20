import { describe, expect, it } from 'vitest';
import { withoutPageLooks } from './page-looks';
import { migrateIncomingTab, migrateStoredTab } from './stored-tab';
import { articlesOf } from './article-flow';
import { pagesOf } from './page';
import type { Tab } from './index';

// docs/specs/030-knowledgebase/page-surface.md "What a page no longer has": a page stored with its own background,
// style or lock is shown in the knowledgebase's style; the stored fields are ignored and dropped on the next save.
const imported = () =>
  ({
    id: 't1',
    name: 'Release Process',
    elements: [],
    locked: true,
    pages: [
      {
        id: 'p1',
        orientation: 'portrait',
        size: 'fit',
        fit: { width: 856, height: 1400 },
        kind: 'article',
        flow: 'art-1',
        locked: true,
        background: { fill: { kind: 'solid', color: '#0f172a' }, pattern: 'lines' },
      },
    ],
    articles: {
      'art-1': {
        blocks: [{ id: 'b1', type: 'paragraph', runs: [{ text: 'Ship on Tuesdays.' }] }],
        style: { look: 'notebook', accent: '#ff0000', textSize: 'large', margins: 'wide' },
      },
    },
  }) as unknown as Tab;

describe('withoutPageLooks', () => {
  it('drops a page’s background and lock, the tab’s lock and the article’s own style', () => {
    const tab = withoutPageLooks(imported());
    expect(tab.locked).toBeUndefined();
    const [page] = pagesOf(tab);
    expect(page!.background).toBeUndefined();
    expect(page!.locked).toBeUndefined();
    expect(articlesOf(tab)['art-1']!.style).toBeUndefined();
  });

  it('keeps everything else: the page, its height, its flow and every block', () => {
    const tab = withoutPageLooks(imported());
    const [page] = pagesOf(tab);
    expect(page).toMatchObject({ id: 'p1', kind: 'article', flow: 'art-1', size: 'fit' });
    expect(page!.fit).toEqual({ width: 856, height: 1400 });
    expect(articlesOf(tab)['art-1']!.blocks).toHaveLength(1);
    expect(tab.name).toBe('Release Process');
  });

  it('answers the same tab when it carries none of them, so nothing re-renders or re-saves', () => {
    const clean = withoutPageLooks(imported());
    expect(withoutPageLooks(clean)).toBe(clean);
    const plain = { id: 't', name: 'T', elements: [] } as unknown as Tab;
    expect(withoutPageLooks(plain)).toBe(plain);
  });

  it('leaves a page of another kind as it was stored', () => {
    const slide = {
      id: 't',
      name: 'T',
      elements: [],
      pages: [{ id: 's1', orientation: 'landscape', kind: 'slide', locked: true }],
    } as unknown as Tab;
    expect(withoutPageLooks(slide)).toBe(slide);
  });

  it('never throws on a malformed tab', () => {
    for (const bad of [
      { pages: 'x', articles: 4 },
      { pages: [null, 3], articles: { a: null } },
    ])
      expect(() => withoutPageLooks(bad)).not.toThrow();
  });

  it('runs wherever a stored or an incoming tab is settled', () => {
    for (const tab of [migrateStoredTab(imported()), migrateIncomingTab(imported()) as Tab]) {
      expect(tab.locked).toBeUndefined();
      expect(pagesOf(tab)[0]!.background).toBeUndefined();
      expect(pagesOf(tab)[0]!.locked).toBeUndefined();
      expect(articlesOf(tab)['art-1']!.style).toBeUndefined();
    }
  });
});
