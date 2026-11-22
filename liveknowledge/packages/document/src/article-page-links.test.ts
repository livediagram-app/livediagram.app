import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';
import { parseArticleFlow, type ArticleBlock, type ArticleRun } from './article-flow';
import { articleFromMarkdown, articleToMarkdown } from './article-markdown-io';
import {
  pageByTitleIn,
  pageFilePaths,
  pageLinkMarkdown,
  pageTitleIn,
  relativePagePath,
  withPageLinkTitles,
  withPageLinksAsFiles,
  withPageLinksResolved,
} from './article-page-links';

// docs/specs/030-knowledgebase/links-and-embeds.md "Page links".
const PAGES = [
  { id: 'runbooks', name: 'Runbooks' },
  { id: 'deploys', name: 'Deploys', parent: 'runbooks' },
  { id: 'guides', name: 'Guides' },
  { id: 'setup', name: 'Setup', parent: 'guides' },
  { id: 'setup2', name: 'Setup', parent: 'guides' },
];

// A run as a test writes it: `page` is not one of ArticleRun's own keys (ArticlePageLinkRun).
type TestRun = ArticleRun | (ArticleRun & { page: unknown });
const para = (runs: TestRun[], id = 'b1'): ArticleBlock => ({
  id,
  type: 'paragraph',
  runs: runs as unknown as ArticleRun[],
});
const blocksOf = (markdown: string) =>
  (articleFromMarkdown(markdown) as { blocks: ArticleBlock[] }).blocks;

describe('a page link in storage', () => {
  it('keeps the page a run links to, and reads a run with both as a page link', () => {
    const flow = parseArticleFlow({
      blocks: [
        para([
          { text: 'See ' },
          { text: 'Deploys', page: 'deploys', href: 'https://example.com', b: true },
        ]),
      ],
    });
    expect((flow.blocks[0] as { runs: ArticleRun[] }).runs).toEqual([
      { text: 'See ' },
      { text: 'Deploys', page: 'deploys', b: true },
    ]);
  });

  it('drops a page that is no id, and keeps two links to different pages apart', () => {
    const flow = parseArticleFlow({
      blocks: [
        para([
          { text: 'a', page: '' },
          { text: 'b', page: 'x'.repeat(65) },
          { text: 'c', page: 7 },
          { text: 'd', page: 'p1' },
          { text: 'e', page: 'p2' },
          { text: 'f', page: 'p2' },
        ]),
      ],
    });
    expect((flow.blocks[0] as { runs: ArticleRun[] }).runs).toEqual([
      { text: 'abc' },
      { text: 'd', page: 'p1' },
      { text: 'ef', page: 'p2' },
    ]);
  });
});

