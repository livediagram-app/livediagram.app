import { describe, expect, it, vi } from 'vitest';
import { KNOWLEDGEBASE_FLOW, newKnowledgebasePageContent, type Tab } from '@liveknowledge/document';
import { planImport, zipEntries } from '@liveknowledge/knowledge-import';
import { openZip } from '@liveworkspace/office-files/zip';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import {
  buildMarkdownFolder,
  ExportCancelled,
  pictureFileName,
  type FolderPage,
  type MarkdownFolderSource,
} from './markdown-folder';

// Markdown Folder export (docs/specs/020-import-export/knowledgebase-export.md): the zip, and its round trip through
// the app's own Markdown Folder import (knowledgebase-import.md).

const KB = 'kb-1';
const CONTENT = newKnowledgebasePageContent();
const para = (id: string, runs: object[], style?: string) => ({
  id,
  type: 'paragraph',
  ...(style ? { style } : {}),
  runs,
});
const page = (id: string, name: string, blocks: object[], extra: object = {}): Tab =>
  ({
    id,
    name,
    elements: [],
    pages: CONTENT.pages,
    articles: {
      [KNOWLEDGEBASE_FLOW]: { blocks: [para('t', [{ text: name }], 'title'), ...blocks] },
    },
    ...extra,
  }) as unknown as Tab;
const picture = (id: string, imageId: string, alt = '') => ({
  id,
  type: 'image',
  imageId,
  alt,
  x: 0,
  y: 0,
  width: 10,
  height: 10,
});
const PNG = { bytes: new Uint8Array([137, 80, 78, 71]), type: 'image/png' };

const PAGES: FolderPage[] = [
  { id: 'deploys', title: 'Deploys', facts: { owner: 'Ana', updated: Date.UTC(2026, 10, 20) } },
  { id: 'rollbacks', title: 'Rollbacks', parent: 'deploys' },
  { id: 'holidays', title: 'Holidays' },
];
const TABS: Record<string, Tab> = {
  deploys: page('deploys', 'Deploys', [
    para('b', [
      { text: 'See ' },
      { text: 'Rollbacks', page: 'rollbacks' },
      { text: ', [[Holidays]] and ' },
      { text: 'this', href: `https://www.liveknowledge.app/document/${KB}#t=holidays` },
      { text: '.' },
    ]),
  ]),
  rollbacks: page(
    'rollbacks',
    'Rollbacks',
    [para('b', [{ text: 'Back to ' }, { text: 'Deploys', page: 'deploys' }])],
    {
      elements: [picture('i1', 'img_1', 'Channel'), picture('i2', 'img_gone', 'Lost chart')],
      cover: { imageId: 'img_cover' },
    },
  ),
  holidays: page('holidays', 'Holidays', [para('b', [{ text: 'December.' }])], {
    elements: [picture('i1', 'img_1')],
  }),
};

const sourceOf = (over: Partial<MarkdownFolderSource> = {}): MarkdownFolderSource => ({
  documentId: KB,
  pages: PAGES,
  readPage: async (id) => TABS[id] ?? null,
  readPicture: async (id) => (id === 'img_gone' ? null : PNG),
  ...over,
});

const filesOf = async (blob: Blob) => {
  const zip = openZip(new Uint8Array(await blob.arrayBuffer()), { names: 'as-written' });
  const out: Record<string, string> = {};
  for (const entry of zipEntries(zip, 10_000_000)) {
    const bytes = await entry.read();
    out[entry.path] = entry.path.endsWith('.md')
      ? new TextDecoder().decode(bytes)
      : `${bytes.length} bytes`;
  }
  return out;
};

