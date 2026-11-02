// A tab to find and replace on, for the find tests: an infographic page with words on it, then a two-page article
// whose blocks and zone hold more (docs/specs/007-editor/find-and-replace.md "What is searched").
import {
  createShape,
  createSticky,
  createTable,
  layOutPages,
  pagesOf,
  type ArticleFlow,
  type Element,
  type Page,
  type Tab,
} from '@livedocuments/document';

export const PAGES: Page[] = [
  { id: 'p1', orientation: 'portrait', kind: 'infographic' },
  { id: 'p2', orientation: 'portrait', kind: 'article', flow: 'f1' },
  { id: 'p3', orientation: 'portrait', kind: 'article', flow: 'f1' },
];

export const ARTICLE: ArticleFlow = {
  blocks: [
    { id: 'title', type: 'paragraph', style: 'title', runs: [{ text: 'The Plan' }] },
    {
      id: 'body',
      type: 'paragraph',
      runs: [{ text: 'Our ' }, { text: 'pl', b: true }, { text: 'an is a plan.' }],
    },
    { id: 'todo', type: 'list', list: 'todo', runs: [{ text: 'plan the plan' }] },
    { id: 'code', type: 'code', text: 'plan()' },
    { id: 'div', type: 'divider' },
  ],
};

export function fixtureTab(
  over: Partial<Tab> = {},
  elements?: (rows: ReturnType<typeof layOutPages>) => Element[],
): Tab {
  const rows = layOutPages(PAGES);
  const p1 = rows[0]!.rect;
  const sticky: Element = {
    ...createSticky(p1.x + 40, p1.y + 300),
    id: 'sticky',
    label: 'Sticky plan',
    richText: [{ text: 'Sticky ' }, { text: 'plan', bold: true }],
  };
  const table: Element = {
    ...createTable(p1.x + 40, p1.y + 500),
    id: 'table',
    cells: [
      ['Plan', 'Owner'],
      ['plan B', 'Sam'],
    ],
  };
  const checklist: Element = {
    ...createShape('checklist', p1.x + 300, p1.y + 500),
    id: 'checklist',
    checklistItems: [{ text: 'Write the plan', done: false }],
  };
  const heading: Element = {
    ...createShape('square', p1.x + 40, p1.y + 40),
    id: 'box',
    label: 'Plan',
    pageTitle: 'A plan title',
  };
  return {
    id: 't1',
    name: 'Tab',
    pages: PAGES,
    articles: { f1: ARTICLE },
    elements: elements ? elements(rows) : [sticky, table, checklist, heading],
    ...over,
  };
}

export const rowsOf = (tab: Tab) => layOutPages(pagesOf(tab));
