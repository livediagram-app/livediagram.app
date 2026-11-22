import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import { archiveOf } from './__fixtures__/archive';
import { ImportSizeError } from './archive';
import { MAX_ARCHIVE_BYTES, MAX_IMPORT_PAGES, MAX_PICTURE_BYTES } from './limits';
import { planImport } from './plan';

const pages = (count: number, body = (_: number) => 'Text') =>
  Object.fromEntries(
    Array.from({ length: count }, (_, i) => [`p${i}.md`, `# Page ${i}\n\n${body(i)}`]),
  );

describe('the bounds of an import', () => {
  it('refuses an archive file past 200 MB before opening it', async () => {
    const archive = archiveOf({ 'a.md': '# A' });
    const plan = await planImport('markdown-folder', archive, {
      archiveBytes: MAX_ARCHIVE_BYTES + 1,
    });
    expect(plan.pages).toEqual([]);
    expect(plan.summary.blocked).toEqual({
      reason: 'archive-too-large',
      limitBytes: MAX_ARCHIVE_BYTES,
    });
    expect(archive.reads).toEqual([]);
  });

  it('refuses an archive that unpacks past the limit, without reading a file', async () => {
    const archive = archiveOf({ 'a.md': 60, 'b.png': 60 });
    const plan = await planImport('markdown-folder', archive, { limits: { archiveBytes: 100 } });
    expect(plan.summary.blocked).toEqual({ reason: 'archive-too-large', limitBytes: 100 });
    expect(archive.reads).toEqual([]);
  });

  it('stops at more than 500 pages with a clear summary, before reading any', async () => {
    const archive = archiveOf(pages(MAX_IMPORT_PAGES + 1));
    const plan = await planImport('markdown-folder', archive);
    expect(plan.pages).toEqual([]);
    expect(plan.summary).toMatchObject({
      pages: 0,
      blocked: { reason: 'too-many-pages', found: 501, room: 500 },
    });
    expect(archive.reads).toEqual([]);
  });

  it('counts the pages the knowledgebase already holds', async () => {
    const full = await planImport('markdown-folder', archiveOf(pages(3)), { existingPages: 498 });
    expect(full.summary.blocked).toEqual({ reason: 'too-many-pages', found: 3, room: 2 });
    const over = await planImport('markdown-folder', archiveOf(pages(1)), { existingPages: 900 });
    expect(over.summary.blocked).toEqual({ reason: 'too-many-pages', found: 1, room: 0 });
    const fits = await planImport('markdown-folder', archiveOf(pages(2)), { existingPages: 498 });
    expect(fits.summary).toMatchObject({ pages: 2, blocked: null });
  });

  it('counts the pages folders make too', async () => {
    const plan = await planImport(
      'markdown-folder',
      archiveOf({ 'a/one.md': 'One', 'b/two.md': 'Two' }),
      { limits: { pages: 3 } },
    );
    expect(plan.summary.blocked).toEqual({ reason: 'too-many-pages', found: 4, room: 3 });
  });

  it('flattens levels deeper than 8 under level 8, and warns', async () => {
    // Each level's page beside the folder of the next (`l1.md`, `l1/l2.md`), as an export writes a tree.
    const path = (depth: number) =>
      `${Array.from({ length: depth }, (_, i) => `l${i + 1}`).join('/')}.md`;
    const files = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [path(i + 1), `# Level ${i + 1}`]),
    );
    const plan = await planImport('markdown-folder', archiveOf(files));
    expect(plan.pages.map((page) => [page.title, page.parentKey])).toEqual([
      ['Level 1', null],
      ['Level 2', 'p1'],
      ['Level 3', 'p2'],
      ['Level 4', 'p3'],
      ['Level 5', 'p4'],
      ['Level 6', 'p5'],
      ['Level 7', 'p6'],
      ['Level 8', 'p7'],
      ['Level 9', 'p7'],
      ['Level 10', 'p7'],
    ]);
    expect(plan.pages[7]!.warnings).toEqual([]);
    expect(plan.pages[9]!.warnings).toEqual([
      { kind: 'flattened', detail: 'Moved up: a knowledgebase goes 8 levels deep.' },
    ]);
  });

  it('leaves fewer levels when the import lands under a page', async () => {
    const plan = await planImport(
      'markdown-folder',
      archiveOf({ 'a.md': '# A', 'a/b.md': '# B', 'a/b/c.md': '# C' }),
      { parentDepth: 6 },
    );
    expect(plan.pages.map((page) => [page.title, page.parentKey])).toEqual([
      ['A', null],
      ['B', 'p1'],
      ['C', 'p1'],
    ]);
    const deepest = await planImport(
      'markdown-folder',
      archiveOf({ 'a.md': '# A', 'a/b.md': '# B' }),
      { parentDepth: 8 },
    );
    expect(deepest.pages.map((page) => page.parentKey)).toEqual([null, null]);
  });

  it('leaves out a picture past 10 MB, by its declared size or when it is read', async () => {
    const archive = archiveOf({
      'a.md': '![Big](big.png) ![Sly](sly.png) ![Fine](fine.png)',
      'big.png': MAX_PICTURE_BYTES + 1,
      'sly.png': MAX_PICTURE_BYTES + 1,
      'fine.png': 8,
    });
    // An archive that does not say how large its files are.
    delete archive.find((entry) => entry.path === 'sly.png')!.size;
    const plan = await planImport('markdown-folder', archive);
    const [page] = plan.pages;
    expect(page!.markdown).toBe(
      'Big ![Sly](knowledgebase-picture:0) ![Fine](knowledgebase-picture:1)',
    );
    expect(page!.warnings).toEqual([{ kind: 'picture-too-large', detail: 'big.png' }]);
    expect(plan.summary.skipped).toEqual([
      { path: 'big.png', reason: 'picture-too-large', detail: 'The picture is larger than 10 MB.' },
    ]);
    await expect(page!.pictures[0]!.read()).rejects.toThrow(ImportSizeError);
    expect((await page!.pictures[1]!.read()).byteLength).toBe(8);
  });

  it('reports a page that fails by name, and keeps the rest', async () => {
    const archive = archiveOf({
      'good.md': '# Good\n\nSee [bad](bad.md).',
      'bad.md': '# Bad',
      'huge.md': 300,
    });
    archive[1]!.read = async () => {
      throw new Error('broken');
    };
    const plan = await planImport('markdown-folder', archive, { limits: { pageSourceBytes: 200 } });
    expect(plan.pages.map((page) => page.title)).toEqual(['Good']);
    expect(plan.pages[0]!.markdown).toBe('See [bad](bad.md).');
    expect(plan.summary.skipped).toEqual([
      { path: 'bad.md', reason: 'page-failed', detail: 'The page could not be read.' },
      { path: 'huge.md', reason: 'page-too-large', detail: 'The page is too large to import.' },
    ]);
  });

  it('never leaves the archive: a path that climbs out is skipped, and a link that does stays a link', async () => {
    const plan = await planImport(
      'markdown-folder',
      archiveOf({
        '../outside.md': '# Outside',
        'a.md': '[up](../outside.md) ![up](../../secret.png) [abs](/a.md)',
      }),
    );
    expect(plan.pages.map((page) => page.title)).toEqual(['a']);
    expect(plan.pages[0]!.markdown).toBe('[up](../outside.md) up [abs](knowledgebase-page:p1)');
    expect(plan.summary.skipped).toMatchObject([
      { path: '../outside.md', reason: 'outside-archive' },
    ]);
  });

  // The worst case the limits allow: every page links to 50 others. One lookup a link, so the plan is linear in
  // the archive's size; a rescan of the pages for each link would be 12.5 million page reads.
  it('plans 500 pages that each link to 50 others within its CPU budget', async () => {
    const files = pages(MAX_IMPORT_PAGES, (i) =>
      Array.from({ length: 50 }, (_, j) => {
        const to = (i + j * 7 + 1) % MAX_IMPORT_PAGES;
        return j % 2 === 0 ? `[Page ${to}](p${to}.md)` : `[[Page ${to}]]`;
      }).join(' and '),
    );
    let plan: Awaited<ReturnType<typeof planImport>> | undefined;
    const spent = await cpuMsOfAsync(async () => {
      plan = await planImport('markdown-folder', archiveOf(files));
    });
    expect(plan!.pages).toHaveLength(500);
    expect(plan!.pages.every((page) => page.links.length === 50)).toBe(true);
    expect(spent).toBeLessThan(cpuBudgetMs(400));
  });
});
