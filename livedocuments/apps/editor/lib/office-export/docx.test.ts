import { describe, expect, it } from 'vitest';
import { layOutPages, pagesOf, withArticleFlow } from '@livedocuments/document';
import { readDocx, type DocxBlock as ReadBlock } from '../office-import/docx';
import { openOfficePackage } from '../office-import/package';
import { openZip } from '../office-import/zip';
import { parseXml } from '../office-import/xml';
import { articleFlowsInOrder, buildDocx, docxLook, zoneCount } from './docx-build';
import { docxBody } from './docx-body';
import type { DocxBlock } from './docx-types';
import { writeDocx } from './docx-write';
import { everyBlockArticle, fakeDrawer } from './test-tabs';

// docs/specs/020-import-export/office-export.md "Word: the article as a document": the file read back through the
// Word import, every part well-formed XML.

const WHEN = new Date('2026-10-31T12:00:00Z');

async function partsOf(bytes: Uint8Array): Promise<Map<string, string>> {
  const zip = openZip(bytes);
  const out = new Map<string, string>();
  for (const name of zip.names()) {
    const data = await zip.read(name, 64 * 1024 * 1024);
    if (/\.(xml|rels)$/.test(name)) out.set(name, new TextDecoder().decode(data!));
  }
  return out;
}

const textOf = (b: ReadBlock) =>
  b.type === 'picture'
    ? '[picture]'
    : b.type === 'code'
      ? b.text
      : 'runs' in b
        ? b.runs.map((r) => r.text).join('')
        : `[${b.type}]`;

async function everyBlockFile(pageNumbers = true) {
  const { tab, pages } = everyBlockArticle();
  const drawer = fakeDrawer();
  const progress: number[] = [];
  const doc = await buildDocx(
    { tab, pages, title: 'Every block', themeAccent: '#d97706' },
    drawer,
    {
      onProgress: (p) => progress.push(p),
    },
  );
  const bytes = writeDocx({ ...doc, look: { ...doc.look, pageNumbers } }, WHEN);
  return { tab, doc, drawer, progress, bytes };
}