describe('Markdown Folder', () => {
  it('writes a file a page, folders following the tree, pictures once, links relative', async () => {
    const progress: number[] = [];
    const result = await buildMarkdownFolder(sourceOf(), {
      onProgress: (done) => progress.push(done),
    });
    expect(result).toMatchObject({ pages: 3, pictures: 2, missingPictures: 1, missingPages: 0 });
    expect(progress).toEqual([1, 2, 3]);
    const files = await filesOf(result.blob);
    expect(Object.keys(files)).toEqual([
      'deploys.md',
      'pictures/img_cover.png',
      'pictures/img_1.png',
      'deploys/rollbacks.md',
      'holidays.md',
    ]);
    expect(files['deploys.md']).toBe(
      [
        '---',
        'title: "Deploys"',
        'owner: "Ana"',
        'updated: "2026-11-20T00:00:00.000Z"',
        '---',
        '',
        '# Deploys',
        '',
        'See [Rollbacks](deploys/rollbacks.md), [Holidays](holidays.md) and [Holidays](holidays.md).',
        '',
      ].join('\n'),
    );
    expect(files['deploys/rollbacks.md']).toBe(
      [
        '---',
        'title: "Rollbacks"',
        'cover: "../pictures/img_cover.png"',
        '---',
        '',
        '# Rollbacks',
        '',
        'Back to [Deploys](../deploys.md)',
        '',
        '![Channel](../pictures/img_1.png)',
        '',
        '_Lost chart_',
        '',
      ].join('\n'),
    );
  });

  it('imports back through Markdown Folder with its tree, titles, links and pictures intact', async () => {
    const { blob } = await buildMarkdownFolder(sourceOf());
    const zip = openZip(new Uint8Array(await blob.arrayBuffer()), { names: 'as-written' });
    const plan = await planImport('markdown-folder', zipEntries(zip, 10_000_000));
    expect(plan.summary.blocked).toBeNull();
    expect(plan.pages.map((p) => [p.key, p.title, p.parentKey])).toEqual([
      ['p1', 'Deploys', null],
      ['p2', 'Rollbacks', 'p1'],
      ['p3', 'Holidays', null],
    ]);
    expect(plan.pages[0]!.links.map((l) => l.target)).toEqual(['p2', 'p3', 'p3']);
    expect(plan.pages[1]!.links).toEqual([{ target: 'p1', text: 'Deploys' }]);
    expect(plan.pages[1]!.pictures.map((p) => [p.path, p.alt])).toEqual([
      ['pictures/img_1.png', 'Channel'],
      ['pictures/img_cover.png', ''],
    ]);
    // The cover comes back as the page's cover, not as a file left unused.
    expect(plan.pages[1]!.coverPicture).toBe(1);
    expect(plan.summary.ignoredFiles).toBe(0);
    expect(plan.pages.every((p) => p.warnings.length === 0)).toBe(true);
  });

  it('counts a page gone by its turn, and cancels between pages', async () => {
    const gone = await buildMarkdownFolder(
      sourceOf({ readPage: async (id) => (id === 'holidays' ? null : TABS[id]!) }),
    );
    expect(gone).toMatchObject({ pages: 2, missingPages: 1 });
    const controller = new AbortController();
    await expect(
      buildMarkdownFolder(sourceOf(), {
        signal: controller.signal,
        onProgress: () => controller.abort(),
      }),
    ).rejects.toBeInstanceOf(ExportCancelled);
  });

  it('stops on a page that cannot be read, reading at most four ahead', async () => {
    const readPage = vi.fn(async (id: string) => {
      if (id === 'rollbacks') throw new Error('offline');
      return TABS[id]!;
    });
    await expect(buildMarkdownFolder(sourceOf({ readPage }))).rejects.toThrow('offline');
    expect(readPage.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('names a picture by its id, or by its place when the id is a data URL or too long', () => {
    expect(pictureFileName('img_1', 'image/png', 1)).toBe('pictures/img_1.png');
    expect(pictureFileName('a/b c', 'image/jpeg; q=1', 2)).toBe('pictures/a-b-c.jpg');
    expect(pictureFileName('data:image/png;base64,AAAA', 'image/png', 3)).toBe(
      'pictures/picture-3.png',
    );
    expect(pictureFileName('x'.repeat(65), 'image/webp', 4)).toBe('pictures/picture-4.webp');
    expect(pictureFileName('img', 'text/html', 5)).toBeNull();
  });

  it('builds a 500-page knowledgebase with 200 pictures inside its budget', async () => {
    const big = new Uint8Array(200_000);
    const pages: FolderPage[] = [];
    const tabs = new Map<string, Tab>();
    for (let i = 0; i < 500; i++) {
      const id = `p${i}`;
      pages.push({ id, title: `Page ${i}`, ...(i % 5 ? { parent: `p${i - (i % 5)}` } : {}) });
      tabs.set(
        id,
        page(
          id,
          `Page ${i}`,
          Array.from({ length: 20 }, (_, j) =>
            para(`b${j}`, [
              { text: `Paragraph ${j} of page ${i}, linking ` },
              { text: 'next', page: `p${(i + 1) % 500}` },
            ]),
          ),
          { elements: [picture('i', `img_${i % 200}`)] },
        ),
      );
    }
    let result: Awaited<ReturnType<typeof buildMarkdownFolder>> | undefined;
    const ms = await cpuMsOfAsync(async () => {
      result = await buildMarkdownFolder(
        sourceOf({
          pages,
          readPage: async (id) => tabs.get(id)!,
          readPicture: async () => ({ bytes: big, type: 'image/png' }),
        }),
      );
    });
    expect(result).toMatchObject({ pages: 500, pictures: 200 });
    expect(result!.blob.size).toBeGreaterThan(40_000_000);
    expect(ms).toBeLessThan(cpuBudgetMs(4000));
  });
});