describe('a page link in Markdown', () => {
  it('is written [[Title]], with the brackets of a title read as spaces', () => {
    expect(pageLinkMarkdown('Deploys')).toBe('[[Deploys]]');
    expect(pageLinkMarkdown('A [draft]\nplan')).toBe('[[A  draft  plan]]');
    const flow = {
      blocks: [para([{ text: 'See ' }, { text: 'Deploys', page: 'deploys', b: true }])],
    };
    expect(articleToMarkdown(flow).trim()).toBe('See [[Deploys]]');
  });

  it('shows the current title, and Deleted Page for a page that is gone', () => {
    const flow = {
      blocks: [
        para([{ text: 'Old Name', page: 'deploys' }, { text: 'x', page: 'gone' }, { text: 'y' }]),
      ],
    };
    const titled = withPageLinkTitles(flow, pageTitleIn(PAGES));
    expect((titled.blocks[0] as { runs: ArticleRun[] }).runs).toEqual([
      { text: 'Deploys', page: 'deploys' },
      { text: 'Deleted Page', page: 'gone' },
      { text: 'y' },
    ]);
    // Nothing to change: the same block back.
    expect(withPageLinkTitles(titled, pageTitleIn(PAGES)).blocks[0]).toBe(titled.blocks[0]);
  });

  it('resolves [[Title]] to the first page of that title in tree order, any letter case', () => {
    const blocks = withPageLinksResolved(
      blocksOf('Read [[ deploys ]] then **[[Setup]]** and [[Nowhere]].'),
      pageByTitleIn(PAGES),
    );
    expect((blocks[0] as { runs: ArticleRun[] }).runs).toEqual([
      { text: 'Read ' },
      { text: 'deploys', page: 'deploys' },
      { text: ' then ' },
      { text: 'Setup', page: 'setup', b: true },
      { text: ' and [[Nowhere]].' },
    ]);
  });

  it('leaves code, links and a title of brackets alone, and reads table cells and lists', () => {
    const blocks = withPageLinksResolved(
      blocksOf(
        [
          '`[[Deploys]]` [[]] [[a[b]]',
          '',
          '- [[Guides]]',
          '',
          '| A |',
          '| --- |',
          '| [[Runbooks]] |',
        ].join('\n'),
      ),
      pageByTitleIn(PAGES),
    );
    const linked = JSON.stringify(blocks).match(/"page":"[a-z0-9]+"/g);
    expect(linked).toEqual(['"page":"guides"', '"page":"runbooks"']);
    // Text that already links somewhere, and a footnote's, stay as they are.
    const held = [
      para([
        { text: '[[Deploys]]', href: 'https://example.com' },
        { text: '[[Deploys]]', fn: 'note' },
      ]),
    ];
    expect(withPageLinksResolved(held, pageByTitleIn(PAGES))[0]).toBe(held[0]);
  });

  it('comes back as the same link after a round trip', () => {
    const flow = {
      blocks: [para([{ text: 'See ' }, { text: 'Deploys', page: 'deploys' }, { text: '.' }])],
    };
    const back = withPageLinksResolved(blocksOf(articleToMarkdown(flow)), pageByTitleIn(PAGES));
    expect((back[0] as { runs: ArticleRun[] }).runs).toEqual(
      (flow.blocks[0] as { runs: ArticleRun[] }).runs,
    );
  });

  it('reads a long line of brackets in linear time', () => {
    const blocks = [para([{ text: '[['.repeat(100_000) }])];
    const t0 = cpuNowMs();
    withPageLinksResolved(blocks, () => undefined);
    expect(cpuNowMs() - t0).toBeLessThan(cpuBudgetMs(100));
  });
});

describe('a Markdown export to files', () => {
  it('gives each page a file under its parents, two of one title numbered', () => {
    expect([...pageFilePaths(PAGES)]).toEqual([
      ['runbooks', 'runbooks.md'],
      ['deploys', 'runbooks/deploys.md'],
      ['guides', 'guides.md'],
      ['setup', 'guides/setup.md'],
      ['setup2', 'guides/setup-2.md'],
    ]);
    expect(pageFilePaths([{ id: 'a', name: '!!!' }]).get('a')).toBe('page.md');
  });

  it('writes the path from one file to another', () => {
    expect(relativePagePath('runbooks/deploys.md', 'guides/setup.md')).toBe('../guides/setup.md');
    expect(relativePagePath('runbooks.md', 'runbooks/deploys.md')).toBe('runbooks/deploys.md');
    expect(relativePagePath('guides/setup.md', 'guides/setup-2.md')).toBe('setup-2.md');
    expect(relativePagePath('a/b/c.md', 'a/d.md')).toBe('../d.md');
  });

  it('writes a page link as [Title](relative/path.md), and plain text for a page with no file', () => {
    const paths = pageFilePaths(PAGES);
    const flow = {
      blocks: [
        para([
          { text: 'Deploys', page: 'deploys' },
          { text: ' and ' },
          { text: 'Gone', page: 'gone' },
        ]),
      ],
    };
    const out = withPageLinksAsFiles(flow, (tab) => {
      const to = paths.get(tab);
      return to && relativePagePath(paths.get('setup')!, to);
    });
    expect(articleToMarkdown(out).trim()).toBe('[Deploys](../runbooks/deploys.md) and Gone');
  });
});
