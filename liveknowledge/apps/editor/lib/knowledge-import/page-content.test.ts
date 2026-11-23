// One planned page as its tab (docs/specs/020-import-export/blueprints/knowledgebase-import.md "A page's tab").

import {
  KNOWLEDGEBASE_FLOW,
  isKnowledgebasePage,
  isValidTab,
  type ArticleBlock,
} from '@liveknowledge/document';
import { isPageLinkRun } from '@liveknowledge/knowledge';
import { describe, expect, it } from 'vitest';
import { importedPageTab, type ImportedPageInput } from './page-content';
import { picture, plannedPage, storedPicture } from './test-plan';

const make = (over: Partial<ImportedPageInput> & { markdown?: string } = {}) => {
  const { markdown, ...rest } = over;
  const made = importedPageTab({
    page: plannedPage('p1', { title: 'Release Process', ...(markdown ? { markdown } : {}) }),
    id: 'tab-1',
    pageIdOf: () => undefined,
    pictures: [],
    ...rest,
  });
  if (!made.ok) throw new Error(made.reason);
  return made.tab;
};
const blocksOf = (tab: ReturnType<typeof make>): ArticleBlock[] =>
  tab.articles![KNOWLEDGEBASE_FLOW]!.blocks;

describe('importedPageTab', () => {
  it('stores a starter page’s icon and cover as the page’s own, and drops what the pickers could not show', () => {
    const dressed = make({ page: plannedPage('p1', { icon: 'rocket', cover: 'theme-glow' }) });
    expect(dressed.icon).toEqual({ iconId: 'rocket' });
    expect(dressed.cover).toEqual({ gradient: 'theme-glow' });
    expect(isValidTab(dressed)).toBe(true);
    const bad = make({
      page: plannedPage('p1', { icon: 'Not An Id', cover: 'https://x.test/a.png' }),
    });
    expect(bad).not.toHaveProperty('icon');
    expect(bad).not.toHaveProperty('cover');
    const plain = make();
    expect(plain).not.toHaveProperty('icon');
    expect(plain).not.toHaveProperty('cover');
  });

  it('makes a knowledgebase page: one article, its Title the page name, under its parent', () => {
    const tab = make({
      markdown: '## Steps\n\n- One\n- Two',
      parent: 'tab-0',
      seed: { backgroundColor: '#fafafa' },
    });
    expect(isKnowledgebasePage(tab)).toBe(true);
    expect(isValidTab(tab)).toBe(true);
    expect(tab).toMatchObject({
      id: 'tab-1',
      name: 'Release Process',
      parent: 'tab-0',
      backgroundColor: '#fafafa',
    });
    const blocks = blocksOf(tab);
    expect(blocks[0]).toMatchObject({
      type: 'paragraph',
      style: 'title',
      runs: [{ text: 'Release Process' }],
    });
    expect(blocks.slice(1).map((b) => b.type)).toEqual(['paragraph', 'list', 'list']);
    // No knowledge fields: never verified, no owner.
    expect(tab.knowledge).toBeUndefined();
  });

  it('gives a page with no writing a paragraph to write in, and an untitled one a name', () => {
    const made = importedPageTab({
      page: plannedPage('p1', { title: '  ', markdown: '' }),
      id: 'tab-1',
      pageIdOf: () => undefined,
      pictures: [],
    });
    expect(made.ok && made.tab.name).toBe('Untitled Page');
    expect(made.ok && blocksOf(made.tab).map((b) => b.type)).toEqual(['paragraph', 'paragraph']);
  });

  it('turns a page link into a page-link run, in a paragraph, a list and a table', () => {
    const tab = make({
      markdown:
        'See [A](knowledgebase-page:p2).\n\n- [B](knowledgebase-page:p3)\n\n| T |\n| --- |\n| [C](knowledgebase-page:p2) |',
      pageIdOf: (key) => ({ p2: 'tab-2', p3: 'tab-3' })[key],
    });
    const runs = blocksOf(tab).flatMap((b) =>
      b.type === 'table' ? b.rows.flatMap((r) => r.cells.flat()) : 'runs' in b ? b.runs : [],
    );
    expect(runs.filter(isPageLinkRun).map((r) => [r.text, r.page])).toEqual([
      ['A', 'tab-2'],
      ['B', 'tab-3'],
      ['C', 'tab-2'],
    ]);
    expect(runs.some((r) => r.href)).toBe(false);
  });

  it('keeps an ordinary link, and the plan scheme written inside code', () => {
    const tab = make({
      markdown:
        '[Site](https://example.com)\n\n```\n[x](knowledgebase-page:p2)\n![y](knowledgebase-picture:0)\n```',
      pageIdOf: () => 'tab-2',
    });
    const [, para, code] = blocksOf(tab);
    expect(para).toMatchObject({ runs: [{ text: 'Site', href: 'https://example.com' }] });
    expect(code).toMatchObject({ type: 'code' });
    expect(JSON.stringify(code)).toContain('knowledgebase-picture:0');
    expect(tab.elements).toEqual([]);
  });

  it('places a stored picture as a parked zone holding its image, where the writing has it', () => {
    const tab = make({
      page: plannedPage('p1', {
        markdown: 'Before\n\n![Diagram](knowledgebase-picture:0)\n\nAfter',
        pictures: [picture('img/d.png')],
      }),
      pictures: [storedPicture('img-1')],
    });
    const blocks = blocksOf(tab);
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'paragraph', 'zone', 'paragraph']);
    const zone = blocks[2] as Extract<ArticleBlock, { type: 'zone' }>;
    expect(zone).toMatchObject({ zone: 'object', width: 400, height: 300, at: { page: 'page-1' } });
    expect(tab.elements).toHaveLength(1);
    expect(tab.elements[0]).toMatchObject({
      type: 'image',
      imageId: 'img-1',
      alt: 'Diagram',
      width: 400,
    });
    expect(isValidTab(tab)).toBe(true);
  });

  it('moves a picture written inside other writing to after its block, once per place it is shown', () => {
    const tab = make({
      page: plannedPage('p1', {
        markdown:
          '- Step ![Shot](knowledgebase-picture:0) here\n- Next ![Shot](knowledgebase-picture:0)\n\nEnd',
        pictures: [picture('img/s.png')],
      }),
      pictures: [storedPicture('img-1')],
    });
    expect(blocksOf(tab).map((b) => b.type)).toEqual([
      'paragraph',
      'list',
      'list',
      'zone',
      'zone',
      'paragraph',
    ]);
    expect(tab.elements).toHaveLength(2);
    expect(new Set(blocksOf(tab).map((b) => b.id)).size).toBe(6);
  });

  it('keeps the description of a picture that was not stored, and makes no zone', () => {
    const tab = make({
      page: plannedPage('p1', {
        markdown: 'Look: ![The old logo](knowledgebase-picture:0)',
        pictures: [picture('img/l.png')],
      }),
      pictures: [{ ok: false, failure: 'upload-failed' }],
    });
    expect(blocksOf(tab).map((b) => b.type)).toEqual(['paragraph', 'paragraph']);
    expect(JSON.stringify(blocksOf(tab)[1])).toContain('Look: The old logo');
    expect(tab.elements).toEqual([]);
  });

  it('reads a line the source wrote as a zone line as its words', () => {
    const tab = make({ markdown: '[zone abc]' });
    expect(JSON.stringify(blocksOf(tab)[1])).toContain('[zone abc]');
  });

  it('refuses writing longer than a page takes, by reason', () => {
    const page = (markdown: string) =>
      importedPageTab({
        page: plannedPage('p1', { markdown }),
        id: 't',
        pageIdOf: () => undefined,
        pictures: [],
      });
    expect(page('x'.repeat(400_001))).toMatchObject({
      ok: false,
      reason: expect.stringContaining('longer'),
    });
    expect(page('y'.repeat(30_000))).toEqual({
      ok: false,
      reason: 'One of its paragraphs is longer than a page takes.',
    });
    expect(page(Array.from({ length: 5001 }, (_, i) => `Line ${i}`).join('\n\n'))).toMatchObject({
      ok: false,
      reason: expect.stringContaining('blocks'),
    });
  });
});
