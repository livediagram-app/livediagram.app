import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  createSticky,
  layOutPages,
  MAX_PAGES,
  type ArticleBlock,
  type Element,
  type Page,
  type Tab,
} from '@livedocuments/document';
import { findMatches } from './find-matches';
import { replaceInTab } from './find-replace';
import { findTargets } from './find-targets';
import { DEFAULT_FIND_OPTIONS } from './find-text';

// docs/specs/007-editor/find-and-replace.md "Performance": a 100-page article (MAX_PAGES) with elements on every
// page is gathered and searched well inside a frame's work, and Replace All over it stays a fraction of a second.
// A page of writing is ~30 paragraphs of ~100 characters (about 3,000 characters, a full A4 page), so the tab holds
// ~300,000 characters of writing and 1,000 elements.
const PARAGRAPHS_A_PAGE = 30;
const ELEMENTS_A_PAGE = 10;
const LINE =
  'The quarterly plan covers revenue, hiring and the roadmap for every team in the company.  ';

function hundredPageArticle(): Tab {
  const pages = Array.from(
    { length: MAX_PAGES },
    (_, i) => ({ id: `p${i}`, orientation: 'portrait', kind: 'article', flow: 'f' }) satisfies Page,
  );
  const rows = layOutPages(pages);
  const blocks: ArticleBlock[] = [];
  for (let i = 0; i < MAX_PAGES * PARAGRAPHS_A_PAGE; i++)
    blocks.push({
      id: `b${i}`,
      type: 'paragraph',
      runs: [{ text: LINE }, { text: `${i}`, b: true }],
    });
  const elements: Element[] = [];
  for (const row of rows)
    for (let k = 0; k < ELEMENTS_A_PAGE; k++)
      elements.push({
        ...createSticky(row.rect.x + 40 + k * 20, row.rect.y + 100 + k * 60),
        id: `${row.id}-s${k}`,
        label: 'Plan the launch with the team',
      });
  return { id: 't', name: 'Big', pages, articles: { f: { blocks } }, elements };
}

describe('find and replace on a 100-page article', () => {
  const tab = hundredPageArticle();
  const rows = layOutPages(tab.pages!);

  it('gathers and searches the tab inside the budget', () => {
    let count = 0;
    const ms = cpuMsOf(() => {
      const targets = findTargets(tab, rows, { scope: 'any' });
      count = findMatches(targets, 'plan', DEFAULT_FIND_OPTIONS).matches.length;
    });
    // 3,000 paragraphs and 1,000 stickies, one "plan" each.
    expect(count).toBe(MAX_PAGES * (PARAGRAPHS_A_PAGE + ELEMENTS_A_PAGE));
    expect(ms).toBeLessThan(cpuBudgetMs(80));
  });

  it('searches a query that matches nothing as fast', () => {
    const targets = findTargets(tab, rows, { scope: 'any' });
    const ms = cpuMsOf(() =>
      findMatches(targets, 'zebra crossing', { matchCase: false, wholeWord: true }),
    );
    expect(ms).toBeLessThan(cpuBudgetMs(40));
  });

  it('replaces all of them as one new tab inside the budget', () => {
    const targets = findTargets(tab, rows, { scope: 'any' });
    const { matches } = findMatches(
      targets,
      'plan',
      DEFAULT_FIND_OPTIONS,
      Number.POSITIVE_INFINITY,
    );
    let replaced = 0;
    const ms = cpuMsOf(() => {
      replaced = replaceInTab(tab, targets, matches, 'scheme').count;
    });
    expect(replaced).toBe(matches.length);
    expect(ms).toBeLessThan(cpuBudgetMs(120));
  });
});
