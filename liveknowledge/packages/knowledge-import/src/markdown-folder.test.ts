import { describe, expect, it } from 'vitest';
import { archiveOf } from './__fixtures__/archive';
import { planImport } from './plan';

const tree = (plan: Awaited<ReturnType<typeof planImport>>) =>
  plan.pages.map((page) => [page.key, page.title, page.parentKey]);

describe('Markdown Folder', () => {
  const handbook = () =>
    archiveOf({
      'docs/README.md': [
        '# Handbook',
        '',
        'Welcome. See [Setup](guides/setup.md), [[Deploy]] and [gone](missing.md).',
        '![Logo](img/logo.png) and again ![Logo](img/logo.png)',
      ].join('\n'),
      'docs/guides/setup.md': [
        '# Setup',
        '',
        'Back to [home](../README.md#top). [Spec](../files/spec.pdf) ![Shot](../img/missing.png)',
        '[ext](https://example.com) [js](javascript:alert(1)) [[Handbook|the start]] [[Nowhere]]',
        '![far](https://example.com/a.png) ![doc](../files/spec.pdf) [up](../../../etc/passwd)',
      ].join('\n'),
      'docs/guides/deploy.md': 'No heading here.',
      'docs/guides/advanced/tips.md': '# Tips',
      'docs/img/logo.png': 5,
      'docs/files/spec.pdf': 9,
      'docs/notes.txt': 'not a page',
    });

  it('takes a file beside a folder of its name as that folder’s page, as an export writes one', async () => {
    const plan = await planImport(
      'markdown-folder',
      archiveOf({
        'deploys.md': '# Deploys\n\nSee [rollbacks](deploys/rollbacks.md).',
        'deploys/rollbacks.md': '# Rollbacks\n\nBack to [deploys](../deploys.md).',
        'deploys/rollbacks/Steps.md': '# Steps',
        'holidays.md': '# Holidays',
        // A folder with a page of its own keeps it: the file beside it is a page like any other.
        'guides.md': '# Guides (beside)',
        'guides/README.md': '# Guides',
        'guides/setup.md': '# Setup',
      }),
    );
    expect(tree(plan)).toEqual([
      ['p1', 'Deploys', null],
      ['p2', 'Rollbacks', 'p1'],
      ['p3', 'Steps', 'p2'],
      ['p4', 'Guides (beside)', null],
      ['p5', 'Guides', null],
      ['p6', 'Setup', 'p5'],
      ['p7', 'Holidays', null],
    ]);
    expect(plan.pages[0]!.links).toEqual([{ target: 'p2', text: 'rollbacks' }]);
    expect(plan.pages[1]!.links).toEqual([{ target: 'p1', text: 'deploys' }]);
  });

  it('makes the tree from the folders, a README its folder’s own page', async () => {
    const plan = await planImport('markdown-folder', handbook());
    expect(tree(plan)).toEqual([
      ['p1', 'Handbook', null],
      ['p2', 'guides', 'p1'],
      ['p3', 'advanced', 'p2'],
      ['p4', 'Tips', 'p3'],
      ['p5', 'deploy', 'p2'],
      ['p6', 'Setup', 'p2'],
    ]);
    expect(plan.summary).toEqual({
      source: 'markdown-folder',
      pages: 6,
      pictures: 1,
      attachments: 1,
      skipped: [],
      ignoredFiles: 1,
      blocked: null,
    });
  });

  it('turns relative links and [[Title]] into page links, and leaves the rest as links', async () => {
    const plan = await planImport('markdown-folder', handbook());
    const [home, , , , , setup] = plan.pages;
    expect(home!.markdown).toBe(
      [
        'Welcome. See [Setup](knowledgebase-page:p6), [Deploy](knowledgebase-page:p5) and [gone](missing.md).',
        '![Logo](knowledgebase-picture:0) and again ![Logo](knowledgebase-picture:0)',
      ].join('\n'),
    );
    expect(home!.links).toEqual([
      { target: 'p6', text: 'Setup' },
      { target: 'p5', text: 'Deploy' },
    ]);
    expect(setup!.markdown).toBe(
      [
        'Back to [home](knowledgebase-page:p1). Spec Shot',
        '[ext](https://example.com) js [the start](knowledgebase-page:p1) [[Nowhere]]',
        '![far](https://example.com/a.png) doc [up](../../../etc/passwd)',
        '',
        '**Attachments**',
        '',
        '- spec.pdf',
      ].join('\n'),
    );
    expect(setup!.attachments).toEqual(['spec.pdf']);
    expect(setup!.warnings).toEqual([
      { kind: 'missing-picture', detail: '../img/missing.png' },
      { kind: 'unsafe-link', detail: 'js' },
    ]);
  });

  it('collects pictures without reading them, until the plan’s reader asks', async () => {
    const archive = handbook();
    const plan = await planImport('markdown-folder', archive);
    expect(archive.reads.filter((path) => !path.endsWith('.md'))).toEqual([]);
    const [logo] = plan.pages[0]!.pictures;
    expect(logo).toMatchObject({ path: 'docs/img/logo.png', alt: 'Logo', size: 5 });
    expect((await logo!.read()).byteLength).toBe(5);
    expect(archive.reads.at(-1)).toBe('docs/img/logo.png');
  });

  it('drops folders that only wrap the archive, and reads index.md, front matter and a late heading', async () => {
    const plan = await planImport(
      'markdown-folder',
      archiveOf({
        'vault/a.md': 'Alpha',
        'vault/sub/index.md': 'The folder page',
        'vault/sub/b.markdown': '---\ntitle: ignored\n---\nIntro line\r\n\r\n# Late Title ##\nBody',
        'vault/sub/c.md': '```\n# not a title\n```\n\n# Real Title\n\nText',
      }),
    );
    expect(tree(plan)).toEqual([
      ['p1', 'a', null],
      ['p2', 'sub', null],
      ['p3', 'Late Title', 'p2'],
      ['p4', 'Real Title', 'p2'],
    ]);
    expect(plan.pages[2]!.markdown).toBe('Intro line\n\n# Late Title ##\nBody');
    expect(plan.pages[3]!.markdown).toBe('```\n# not a title\n```\n\n# Real Title\n\nText');
  });

  it('lists the top folder’s own page first, beside its siblings', async () => {
    const plan = await planImport(
      'markdown-folder',
      archiveOf({ 'alpha.md': '# Alpha', 'README.md': 'Start', 'one/two/deep.md': '# Deep' }),
    );
    expect(tree(plan)).toEqual([
      ['p1', 'README', null],
      ['p2', 'Alpha', null],
      ['p3', 'one', null],
      ['p4', 'two', 'p3'],
      ['p5', 'Deep', 'p4'],
    ]);
  });

  it('answers an empty plan for an archive with no pages', async () => {
    const plan = await planImport('markdown-folder', archiveOf({ 'a.png': 1 }));
    expect(plan.pages).toEqual([]);
    expect(plan.summary).toMatchObject({ pages: 0, ignoredFiles: 1, blocked: null });
  });

  it('keeps both pages of one title, and [[Title]] finds the first in tree order', async () => {
    const plan = await planImport(
      'markdown-folder',
      archiveOf({
        'a/notes.md': '# Notes\n\nFirst.',
        'b/notes.md': '# Notes\n\nSecond, see [[notes]] and [[Notes#part]].',
      }),
    );
    expect(tree(plan)).toEqual([
      ['p1', 'a', null],
      ['p2', 'Notes', 'p1'],
      ['p3', 'b', null],
      ['p4', 'Notes', 'p3'],
    ]);
    expect(plan.pages[3]!.markdown).toBe(
      'Second, see [notes](knowledgebase-page:p2) and [Notes](knowledgebase-page:p2).',
    );
    expect(plan.pages[1]!.warnings).toEqual([]);
    expect(plan.pages[3]!.warnings).toEqual([
      { kind: 'duplicate-title', detail: 'Another page has this title.' },
    ]);
  });

  it('finds a page by its file name when no title matches', async () => {
    const plan = await planImport(
      'markdown-folder',
      archiveOf({ 'release-notes.md': '# What Changed', 'b.md': 'See [[release-notes]].' }),
    );
    expect(plan.pages[0]!.markdown).toBe('See [release-notes](knowledgebase-page:p2).');
  });
});
