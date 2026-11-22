import { describe, expect, it } from 'vitest';
import { code, flowOf, para, runsBullet, runsPara, table } from './__fixtures__/writing';
import {
  MAX_PAGE_LINKS,
  MAX_PAGE_LINK_ID,
  PAGE_LINK_KEY,
  backlinks,
  isPageLinkRun,
  isPageLinkTarget,
  pageLinkTargets,
} from './page-links';
import type { ArticleRun } from '@liveknowledge/document';

const link = (text: string, page: unknown) => ({ text, [PAGE_LINK_KEY]: page }) as ArticleRun;

describe('page links', () => {
  it('knows a page link run by its page', () => {
    expect(PAGE_LINK_KEY).toBe('page');
    expect(isPageLinkRun(link('Deploys', 'tab-2'))).toBe(true);
    expect(isPageLinkRun({ text: 'Deploys' })).toBe(false);
    expect(isPageLinkRun(link('Deploys', ''))).toBe(false);
    expect(isPageLinkRun(link('Deploys', 7))).toBe(false);
    expect(isPageLinkTarget('x'.repeat(64))).toBe(true);
    expect(isPageLinkTarget('x'.repeat(65))).toBe(false);
  });

  it('finds each linked page once, in order, in paragraphs, lists and tables', () => {
    const flow = flowOf(
      runsPara([
        { text: 'See ' },
        link('Deploys', 'tab-2'),
        { text: ' and ' },
        link('Support', 'tab-3'),
      ]),
      runsBullet([link('Deploys again', 'tab-2'), link('Billing', 'tab-4')]),
      table([[[link('In a cell', 'tab-5')], [{ text: 'plain' }]]]),
      code('[[tab-9]]'),
      para('No link.'),
    );
    expect(pageLinkTargets(flow)).toEqual(['tab-2', 'tab-3', 'tab-4', 'tab-5']);
    expect(pageLinkTargets(flowOf())).toEqual([]);
  });

  it('stops at the most links a page keeps', () => {
    const runs = Array.from({ length: MAX_PAGE_LINKS + 20 }, (_x, at) => link('x', `tab-${at}`));
    expect(pageLinkTargets(flowOf(runsPara(runs)))).toHaveLength(MAX_PAGE_LINKS);
  });
});

describe('backlinks', () => {
  it('lists the linking pages in tree order, without the page itself or pages gone from the tree', () => {
    expect(
      backlinks('tab-1', ['tab-4', 'tab-1', 'tab-2', 'gone'], ['tab-1', 'tab-2', 'tab-3', 'tab-4']),
    ).toEqual(['tab-2', 'tab-4']);
    expect(backlinks('tab-1', [], ['tab-1', 'tab-2'])).toEqual([]);
  });
});

// The article model keeps the run's field itself (it cannot import this package, which reads its types): the two
// names for the key and for the id's length are one.
describe('the page link key', () => {
  it('is the one the article model stores', async () => {
    const model = await import('@liveknowledge/document');
    expect(PAGE_LINK_KEY).toBe(model.ARTICLE_PAGE_LINK_KEY);
    expect(MAX_PAGE_LINK_ID).toBe(model.MAX_PAGE_LINK_ID);
    const flow = model.parseArticleFlow({
      blocks: [{ id: 'b1', type: 'paragraph', runs: [{ text: 'Deploys', page: 'deploys' }] }],
    });
    expect(pageLinkTargets(flow)).toEqual(['deploys']);
  });
});
