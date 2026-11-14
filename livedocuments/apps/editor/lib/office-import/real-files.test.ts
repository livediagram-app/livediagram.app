import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readDocx, type DocxBlock } from './docx';
import { openOfficePackage } from './package';
import { readPptx, type SlideTextItem } from './pptx';

// Real files, written by Word and PowerPoint and kept as they came (real-files/README.md names each one's source
// and licence): the importer reads what the apps wrote, not only what the test builders mimic
// (docs/specs/020-import-export/office-import.md "Real files").

const dir = new URL('./real-files/', import.meta.url);
const bytesOf = (name: string) => new Uint8Array(readFileSync(new URL(name, dir)));
const docx = async (name: string) => readDocx(await openOfficePackage(bytesOf(name), 'word'));
const pptx = async (name: string) => readPptx(await openOfficePackage(bytesOf(name), 'powerpoint'));
const kinds = (blocks: DocxBlock[]) => blocks.map((b) => b.type);

describe('real Word files', () => {
  it('reads paragraphs and named styles Word wrote', async () => {
    const known = await docx('par-known-paragraphs.docx');
    expect(kinds(known.blocks)).toEqual(['paragraph', 'paragraph']);
    const styles = await docx('sty-known-styles.docx');
    expect(kinds(styles.blocks)).toEqual(['paragraph', 'paragraph', 'paragraph']);
  });

  it('reads Word’s tables as tables', async () => {
    const read = await docx('tbl-having-tables.docx');
    expect(kinds(read.blocks)).toEqual(['table', 'table', 'table']);
  });

  it('reads runs set in other faces, sizes and colours without losing a paragraph', async () => {
    const read = await docx('txt-font-props.docx');
    expect(read.blocks).toHaveLength(6);
    expect(kinds(read.blocks).every((t) => t === 'paragraph')).toBe(true);
  });
});

describe('real PowerPoint files', () => {
  it('reads a PowerPoint deck’s title and body placeholders as text', async () => {
    const deck = await pptx('test.pptx');
    expect(deck.slides).toHaveLength(1);
    const texts = deck.slides[0]!.items.filter((i): i is SlideTextItem => i.kind === 'text');
    expect(texts).toHaveLength(2);
    expect(texts.every((t) => t.label.length > 0 && t.sizePt > 0)).toBe(true);
  });

  it('reads a slide of text boxes set in named typefaces', async () => {
    const deck = await pptx('txt-font-typeface.pptx');
    expect(deck.slides).toHaveLength(1);
    expect(deck.slides[0]!.items).toHaveLength(5);
  });
});

describe('the fixtures folder', () => {
  it('keeps a licence beside the files, and a source line in the README for each one', () => {
    const files = readdirSync(dir);
    const readme = readFileSync(new URL('README.md', dir), 'utf8');
    expect(files).toContain('LICENSE-python-docx');
    expect(files).toContain('LICENSE-python-pptx');
    for (const f of files.filter((n) => /\.(docx|pptx)$/.test(n))) expect(readme).toContain(f);
  });
});