describe('Word export', () => {
  it('writes every block kind as a document the import reads back, with Word’s own styles', async () => {
    const { bytes, drawer, progress } = await everyBlockFile();
    const parts = await partsOf(bytes);
    for (const [name, xml] of parts) expect(() => parseXml(xml), name).not.toThrow();
    expect(parts.get('[content_types].xml')).toContain('document.main+xml');
    expect(parts.get('word/footer1.xml')).toContain('PAGE');

    const read = await readDocx(await openOfficePackage(bytes, 'word'));
    const byText = new Map(read.blocks.map((b) => [textOf(b), b]));
    expect(byText.get('The Report')).toMatchObject({ type: 'paragraph', style: 'title' });
    expect(byText.get('A subtitle')).toMatchObject({ style: 'subtitle' });
    expect(byText.get('Heading one')).toMatchObject({ style: 'h1' });
    expect(byText.get('Heading two')).toMatchObject({ style: 'h2' });
    expect(byText.get('Heading three')).toMatchObject({ style: 'h3' });
    expect(byText.get('A quote')).toMatchObject({ style: 'quote' });
    expect(byText.get('Bullet')).toMatchObject({ type: 'list', list: 'bullet' });
    expect(byText.get('Nested bullet')).toMatchObject({ type: 'list', list: 'bullet', level: 1 });
    expect(byText.get('First')).toMatchObject({ type: 'list', list: 'numbered' });
    expect(byText.get('const a = 1;\n  return a;')).toMatchObject({ type: 'code' });
    expect(read.blocks.some((b) => b.type === 'pageBreak')).toBe(true);
    // A divider is a paragraph's rule (the import does not read rules back).
    expect(parts.get('word/document.xml')).toContain('<w:pBdr><w:bottom w:val="single"');

    // Inline formatting survives as run properties, the link as a hyperlink.
    const formatted = read.blocks.find(
      (b) => 'runs' in b && b.runs.some((r) => r.text.startsWith('Bold')),
    );
    if (!formatted || !('runs' in formatted)) throw new Error('no formatted paragraph');
    const run = (t: string) => formatted.runs.find((r) => r.text.includes(t));
    expect(run('Bold')).toMatchObject({ b: true });
    expect(run('italic')).toMatchObject({ i: true });
    expect(run('under')).toMatchObject({ u: true });
    expect(run('struck')).toMatchObject({ s: true });
    expect(run('a link')).toMatchObject({ href: 'https://example.com/a?b=1&c=2' });
    expect(run('up')).toMatchObject({ sup: true });
    // Colour and highlight are written though the import keeps the theme's own (it drops them).
    expect(parts.get('word/document.xml')).toContain('<w:color w:val="DC2626"/>');
    expect(parts.get('word/document.xml')).toContain(
      '<w:shd w:val="clear" w:color="auto" w:fill="FEF08A"/>',
    );

    // The two laid-out zones are pictures; the zone never laid out draws nothing.
    expect(read.pictures).toHaveLength(2);
    expect(drawer.regions.map((r) => r.ids)).toEqual([['zone-image'], ['zone-shape']]);
    expect(progress.at(-1)).toBe(1);
    // An empty heading leaves no stray Heading 1 behind.
    expect(read.blocks.filter((b) => 'style' in b && b.style === 'h1')).toHaveLength(1);
  });

  it('marks to-dos with a box, ticked and struck when done', async () => {
    const { bytes } = await everyBlockFile(false);
    const doc = (await partsOf(bytes)).get('word/document.xml')!;
    expect(doc).toContain('☐ </w:t>');
    expect(doc).toMatch(/☒ <\/w:t><\/w:r><w:r><w:rPr><w:strike\/>/);
    expect(doc).not.toContain('footerReference');
  });

  it('floats a zone that wraps beside the text and centres one that does not', async () => {
    const { doc, bytes } = await everyBlockFile();
    const images = doc.blocks.filter((b) => b.type === 'image');
    expect(images.map((b) => b.type === 'image' && [b.wrap, b.align])).toEqual([
      ['inline', 'center'],
      ['left', 'center'],
    ]);
    const xml = (await partsOf(bytes)).get('word/document.xml')!;
    expect(xml).toContain('<wp:inline');
    expect(xml).toContain('<wp:wrapSquare wrapText="right"/>');
  });

  it('restarts numbering after anything but a list item, and keeps it through a nested one', () => {
    const look = docxLook(undefined, '#2563eb');
    const blocks: DocxBlock[] = [
      { id: '1', type: 'list', list: 'numbered', runs: [{ text: 'a' }] },
      { id: '2', type: 'list', list: 'bullet', level: 1, runs: [{ text: 'nested' }] },
      { id: '3', type: 'list', list: 'numbered', runs: [{ text: 'b' }] },
      { id: '4', type: 'paragraph', runs: [{ text: 'break' }] },
      { id: '5', type: 'list', list: 'numbered', runs: [{ text: 'c' }] },
    ];
    const body = docxBody(blocks, look, 10);
    const nums = [...body.xml.matchAll(/<w:numId w:val="(\d+)"\/>/g)].map((m) => m[1]);
    // a and b share a run; c starts its own; the bullet uses the bullet list.
    expect(nums).toEqual(['2', '1', '2', '3']);
    expect(body.numberedRuns).toBe(2);
  });

  it('writes a second article on a new page, in the row’s order', async () => {
    const { tab: base } = everyBlockArticle();
    const first = pagesOf(base)[0]!;
    const tab = withArticleFlow(
      { ...base, pages: [...pagesOf(base), { ...first, id: 'a-2', flow: 'flow-2' }] },
      'flow-2',
      { blocks: [{ id: 'second', type: 'paragraph', runs: [{ text: 'Second article' }] }] },
    );
    const pages = layOutPages(pagesOf(tab));
    expect(articleFlowsInOrder(tab)).toEqual(['flow-1', 'flow-2']);
    expect(zoneCount(tab)).toBe(3);
    const doc = await buildDocx(
      { tab, pages, title: 'T', themeAccent: '#000000' },
      fakeDrawer(),
      {},
    );
    const last = doc.blocks.slice(-2);
    expect(last[0]!.type).toBe('pageBreak');
    expect(last[1]).toMatchObject({ runs: [{ text: 'Second article' }] });
  });

  it('takes the article’s look: its accent, faces and A4 page', async () => {
    const { doc, bytes } = await everyBlockFile();
    expect(doc.page.widthPx).toBeLessThan(doc.page.heightPx);
    const parts = await partsOf(bytes);
    expect(parts.get('word/document.xml')).toMatch(/<w:pgSz w:w="\d+" w:h="\d+"\/>/);
    expect(parts.get('word/numbering.xml')).toContain('D97706');
    expect(parts.get('word/styles.xml')).toContain('w:styleId="Heading1"');
    expect(parts.get('docprops/core.xml')).toContain('<dc:title>Every block</dc:title>');
  });

  it('stops when cancelled', async () => {
    const { tab, pages } = everyBlockArticle();
    const controller = new AbortController();
    controller.abort();
    await expect(
      buildDocx({ tab, pages, title: 'T', themeAccent: '#000' }, fakeDrawer(), {
        signal: controller.signal,
      }),
    ).rejects.toThrow('cancelled');
  });
});
