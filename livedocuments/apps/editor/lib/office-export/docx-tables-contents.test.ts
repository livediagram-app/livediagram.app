import { describe, expect, it } from 'vitest';
import {
  layOutPages,
  newArticleTable,
  pagesOf,
  withArticleFlow,
  withPageKindChosen,
  type ArticleBlock,
  type ArticleStyle,
  type Tab,
} from '@livedocuments/document';
import { readDocx } from '../office-import/docx';
import { openOfficePackage } from '../office-import/package';
import { openZip } from '../office-import/zip';
import { parseXml } from '../office-import/xml';
import { buildDocx } from './docx-build';
import { tocBookmark } from './docx-body';
import { writeDocx } from './docx-write';
import { fakeDrawer } from './test-tabs';

// docs/specs/020-import-export/office-export.md "Word: the article as a document": tables as Word tables, a contents
// block as Word's table of contents, and the header and footer as Word's own.

const WHEN = new Date('2026-10-31T12:00:00Z');

function articleTab(blocks: ArticleBlock[], style?: ArticleStyle): Tab {
  const blank: Tab = {
    id: 'article',
    name: 'Article',
    elements: [],
    pages: [{ id: 'a-1', orientation: 'portrait' }],
    templateChosen: true,
  };
  const chosen = withPageKindChosen(blank, 'a-1', 'article', 'flow-1')!;
  return withArticleFlow(chosen, 'flow-1', style ? { blocks, style } : { blocks });
}

async function exported(
  blocks: ArticleBlock[],
  style?: ArticleStyle,
  headingPages?: ReadonlyMap<string, number>,
) {
  const tab = articleTab(blocks, style);
  const doc = await buildDocx(
    {
      tab,
      pages: layOutPages(pagesOf(tab)),
      title: 'Quarterly',
      themeAccent: '#2563eb',
      date: '31 October 2026',
      ...(headingPages ? { headingPages: () => headingPages } : {}),
    },
    fakeDrawer(),
    {},
  );
  const bytes = writeDocx(doc, WHEN);
  const zip = openZip(bytes);
  const parts = new Map<string, string>();
  for (const name of zip.names()) {
    const data = await zip.read(name, 64 * 1024 * 1024);
    if (/\.(xml|rels)$/.test(name)) parts.set(name, new TextDecoder().decode(data!));
  }
  for (const [name, xml] of parts) expect(() => parseXml(xml), name).not.toThrow();
  return { doc, bytes, parts, xml: parts.get('word/document.xml')! };
}

const table = (): ArticleBlock => {
  const t = newArticleTable('t1', 2, 2, true);
  t.rows[0]!.cells = [[{ text: 'Name' }], [{ text: 'Score', i: true }]];
  t.rows[1]!.cells = [[{ text: 'Ada\nLovelace', href: 'https://example.com' }], []];
  return {
    ...t,
    cols: [
      { ...t.cols[0]!, w: 0.25 },
      { ...t.cols[1]!, w: 0.75 },
    ],
  };
};

