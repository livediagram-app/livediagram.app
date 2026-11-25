// docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Pages stored at the first width" (Work Tracker 1418).
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';
import type { ArticleBlock, ArticleZoneBlock } from './article-flow';
import { estimateArticle } from './article-layout-estimate';
import { newArticleNote } from './article-notes';
import { withContinuousPageWidth } from './continuous-page-width';
import { KNOWLEDGEBASE_FLOW, knowledgebasePage } from './knowledgebase-page';
import { layOutPages, pagesOf, type Page } from './page';
import {
  CONTINUOUS_PAGE_LEFT,
  CONTINUOUS_PAGE_MIN_HEIGHT,
  CONTINUOUS_PAGE_WIDTH,
} from './page-sizes';
import { migrateStoredTab } from './stored-tab';
import type { Element } from './index';
import type { Tab } from './tab-type';

const FIRST_WIDTH = 856;
const DELTA = CONTINUOUS_PAGE_WIDTH - FIRST_WIDTH;

const para = (id: string, text: string): ArticleBlock => ({
  id,
  type: 'paragraph',
  runs: [{ text }],
});
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i % 9}`).join(' ');

const firstWidthPage = (height: number): Page => ({
  ...knowledgebasePage(),
  fit: { width: FIRST_WIDTH, height },
});

const tabOf = (blocks: ArticleBlock[], height: number, elements: Element[] = []): Tab => ({
  id: 't',
  name: 'A page',
  elements,
  pages: [firstWidthPage(height)],
  articles: { [KNOWLEDGEBASE_FLOW]: { blocks } },
});

const zone = (
  id: string,
  x: number,
  y: number,
  more: Partial<ArticleZoneBlock> = {},
): ArticleBlock => ({
  id,
  type: 'zone',
  zone: 'object',
  width: 300,
  height: 200,
  at: { page: knowledgebasePage().id, x, y },
  ...more,
});

const box = (id: string, x: number, y: number) =>
  ({ id, type: 'shape', shape: 'square', x, y, width: 40, height: 40 }) as Element & {
    x: number;
    y: number;
  };

// The page's left edge on the canvas: the same at either width.
const LEFT = -CONTINUOUS_PAGE_LEFT;

describe('a continuous page stored at the first width', () => {
  it('stands with its left edge where it stood, so the wider page grows to the right', () => {
    const now = layOutPages(pagesOf({ pages: [knowledgebasePage()] }))[0]!.rect;
    expect(now).toMatchObject({ x: LEFT, width: CONTINUOUS_PAGE_WIDTH });
    // Where the 856 px page stood when it was centred on the row's anchor.
    expect(LEFT).toBe(-FIRST_WIDTH / 2);
    // A row anchor moves it with the anchor; a paper page is still centred on it.
    const anchored = layOutPages([{ ...knowledgebasePage(), rowAt: { x: 1000, y: 50 } }])[0]!.rect;
    expect(anchored).toMatchObject({ x: 1000 + LEFT, y: 50 });
    const paper = layOutPages([{ id: 'p', orientation: 'portrait' }])[0]!.rect;
    expect(paper.x).toBe(-paper.width / 2);
  });

  it('is read at the continuous width, shorter by what its writing loses to the wider column', () => {
    const blocks = Array.from({ length: 60 }, (_, i) => para(`b${i}`, words(120)));
    const stored = 9000;
    const tab = tabOf(blocks, stored);
    const read = withContinuousPageWidth(tab);
    const fit = read.pages![0]!.fit!;
    expect(fit.width).toBe(CONTINUOUS_PAGE_WIDTH);
    // Exactly the estimator's difference, moved from the settled stored height.
    const laidNow = layOutPages(pagesOf(read))[0]!;
    const laidWas = { ...laidNow, rect: { ...laidNow.rect, width: FIRST_WIDTH } };
    const before = estimateArticle(tab, KNOWLEDGEBASE_FLOW, [laidWas], '#000000').height!;
    const after = estimateArticle(tab, KNOWLEDGEBASE_FLOW, [laidNow], '#000000').height!;
    expect(after).toBeLessThan(before);
    expect(fit.height).toBe(Math.ceil(stored + after - before));
    // The page's other fields are kept.
    expect(read.pages![0]).toMatchObject({ id: tab.pages![0]!.id, kind: 'article', size: 'fit' });
  });

  it('never reads a height under the least', () => {
    const blocks = Array.from({ length: 40 }, (_, i) => para(`b${i}`, words(80)));
    const read = withContinuousPageWidth(tabOf(blocks, CONTINUOUS_PAGE_MIN_HEIGHT));
    expect(read.pages![0]!.fit!.height).toBe(CONTINUOUS_PAGE_MIN_HEIGHT);
  });

  it('moves each zone across by its alignment and down by its estimated top, its elements with it', () => {
    const intro = Array.from({ length: 12 }, (_, i) => para(`b${i}`, words(100)));
    // Each zone where an 856 px page laid it out: the 760 px column starts 48 px in.
    const centred = zone('zc', 48 + 230, 1200);
    const right = zone('zr', 48 + 460, 1500, { wrap: 'right' });
    const left = zone('zl', 48, 1800, { align: 'left' });
    const top = 0;
    const inCentred = box('ic', LEFT + 278 + 100, top + 1200 + 50);
    const inRight = box('ir', LEFT + 508 + 100, top + 1500 + 50);
    const inLeft = box('il', LEFT + 48 + 100, top + 1800 + 50);
    const loose = box('loose', LEFT + 20, top + 20);
    const tab = tabOf(
      [...intro, centred, para('m1', words(40)), right, para('m2', words(40)), left],
      4000,
      [inCentred, inRight, inLeft, loose],
    );
    const read = withContinuousPageWidth(tab);
    const blocks = read.articles![KNOWLEDGEBASE_FLOW]!.blocks;
    const at = (id: string) => (blocks.find((b) => b.id === id) as ArticleZoneBlock).at!;
    const el = (id: string) =>
      read.elements.find((e) => e.id === id) as Element & { x: number; y: number };
    expect(at('zc').x).toBe(278 + DELTA / 2);
    expect(at('zr').x).toBe(508 + DELTA);
    expect(at('zl').x).toBe(48);
    // The writing above wraps shorter in the wider column: every zone moves up, by a whole px.
    for (const id of ['zc', 'zr', 'zl']) {
      expect(at(id).y).toBeLessThan(
        (tab.articles![KNOWLEDGEBASE_FLOW]!.blocks.find((b) => b.id === id) as ArticleZoneBlock).at!
          .y,
      );
      expect(Number.isInteger(at(id).y)).toBe(true);
    }
    // Each zone's element moves exactly as its zone did; an element in no zone stays.
    expect(el('ic').x - inCentred.x).toBe(DELTA / 2);
    expect(el('ic').y - (inCentred as { y: number }).y).toBe(at('zc').y - 1200);
    expect(el('ir').x - inRight.x).toBe(DELTA);
    expect(el('ir').y - (inRight as { y: number }).y).toBe(at('zr').y - 1500);
    expect(el('il').x).toBe(inLeft.x);
    expect(el('loose')).toBe(loose);
  });

  it('moves the margin notes out to the new right margin, and nothing else across', () => {
    const oldRight = LEFT + FIRST_WIDTH;
    // Centred in the 48 px right margin of the 856 px page, as articleNoteCorner put it.
    const note = newArticleNote('n1', 'comment', { x: oldRight - 24 - 16, y: 300 });
    const inText = newArticleNote('n2', 'comment', { x: LEFT + 400, y: 300 });
    const read = withContinuousPageWidth(tabOf([para('a', words(30))], 600, [note, inText]));
    const moved = read.elements.find((e) => e.id === 'n1') as Element & { x: number; y: number };
    expect(moved.x).toBe(LEFT + CONTINUOUS_PAGE_WIDTH - 24 - 16);
    expect(moved.y).toBe(300);
    expect(read.elements.find((e) => e.id === 'n2')).toBe(inText);
  });

  it('widens a page whose writing is missing, keeping its height', () => {
    const tab: Tab = { ...tabOf([], 1200), articles: {} };
    const read = withContinuousPageWidth(tab);
    expect(read.pages![0]!.fit).toEqual({ width: CONTINUOUS_PAGE_WIDTH, height: 1200 });
    expect(read.elements).toBe(tab.elements);
  });

  it('hands back any other tab as the same object', () => {
    const now: Tab = { ...tabOf([para('a', 'Hi')], 600), pages: [knowledgebasePage()] };
    expect(withContinuousPageWidth(now)).toBe(now);
    const none = { elements: [] };
    expect(withContinuousPageWidth(none)).toBe(none);
    const two = { ...now, pages: [firstWidthPage(600), { ...firstWidthPage(600), id: 'p2' }] };
    expect(withContinuousPageWidth(two)).toBe(two);
    const paper = {
      ...now,
      pages: [{ id: 'p', orientation: 'portrait', kind: 'article', flow: 'art-1' }],
    };
    expect(withContinuousPageWidth(paper)).toBe(paper);
    const junk = {
      ...now,
      pages: [{ ...firstWidthPage(600), fit: { width: 'wide', height: 600 } }],
    };
    expect(withContinuousPageWidth(junk)).toBe(junk);
    const noElements = { pages: [firstWidthPage(600)] };
    expect(withContinuousPageWidth(noElements)).toBe(noElements);
    // Read once, it is at the continuous width: a second read changes nothing.
    const once = withContinuousPageWidth(tabOf([para('a', words(400))], 2000));
    expect(withContinuousPageWidth(once)).toBe(once);
  });

  it('is read so wherever a stored tab is settled', () => {
    const stored = JSON.parse(JSON.stringify(tabOf([para('a', words(400))], 2000))) as Tab;
    const read = migrateStoredTab(stored);
    expect(read.pages![0]!.fit!.width).toBe(CONTINUOUS_PAGE_WIDTH);
    expect(read.pages![0]!.fit!.height).toBeLessThan(2000);
  });

  it('reads a 100,000 character page within budget', () => {
    const blocks = Array.from({ length: 100 }, (_, i) => para(`b${i}`, words(166)));
    const tab = tabOf(blocks, 40_000);
    const start = cpuNowMs();
    const read = withContinuousPageWidth(tab);
    const spent = cpuNowMs() - start;
    expect(read.pages![0]!.fit!.width).toBe(CONTINUOUS_PAGE_WIDTH);
    expect(spent).toBeLessThan(cpuBudgetMs(400));
  });
});
