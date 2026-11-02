import { describe, expect, it } from 'vitest';
import { OfficeImportError } from './errors';
import { openOfficePackage, resolvePartPath } from './package';
import {
  DOCX_MAIN,
  makeDocx,
  makeZip,
  p,
  r,
  relsXml,
  wordSampleDocx,
  powerPointSampleDeck,
} from './test-fixtures';

async function failureOf(run: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await run();
  } catch (error) {
    return error instanceof OfficeImportError ? error.failure : 'other';
  }
  return undefined;
}

describe('resolvePartPath', () => {
  it('resolves relative, parent and absolute targets', () => {
    expect(resolvePartPath('word/document.xml', 'media/image1.png')).toBe('word/media/image1.png');
    expect(resolvePartPath('ppt/slides/slide1.xml', '../media/a.png')).toBe('ppt/media/a.png');
    expect(resolvePartPath('ppt/slides/slide1.xml', '/ppt/media/a.png')).toBe('ppt/media/a.png');
    expect(resolvePartPath('', 'word/./document.xml')).toBe('word/document.xml');
  });
});

describe('openOfficePackage', () => {
  it('opens a Word package and reads its parts and relationships', async () => {
    const pkg = await openOfficePackage(await wordSampleDocx(), 'word');
    expect(pkg.format).toBe('word');
    expect(pkg.mainPath).toBe('word/document.xml');
    expect(pkg.entryCount).toBeGreaterThan(4);
    expect(pkg.has('word/media/image1.png')).toBe(true);
    const rels = await pkg.rels(pkg.mainPath);
    expect(rels.get('rIdLink')).toEqual({
      id: 'rIdLink',
      type: 'hyperlink',
      target: 'https://example.com/',
      external: true,
    });
    expect(rels.get('rIdImg')?.target).toBe('word/media/image1.png');
    expect(await pkg.readXml('word/nothing.xml')).toBeUndefined();
    expect((await pkg.rels('word/nothing.xml')).size).toBe(0);
    // Cached: the same parse twice.
    expect(await pkg.readXml(pkg.mainPath)).toBe(await pkg.readXml(pkg.mainPath));
    expect((await pkg.readBytes('word/media/image1.png', 1000))?.byteLength).toBeGreaterThan(0);
  });

  it('opens a PowerPoint package', async () => {
    const pkg = await openOfficePackage(await powerPointSampleDeck(), 'powerpoint');
    expect(pkg.format).toBe('powerpoint');
    expect(pkg.mainPath).toBe('ppt/presentation.xml');
  });

  it('refuses the other card, older formats and what is not a package', async () => {
    expect(
      await failureOf(async () => openOfficePackage(await wordSampleDocx(), 'powerpoint')),
    ).toBe('wrong-format');
    expect(
      await failureOf(async () => openOfficePackage(await powerPointSampleDeck(), 'word')),
    ).toBe('wrong-format');
    const cfb = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    expect(await failureOf(() => openOfficePackage(cfb, 'word'))).toBe('legacy');
    expect(
      await failureOf(() => openOfficePackage(new TextEncoder().encode('# Markdown'), 'word')),
    ).toBe('not-a-package');
    // A zip with no main part.
    expect(
      await failureOf(async () => openOfficePackage(await makeZip({ 'a.txt': 'x' }), 'word')),
    ).toBe('not-a-package');
    // A spreadsheet.
    const xlsx = await makeZip({
      '_rels/.rels': relsXml([{ id: 'r', type: 'officeDocument', target: 'xl/workbook.xml' }]),
      'xl/workbook.xml': '<workbook/>',
    });
    expect(await failureOf(() => openOfficePackage(xlsx, 'word'))).toBe('not-a-package');
    // A main part the relationships name but the zip lacks.
    const dangling = await makeZip({
      '_rels/.rels': relsXml([{ id: 'r', type: 'officeDocument', target: 'word/document.xml' }]),
    });
    expect(await failureOf(() => openOfficePackage(dangling, 'word'))).toBe('not-a-package');
  });

  it('knows the format by the main part when the content types are missing or vague, macro packages too', async () => {
    const plain = await makeZip({
      '_rels/.rels': relsXml([{ id: 'r', type: 'officeDocument', target: 'word/document.xml' }]),
      'word/document.xml': '<w:document xmlns:w="x"/>',
    });
    expect((await openOfficePackage(plain, 'word')).format).toBe('word');
    const ppt = await makeZip({
      '_rels/.rels': relsXml([{ id: 'r', type: 'officeDocument', target: 'ppt/presentation.xml' }]),
      'ppt/presentation.xml': '<p/>',
    });
    expect((await openOfficePackage(ppt, 'powerpoint')).format).toBe('powerpoint');
    const docm = await makeDocx({
      body: p(r('x')),
      mainType: 'application/vnd.ms-word.document.macroEnabled.main+xml',
    });
    expect((await openOfficePackage(docm, 'word')).format).toBe('word');
    expect(DOCX_MAIN).toContain('wordprocessingml');
  });

  it('keeps a malformed %-escape in a target as written', async () => {
    const pkg = await openOfficePackage(
      await makeDocx({
        body: p(r('x')),
        rels: [{ id: 'bad', type: 'image', target: 'media/100%.png' }],
      }),
      'word',
    );
    expect((await pkg.rels(pkg.mainPath)).get('bad')?.target).toBe('word/media/100%.png');
  });
});