describe('Word export: tables', () => {
  it('writes a table across the text width, its columns in their shares, its header row repeating', async () => {
    const { xml, bytes } = await exported([table()]);
    expect(xml).toContain('<w:tbl>');
    const grid = [...xml.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((m) => Number(m[1]));
    const total = Number(/<w:tblW w:w="(\d+)"/.exec(xml)![1]);
    expect(grid[0]! / total).toBeCloseTo(0.25, 2);
    expect(grid[1]! / total).toBeCloseTo(0.75, 2);
    // The header row repeats on every page, bold on a tint of the accent.
    expect(xml).toContain('<w:tblHeader/>');
    expect(xml).toMatch(/<w:shd w:val="clear" w:color="auto" w:fill="[0-9A-F]{6}"\/>/);
    expect(xml).toMatch(/<w:b\/><w:bCs\/><w:i\/>/);
    // The cell's line break, its link, and an empty cell as an empty paragraph.
    expect(xml).toContain('Ada</w:t><w:br/>');
    expect(xml).toContain('<w:hyperlink r:id=');
    // A paragraph after every table, so the body ends on one.
    expect(xml).toMatch(/<\/w:tbl><w:p><w:pPr><w:spacing w:after="0"\/><\/w:pPr><\/w:p><w:sectPr>/);
    // The Word import reads it back as a table block with its header row.
    const read = await readDocx(await openOfficePackage(bytes, 'word'));
    expect(read.blocks[0]).toMatchObject({ type: 'table', header: true });
  });

  it('writes a table with no header row without a repeating row', async () => {
    const { xml } = await exported([{ ...table(), header: undefined } as ArticleBlock]);
    expect(xml).not.toContain('<w:tblHeader/>');
    expect(xml).not.toContain('w:fill=');
  });
});

describe('Word export: contents', () => {
  const blocks: ArticleBlock[] = [
    { id: 'toc', type: 'toc', depth: 2 },
    { id: 'h-a', type: 'paragraph', style: 'h1', runs: [{ text: 'Overview' }] },
    { id: 'h-b', type: 'paragraph', style: 'h2', runs: [{ text: 'Detail' }] },
    { id: 'h-c', type: 'paragraph', style: 'h3', runs: [{ text: 'Too deep' }] },
  ];

  it('writes Word’s table of contents, its entries linked to bookmarked headings with their pages', async () => {
    const { xml, parts, doc } = await exported(
      blocks,
      undefined,
      new Map([
        ['h-a', 1],
        ['h-b', 3],
      ]),
    );
    expect(doc.blocks[0]).toMatchObject({ type: 'docxToc', depth: 2 });
    expect(xml).toContain('TOC \\o "1-2" \\h \\z \\u');
    expect(xml).toContain('<w:pStyle w:val="TOCHeading"/>');
    expect(xml).toContain('>Contents</w:t>');
    expect(xml).toContain(`<w:hyperlink w:anchor="${tocBookmark('h-a')}"`);
    expect(xml).toContain(`<w:bookmarkStart w:id="0" w:name="${tocBookmark('h-a')}"/>`);
    expect(xml).toContain('<w:pStyle w:val="TOC2"/>');
    expect(xml).toContain('<w:t>3</w:t>');
    expect(xml).not.toContain('>Too deep</w:t></w:r></w:hyperlink>');
    // The field opens on the first entry and closes on the last.
    expect(xml.match(/w:fldCharType="begin"/g)).toHaveLength(1);
    expect(xml.match(/w:fldCharType="end"/g)).toHaveLength(1);
    expect(parts.get('word/styles.xml')).toContain('w:styleId="TOC3"');
  });

  it('leaves the page numbers to Word when no editor laid the article out', async () => {
    const { xml } = await exported(blocks);
    expect(xml).not.toContain('<w:tab/>');
  });

  it('writes an empty field under the heading when there are no headings', async () => {
    const { xml } = await exported([{ id: 'toc', type: 'toc' }]);
    expect(xml).toContain('TOC \\o "1-3"');
    expect(xml).toMatch(/w:fldCharType="separate"\/><\/w:r><w:r><w:fldChar w:fldCharType="end"/);
  });

  it('keeps a bookmark name to the characters and length Word allows', () => {
    expect(tocBookmark('b-1.2')).toBe('_Tocb_1_2');
    expect(tocBookmark('x'.repeat(64))).toHaveLength(40);
  });
});

describe('Word export: header and footer', () => {
  it('writes the header and footer as Word’s, fields as Word fields and the name and date as text', async () => {
    const { parts } = await exported([{ id: 'p', type: 'paragraph', runs: [{ text: 'Hi' }] }], {
      header: { left: '{name}', right: '{date}' },
      footer: { left: 'Page {page} of {pages}' },
      pageNumbers: true,
    });
    const header = parts.get('word/header1.xml')!;
    expect(header).toContain('<w:hdr');
    expect(header).toContain('>Quarterly</w:t>');
    expect(header).toContain('>31 October 2026</w:t>');
    expect(header).toContain('w:val="right"');
    const footer = parts.get('word/footer1.xml')!;
    expect(footer).toContain(' PAGE ');
    expect(footer).toContain(' NUMPAGES ');
    // Page numbers fill the footer's empty centre.
    expect(footer.match(/ PAGE /g)).toHaveLength(2);
    const doc = parts.get('word/document.xml')!;
    expect(doc).toContain('<w:headerReference w:type="default"');
    expect(doc).toContain('<w:footerReference w:type="default"');
    expect(doc).not.toContain('<w:titlePg/>');
    expect(parts.get('[content_types].xml')).toContain('header+xml');
  });

  it('keeps a footer’s own centre over the page number', async () => {
    const { parts } = await exported([{ id: 'p', type: 'paragraph', runs: [] }], {
      footer: { center: 'Draft' },
      pageNumbers: true,
    });
    const footer = parts.get('word/footer1.xml')!;
    expect(footer).toContain('>Draft</w:t>');
    expect(footer).not.toContain(' PAGE ');
  });

  it('gives Different First Page empty first-page parts and Word’s title page', async () => {
    const { parts } = await exported([{ id: 'p', type: 'paragraph', runs: [] }], {
      header: { center: 'Report' },
      differentFirstPage: true,
      pageNumbers: true,
    });
    const doc = parts.get('word/document.xml')!;
    expect(doc).toContain('<w:headerReference w:type="first"');
    expect(doc).toContain('<w:footerReference w:type="first"');
    expect(doc).toContain('<w:titlePg/></w:sectPr>');
    expect(parts.get('word/header2.xml')).toMatch(/<\/w:pPr><\/w:p><\/w:hdr>$/);
    expect(parts.get('word/footer2.xml')).toMatch(/<\/w:pPr><\/w:p><\/w:ftr>$/);
  });

  it('writes no header part and only the page number footer for an article with page numbers alone', async () => {
    const { parts } = await exported([{ id: 'p', type: 'paragraph', runs: [] }], {
      pageNumbers: true,
    });
    expect(parts.has('word/header1.xml')).toBe(false);
    expect(parts.get('word/footer1.xml')).toContain(' PAGE ');
  });
});
