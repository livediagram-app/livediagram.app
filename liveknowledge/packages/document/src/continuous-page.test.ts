// docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The continuous page".
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';
import type { ArticleBlock } from './article-flow';
import { estimateArticle } from './article-layout-estimate';
import { withPageKindChosen } from './article-pages';
import { withArticleHeightEstimated } from './continuous-page-estimate';
import {
  continuousPage,
  KNOWLEDGEBASE_FLOW,
  knowledgebasePage,
  newKnowledgebasePageContent,
  withArticlePageHeight,
} from './knowledgebase-page';
import { asViewPage, layOutPages, pageSizeChoices, pageSizesFor, pagesOf } from './page';
import {
  CONTINUOUS_PAGE_MAX_HEIGHT,
  CONTINUOUS_PAGE_MIN_HEIGHT,
  CONTINUOUS_PAGE_WIDTH,
  continuousPageHeight,
  isContinuousPage,
  pageDimensions,
  pageHasOrientation,
} from './page-sizes';
import type { Tab } from './tab-type';

const para = (id: string, text: string): ArticleBlock => ({
  id,
  type: 'paragraph',
  runs: [{ text }],
});

const pageTab = (blocks: ArticleBlock[]): Tab => ({
  id: 't',
  name: 'Start Here',
  elements: [],
  pages: [knowledgebasePage()],
  articles: { [KNOWLEDGEBASE_FLOW]: { blocks } },
});

describe('the continuous size', () => {
  it('is an article page in the fit size: 856 wide, as tall as its writing', () => {
    const page = knowledgebasePage();
    expect(isContinuousPage(page)).toBe(true);
    expect(pageDimensions(page)).toEqual({
      width: CONTINUOUS_PAGE_WIDTH,
      height: CONTINUOUS_PAGE_MIN_HEIGHT,
    });
    expect(CONTINUOUS_PAGE_WIDTH).toBe(856);
    expect(isContinuousPage({ kind: 'article' })).toBe(false);
    expect(isContinuousPage({ kind: 'infographic', size: 'fit' })).toBe(false);
  });

  it('is read at the continuous width as stored, and at its own sides only as one window draws it', () => {
    const narrow = { ...knowledgebasePage(), fit: { width: 446, height: 3000 } };
    // Stored (or written by anyone) narrower: read back at the continuous width.
    expect(pagesOf({ pages: [narrow] })[0]!.fit).toEqual({
      width: CONTINUOUS_PAGE_WIDTH,
      height: 3000,
    });
    // The narrow view's own page object (docs/specs/030-knowledgebase/blueprints/page-surface.md "The narrow view").
    const drawn = asViewPage({ ...narrow });
    expect(pagesOf({ pages: [drawn] })[0]!.fit).toEqual({ width: 446, height: 3000 });
    expect(layOutPages(pagesOf({ pages: [drawn] }))[0]!.rect).toMatchObject({
      x: -223,
      width: 446,
    });
    // Its copy, as a store or the sync would hold it, is a stored page again.
    expect(pagesOf({ pages: [JSON.parse(JSON.stringify(drawn))] })[0]!.fit!.width).toBe(856);
  });

  it('holds a height to whole px within its limits', () => {
    expect(continuousPageHeight(2000.2)).toBe(2001);
    expect(continuousPageHeight(10)).toBe(CONTINUOUS_PAGE_MIN_HEIGHT);
    expect(continuousPageHeight(1e12)).toBe(CONTINUOUS_PAGE_MAX_HEIGHT);
    expect(continuousPageHeight(Number.NaN)).toBe(CONTINUOUS_PAGE_MIN_HEIGHT);
    expect(continuousPageHeight(Infinity)).toBe(CONTINUOUS_PAGE_MIN_HEIGHT);
  });

  it('offers no paper size and no turn', () => {
    expect(pageSizesFor('article')).toEqual([]);
    expect(pageSizeChoices(knowledgebasePage())).toEqual(['fit']);
    expect(pageHasOrientation(knowledgebasePage())).toBe(false);
  });

  it('makes any page a continuous page, keeping the height it had as one', () => {
    const made = continuousPage({ id: 'p', orientation: 'landscape', size: 'a3', kind: 'article' });
    expect(made).toMatchObject({
      orientation: 'portrait',
      size: 'fit',
      fit: { width: 856, height: CONTINUOUS_PAGE_MIN_HEIGHT },
    });
    const tall = continuousPage({ ...made, fit: { width: 856, height: 5000 } });
    expect(tall.fit).toEqual({ width: 856, height: 5000 });
  });
});

