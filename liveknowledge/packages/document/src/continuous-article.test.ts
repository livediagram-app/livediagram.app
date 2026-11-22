import { describe, expect, it } from 'vitest';
import { withArticleContinuous } from './continuous-article';
import { articlesOf } from './article-flow';
import { pagesOf } from './page';
import { CONTINUOUS_PAGE_MIN_HEIGHT, CONTINUOUS_PAGE_WIDTH, isContinuousPage } from './page-sizes';
import { migrateIncomingTab, migrateStoredTab } from './stored-tab';
import type { Tab } from './index';

// docs/specs/030-knowledgebase/page-surface.md "No paper, no canvas": an article that arrives on paper sheets (a
// Word import, a livedocuments file, an agent's write) is shown on the continuous page, never on sheets.
const para = (id: string, text: string) => ({ id, type: 'paragraph', runs: [{ text }] });
const sheet = (id: string, extra: object = {}) => ({
  id,
  orientation: 'portrait',
  size: 'a4',
  kind: 'article',
  flow: 'art-1',
  ...extra,
});
const onPaper = (sheets = 3, blocks = 60) =>
  ({
    id: 't1',
    name: 'Release Process',
    elements: [],
    pages: Array.from({ length: sheets }, (_, i) => sheet(`p${i + 1}`)),
    articles: {
      'art-1': {
        blocks: Array.from({ length: blocks }, (_, i) =>
          para(
            `b${i}`,
            `Paragraph ${i}: every change is reviewed by one other person and passes the checks.`,
          ),
        ),
      },
    },
  }) as unknown as Tab;

describe('an article on paper sheets', () => {
  it('becomes one continuous page, the first sheet’s id kept and every block of the writing with it', () => {
    const tab = onPaper();
    const out = withArticleContinuous(tab);
    const pages = pagesOf(out);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.id).toBe('p1');
    expect(isContinuousPage(pages[0]!)).toBe(true);
    expect(pages[0]!.fit!.width).toBe(CONTINUOUS_PAGE_WIDTH);
    expect(articlesOf(out)['art-1']!.blocks).toHaveLength(60);
    // The stored tab is not touched.
    expect((tab.pages as unknown[]).length).toBe(3);
  });

  it('is as tall as its writing is estimated to need: taller for more of it, the least for an empty page', () => {
    const short = pagesOf(withArticleContinuous(onPaper(1, 1)))[0]!.fit!.height;
    const long = pagesOf(withArticleContinuous(onPaper(3, 200)))[0]!.fit!.height;
    expect(short).toBeGreaterThanOrEqual(CONTINUOUS_PAGE_MIN_HEIGHT);
    expect(long).toBeGreaterThan(short * 5);
  });

  it('converts a landscape or Letter sheet the same, and one sheet alone', () => {
    for (const extra of [{ size: 'letter' }, { orientation: 'landscape' }, { size: 'a3' }]) {
      const tab = { ...onPaper(1, 4), pages: [sheet('p1', extra)] } as unknown as Tab;
      const page = pagesOf(withArticleContinuous(tab))[0]!;
      expect(isContinuousPage(page)).toBe(true);
      expect(page.orientation).toBe('portrait');
    }
  });

  it('is converted wherever a tab is settled on its way in: a stored read, an api write, a file', () => {
    for (const out of [migrateStoredTab(onPaper()), migrateIncomingTab(onPaper()) as Tab]) {
      expect(pagesOf(out)).toHaveLength(1);
      expect(isContinuousPage(pagesOf(out)[0]!)).toBe(true);
    }
    // Settled once, it stays as it is: the same tab back.
    const settled = migrateStoredTab(onPaper());
    expect(migrateStoredTab(settled)).toBe(settled);
    expect(withArticleContinuous(settled)).toBe(settled);
  });

  it('leaves alone what is not one article’s pages', () => {
    const none = { id: 't', name: 'T', elements: [] } as unknown as Tab;
    expect(withArticleContinuous(none)).toBe(none);
    const slides = {
      ...onPaper(1),
      pages: [{ id: 's1', orientation: 'landscape', size: 'slide', kind: 'slide' }],
    } as unknown as Tab;
    expect(withArticleContinuous(slides)).toBe(slides);
    const two = {
      ...onPaper(2),
      pages: [sheet('p1'), sheet('p2', { flow: 'art-2' })],
    } as unknown as Tab;
    expect(withArticleContinuous(two)).toBe(two);
    const odd = { ...onPaper(1), pages: ['nonsense'] } as unknown as Tab;
    expect(withArticleContinuous(odd)).toBe(odd);
  });
});