describe('a stored continuous page', () => {
  const stored = (fit: unknown) =>
    pagesOf({
      pages: [{ id: 'p', orientation: 'portrait', size: 'fit', fit, kind: 'article', flow: 'f' }],
    })[0]!;

  it('reads its height, taller than Fit to Content allows an infographic', () => {
    expect(stored({ width: 856, height: 64000 }).fit).toEqual({ width: 856, height: 64000 });
  });

  it('is always the continuous width, and the least height when none is readable', () => {
    expect(stored({ width: 300, height: 3000.4 }).fit).toEqual({ width: 856, height: 3001 });
    expect(stored(undefined).fit).toEqual({ width: 856, height: CONTINUOUS_PAGE_MIN_HEIGHT });
    expect(stored({ width: 856, height: 'tall' }).fit).toEqual({
      width: 856,
      height: CONTINUOUS_PAGE_MIN_HEIGHT,
    });
    expect(stored({ width: 856, height: 1e12 }).fit!.height).toBe(CONTINUOUS_PAGE_MAX_HEIGHT);
  });

  it('keeps Fit to Content on an infographic page as it was', () => {
    const page = pagesOf({
      pages: [{ id: 'p', orientation: 'portrait', size: 'fit', fit: { width: 400, height: 300 } }],
    })[0]!;
    expect(page.fit).toEqual({ width: 400, height: 300 });
  });
});

describe('where a continuous page sits', () => {
  it('keeps its top where it is as it grows and shrinks', () => {
    const short = layOutPages(pagesOf(pageTab([])))[0]!.rect;
    const grown = withArticlePageHeight(pageTab([]), KNOWLEDGEBASE_FLOW, 9000);
    const tall = layOutPages(pagesOf(grown))[0]!.rect;
    expect(tall.height).toBe(9000);
    expect(tall.y).toBe(short.y);
    expect(tall.x).toBe(short.x);
    // On the row's axis, whatever its height.
    expect(short.y).toBe(0);
  });
});

describe('withArticlePageHeight', () => {
  it('grows and shrinks the one page, never adding another', () => {
    const tab = pageTab([]);
    const grown = withArticlePageHeight(tab, KNOWLEDGEBASE_FLOW, 4321.5);
    expect(pagesOf(grown)).toHaveLength(1);
    expect(pagesOf(grown)[0]!.fit).toEqual({ width: 856, height: 4322 });
    const shrunk = withArticlePageHeight(grown, KNOWLEDGEBASE_FLOW, 2000);
    expect(pagesOf(shrunk)[0]!.fit!.height).toBe(2000);
    // Never under the least height.
    expect(pagesOf(withArticlePageHeight(shrunk, KNOWLEDGEBASE_FLOW, 5))[0]!.fit!.height).toBe(
      CONTINUOUS_PAGE_MIN_HEIGHT,
    );
  });

  it('writes nothing when the height is unchanged', () => {
    const tab = withArticlePageHeight(pageTab([]), KNOWLEDGEBASE_FLOW, 3000);
    expect(withArticlePageHeight(tab, KNOWLEDGEBASE_FLOW, 3000)).toBe(tab);
    expect(withArticlePageHeight(tab, KNOWLEDGEBASE_FLOW, 2999.4)).toBe(tab);
    // A new page is already at the least height.
    const fresh = pageTab([]);
    expect(withArticlePageHeight(fresh, KNOWLEDGEBASE_FLOW, 100)).toBe(fresh);
  });

  it('leaves a tab without that article, or on paper pages, as it is', () => {
    const tab = pageTab([]);
    expect(withArticlePageHeight(tab, 'nope', 3000)).toBe(tab);
    const paper: Tab = {
      ...tab,
      pages: [{ id: 'p', orientation: 'portrait', kind: 'article', flow: KNOWLEDGEBASE_FLOW }],
    };
    expect(withArticlePageHeight(paper, KNOWLEDGEBASE_FLOW, 3000)).toBe(paper);
  });
});

describe('an article chosen for a page', () => {
  it('is written on the continuous page, whatever size the page was', () => {
    const chosen = withPageKindChosen(
      {
        elements: [],
        pages: [{ id: 'p', orientation: 'landscape' as const, size: 'a3' as const }],
      },
      'p',
      'article',
      'f',
    )!;
    expect(chosen.pages).toHaveLength(1);
    expect(isContinuousPage(chosen.pages[0]!)).toBe(true);
    expect(chosen.pages[0]).toMatchObject({ orientation: 'portrait', flow: 'f' });
  });
});

describe('a continuous page laid out without a browser', () => {
  it('is one page however long the writing, with the height it needs', () => {
    const blocks = Array.from({ length: 400 }, (_, i) =>
      para(`b${i}`, 'A paragraph long enough to wrap onto a second line of the reading width. '),
    );
    const tab = pageTab([
      ...blocks,
      { id: 'br', type: 'pageBreak' },
      para('last', 'After a break.'),
    ]);
    const laid = layOutPages(pagesOf(tab));
    const est = estimateArticle(tab, KNOWLEDGEBASE_FLOW, laid, '#000000');
    expect(est.pagesUsed).toBe(1);
    expect(est.added).toEqual([]);
    expect(est.overflows).toBe(false);
    expect(est.height).toBeGreaterThan(CONTINUOUS_PAGE_MIN_HEIGHT);
    // Every line is drawn on the one page.
    expect([...est.ops.keys()]).toEqual([laid[0]!.id]);
  });

  it('gives a paper article no height', () => {
    const tab: Tab = {
      ...pageTab([para('a', 'Hello')]),
      pages: [{ id: 'p', orientation: 'portrait', kind: 'article', flow: KNOWLEDGEBASE_FLOW }],
    };
    const est = estimateArticle(tab, KNOWLEDGEBASE_FLOW, layOutPages(pagesOf(tab)), '#000000');
    expect(est.height).toBeUndefined();
  });

  it('sizes the page to the estimate, and leaves any other tab alone', () => {
    const blocks = Array.from({ length: 300 }, (_, i) => para(`b${i}`, 'One line of writing.'));
    const tab = pageTab(blocks);
    const sized = withArticleHeightEstimated(tab, KNOWLEDGEBASE_FLOW);
    expect(pagesOf(sized)[0]!.fit!.height).toBeGreaterThan(CONTINUOUS_PAGE_MIN_HEIGHT);
    expect(withArticleHeightEstimated(sized, KNOWLEDGEBASE_FLOW)).toBe(sized);
    expect(withArticleHeightEstimated(tab, 'nope')).toBe(tab);
    const short = { elements: [], ...newKnowledgebasePageContent() };
    expect(withArticleHeightEstimated(short, KNOWLEDGEBASE_FLOW)).toBe(short);
  });

  // The budget: a 100,000 character article is one page (30,720 px tall in the 760 px column), laid out in about
  // 33 ms of CPU cold on a laptop (measured 2026-11-20, three runs); the budget is generous so a loaded CI machine
  // never flakes.
  it('lays a 100,000 character article out as one page within its CPU budget', () => {
    const sentence =
      'Knowledge is only useful when the people who need it can find it and trust it. ';
    const perBlock = 1000;
    const text = sentence.repeat(Math.ceil(perBlock / sentence.length)).slice(0, perBlock);
    const blocks = Array.from({ length: 100 }, (_, i) => para(`b${i}`, text));
    expect(
      blocks.reduce((n, b) => n + (b.type === 'paragraph' ? b.runs[0]!.text.length : 0), 0),
    ).toBe(100_000);
    const tab = pageTab(blocks);
    const laid = layOutPages(pagesOf(tab));
    const start = cpuNowMs();
    const est = estimateArticle(tab, KNOWLEDGEBASE_FLOW, laid, '#000000');
    const sized = withArticleHeightEstimated(tab, KNOWLEDGEBASE_FLOW);
    const spent = cpuNowMs() - start;
    expect(est.pagesUsed).toBe(1);
    expect(est.overflows).toBe(false);
    expect(pagesOf(sized)).toHaveLength(1);
    expect(pagesOf(sized)[0]!.fit!.height).toBe(est.height);
    // Taller than the 19,200 px Fit to Content allows an infographic page: the continuous page has its own limit.
    expect(est.height!).toBeGreaterThan(19_200);
    expect(spent).toBeLessThan(cpuBudgetMs(250));
  });
});
