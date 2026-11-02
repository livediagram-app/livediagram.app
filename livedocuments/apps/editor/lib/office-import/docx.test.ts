import { describe, expect, it } from 'vitest';
import type { ArticleBlock } from '@livedocuments/document';
import { readDocx, type DocxBlock } from './docx';
import { OfficeImportError } from './errors';
import { openOfficePackage } from './package';
import {
  drawing,
  googleDocsSampleDocx,
  makeDocx,
  numbered,
  p,
  r,
  styled,
  wordSampleDocx,
  type DocxOptions,
} from './test-fixtures';

const read = async (opts: DocxOptions) =>
  readDocx(await openOfficePackage(await makeDocx(opts), 'word'));

/** A block's text, a picture as [picture]. */
const textOf = (b: DocxBlock) =>
  b.type === 'picture'
    ? '[picture]'
    : b.type === 'code'
      ? b.text
      : 'runs' in b
        ? b.runs.map((r) => r.text).join('')
        : `[${b.type}]`;

const kindOf = (b: DocxBlock): string => {
  if (b.type === 'paragraph') return b.style ?? 'body';
  if (b.type === 'list') return `${b.list}${b.level ?? 0}`;
  return b.type;
};

describe('readDocx, a Word document', () => {
  it('maps every kind of paragraph the spec names, in order', async () => {
    const { blocks, pictures, tally } = await readDocx(
      await openOfficePackage(await wordSampleDocx(), 'word'),
    );
    expect(blocks.map((b) => [kindOf(b), textOf(b)])).toEqual([
      ['title', 'Quarterly Report'],
      ['subtitle', 'Prepared for the team'],
      ['h1', 'Overview'],
      ['body', 'Plain, bold, italic, underlined, struck, x2 and code. See the site or email us.'],
      ['bullet0', 'First point'],
      ['bullet1', 'A detail'],
      ['bullet0', 'From the style'],
      ['numbered0', 'Step one'],
      ['body', 'Not a list'],
      ['quote', 'Well said.'],
      ['code', 'const a = 1;\nconst b = 2;'],
      ['body', 'Kept and added'],
      ['pageBreak', '[pageBreak]'],
      ['h2', 'Details'],
      ['picture', '[picture]'],
      ['table', '[table]'],
      ['h3', 'Deep heading'],
      ['body', 'Centred'],
    ]);
    expect(pictures).toEqual([
      { path: 'word/media/image1.png', widthPx: 640, heightPx: 480, alt: 'A chart of sales' },
    ]);
    expect(tally).toEqual({ footnotes: 1, comments: 1, charts: 1, headersFooters: 1 });
    // The table is a table block, its cells' formatting kept.
    expect(blocks.find((b) => b.type === 'table')).toMatchObject({
      type: 'table',
      rows: [
        { cells: [[{ text: 'Name', b: true }], [{ text: 'Score' }]] },
        { cells: [[{ text: 'Ada' }], [{ text: '10' }]] },
      ],
    });
  });

  it('keeps inline marks, safe links and alignment', async () => {
    const { blocks } = await readDocx(await openOfficePackage(await wordSampleDocx(), 'word'));
    const para = blocks[3] as Extract<ArticleBlock, { type: 'paragraph' }>;
    expect(para.align).toBe('justify');
    const by = (t: string) => para.runs.find((x) => x.text === t)!;
    expect(by('bold').b).toBe(true);
    expect(by('italic').i).toBe(true);
    expect(by('underlined').u).toBe(true);
    expect(by('struck').s).toBe(true);
    expect(by('2').sup).toBe(true);
    expect(by('code').code).toBe(true);
    expect(by('the site').href).toBe('https://example.com/');
    expect(by('email us').href).toBe('mailto:team@example.com');
    expect((blocks.at(-1) as { align?: string }).align).toBe('center');
  });
});

describe('readDocx, a Google Docs download', () => {
  it('reads valued toggles, code fonts, page-break runs and floating pictures', async () => {
    const { blocks, pictures } = await readDocx(
      await openOfficePackage(await googleDocsSampleDocx(), 'word'),
    );
    expect(blocks.map((b) => [kindOf(b), textOf(b)])).toEqual([
      ['title', 'Launch plan'],
      ['h1', 'Goals'],
      ['body', 'Ship soon'],
      ['body', 'Docs'],
      ['code', 'npm run build\nnpm test'],
      ['body', 'Before the break'],
      ['pageBreak', '[pageBreak]'],
      ['body', 'After the break'],
      ['picture', '[picture]'],
      ['h2', 'Risks'],
    ]);
    const ship = blocks[2] as Extract<ArticleBlock, { type: 'paragraph' }>;
    expect(ship.runs).toEqual([{ text: 'Ship ', b: true }, { text: 'soon' }]);
    expect((blocks[3] as Extract<ArticleBlock, { type: 'paragraph' }>).runs[0]!.href).toBe(
      'https://docs.example.com/',
    );
    expect(pictures[0]).toMatchObject({ widthPx: 300, heightPx: 200 });
  });
});

describe('readDocx, the edges', () => {
  it('reads a document with no styles or numbering part by its style ids', async () => {
    const { blocks } = await read({
      styles: null,
      numbering: null,
      body: [
        p(r('Big'), styled('Heading1')),
        p(r('Name'), styled('Title')),
        p(r('Item'), numbered(7)),
        p(r('Plain'), styled('Unknown')),
      ].join(''),
    });
    expect(blocks.map(kindOf)).toEqual(['h1', 'title', 'bullet0', 'body']);
  });

  it('reads a paragraph starting with a box as a to-do, ticked for ☒ and ☑, and nothing else', async () => {
    const { blocks } = await read({
      body: [
        p(r('☐') + r(' Buy milk')),
        p(r('☑\u00a0Paid'), numbered(7, 1)),
        p(r('☒ ') + r('Sent', '<w:strike/>'), '<w:ind w:left="1140"/>'),
        p(r('☐x not a box')),
        p(r('☐ ')),
        p(r('☐ A heading'), styled('Heading1')),
      ].join(''),
    });
    expect(blocks.map((b) => [kindOf(b), textOf(b), 'checked' in b ? b.checked : false])).toEqual([
      ['todo0', 'Buy milk', false],
      ['todo1', 'Paid', true],
      ['todo2', 'Sent', true],
      ['body', '☐x not a box', false],
      ['body', '☐', false],
      ['h1', '☐ A heading', false],
    ]);
    // A ticked item's strikethrough is the article's to draw.
    expect(blocks[2]).toMatchObject({ runs: [{ text: 'Sent' }] });
    expect((blocks[2] as { runs: object[] }).runs[0]).not.toHaveProperty('s');
  });

  it('follows basedOn chains and outline levels', async () => {
    const { blocks } = await read({
      body: [p(r('Mine'), styled('MyHeading')), p(r('Outlined'), '<w:outlineLvl w:val="2"/>')].join(
        '',
      ),
    });
    expect(blocks.map(kindOf)).toEqual(['h2', 'h3']);
  });

  it('drops unsafe links, keeps their text, and links field results only for HYPERLINK', async () => {
    const field = (instr: string, text: string) =>
      `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>${instr}</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${r(text)}<w:r><w:fldChar w:fldCharType="end"/></w:r>`;
    const { blocks } = await read({
      rels: [
        { id: 'js', type: 'hyperlink', target: 'javascript:alert(1)', external: true },
        { id: 'int', type: 'hyperlink', target: 'other.xml' },
      ],
      body: p(
        [
          `<w:hyperlink r:id="js">${r('bad')}</w:hyperlink>`,
          `<w:hyperlink w:anchor="top">${r(' anchor')}</w:hyperlink>`,
          `<w:hyperlink r:id="int">${r(' internal')}</w:hyperlink>`,
          field(' PAGE ', ' 3'),
          `<w:fldSimple w:instr=" HYPERLINK &quot;https://x.example/&quot; ">${r(' simple')}</w:fldSimple>`,
        ].join(''),
      ),
    });
    const runs = (blocks[0] as Extract<ArticleBlock, { type: 'paragraph' }>).runs;
    expect(runs.map((x) => x.text).join('')).toBe('bad anchor internal 3 simple');
    expect(runs.filter((x) => x.href).map((x) => x.href)).toEqual(['https://x.example/']);
  });

  it('turns tabs, line breaks and hyphens into text and ignores column breaks', async () => {
    const { blocks } = await read({
      body: p(
        `<w:r><w:t>a</w:t><w:tab/><w:t>b</w:t><w:br/><w:t>c</w:t><w:br w:type="column"/><w:noBreakHyphen/><w:cr/><w:t>d</w:t></w:r>`,
      ),
    });
    expect(textOf(blocks[0]!)).toBe('a b\nc-\nd');
  });

  it('opens content controls, smart tags and alternate content, and counts what it leaves out', async () => {
    const { blocks, tally } = await read({
      rels: [
        { id: 'img', type: 'image', target: 'media/a.png' },
        { id: 'ext', type: 'image', target: 'https://x/a.png', external: true },
      ],
      body: [
        `<w:sdt><w:sdtContent>${p(`<w:sdt><w:sdtContent>${r('in a control')}</w:sdtContent></w:sdt>`)}</w:sdtContent></w:sdt>`,
        `<w:customXml>${p(`<w:smartTag>${r('tagged')}</w:smartTag>`)}</w:customXml>`,
        p(
          `<mc:AlternateContent><mc:Choice Requires="wps">${r('choice')}</mc:Choice><mc:Fallback>${r('fallback')}</mc:Fallback></mc:AlternateContent>`,
        ),
        p(
          `<w:r><mc:AlternateContent><mc:Choice><w:t>run choice</w:t></mc:Choice></mc:AlternateContent></w:r>`,
        ),
        p(`<m:oMath/>${r('after maths')}`),
        p(`<w:r><w:object/></w:r>`),
        p(
          `<w:r><w:pict><v:shape style="width:72pt;height:1in"><v:imagedata r:id="img"/></v:shape></w:pict></w:r>`,
        ),
        p(`<w:r><w:pict><v:textbox/></w:pict></w:r>`),
        p(drawing('ext', 10, 10)),
        p(drawing('img', 10, 10, { link: true })),
        p(drawing('missing', 10, 10)),
        p(
          `<w:r><w:drawing><wp:inline><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram"/></a:graphic></wp:inline></w:drawing></w:r>`,
        ),
        p(
          `<w:r><w:drawing><wp:anchor><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"/></a:graphic></wp:anchor></w:drawing></w:r>`,
        ),
        p(`<w:r><w:drawing/></w:r>`),
        '<w:altChunk r:id="x"/>',
        `<w:ins>${p(r('inserted paragraph'))}</w:ins>`,
        p(r('section break'), '<w:sectPr><w:footerReference r:id="f"/></w:sectPr>'),
        '<w:sectPr><w:headerReference r:id="h"/></w:sectPr>',
        '<w:bookmarkStart w:id="0"/>',
      ].join(''),
    });
    expect(blocks.map(textOf)).toEqual([
      'in a control',
      'tagged',
      'choice',
      'run choice',
      'after maths',
      '[picture]',
      'inserted paragraph',
      'section break',
    ]);
    expect(blocks[5]).toMatchObject({
      picture: { path: 'word/media/a.png', widthPx: 96, heightPx: 96 },
    });
    expect(tally).toEqual({
      equations: 1,
      embedded: 2,
      textBoxes: 2,
      linkedImages: 3,
      diagrams: 1,
      headersFooters: 1,
    });
  });

  it('merges two page breaks into one and never starts with one', async () => {
    const brk = '<w:r><w:br w:type="page"/></w:r>';
    const { blocks } = await read({
      body: [p(brk), p(r('One')), p(`${brk}${brk}`), p(r('Two'), '<w:pageBreakBefore/>')].join(''),
    });
    expect(blocks.map(kindOf)).toEqual(['body', 'pageBreak', 'body']);
  });

  it('writes nested tables into their cell and drops pictures and breaks in tables', async () => {
    const cell = (inner: string) => `<w:tc>${inner}</w:tc>`;
    const { blocks } = await read({
      rels: [{ id: 'img', type: 'image', target: 'media/a.png' }],
      body: `<w:tbl><w:tr>${cell(p(r('Outer')) + `<w:tbl><w:tr>${cell(p(r('Inner')))}</w:tr></w:tbl>` + p(`${r('pic')}${drawing('img', 5, 5)}<w:r><w:br w:type="page"/></w:r>`))}${cell(p(''))}${cell(`<w:sdt><w:sdtContent>${p(r('Ctl'))}</w:sdtContent></w:sdt>`)}</w:tr><w:tr>${cell(p(''))}</w:tr><w:tr/></w:tbl>${p(r('After'))}`,
    });
    expect(blocks.map(textOf)).toEqual(['[table]', 'After']);
    const table = blocks[0] as Extract<ArticleBlock, { type: 'table' }>;
    // The nested table is text in its cell; the row of one cell is padded to the widest; a row with no cell goes.
    expect(table.rows.map((row) => row.cells.map((c) => c.map((x) => x.text).join('')))).toEqual([
      ['Outer Inner\npic', '', 'Ctl'],
      ['', '', ''],
    ]);
    expect(table.header).toBeUndefined();
  });

  it('reads a repeated first row as the header row, and joins a cell’s paragraphs with line breaks', async () => {
    const cell = (inner: string) => `<w:tc>${inner}</w:tc>`;
    const { blocks, tally } = await read({
      body: `<w:tbl><w:tr><w:trPr><w:tblHeader/></w:trPr>${cell(p(r('Name')))}${cell(p(r('Score')))}</w:tr><w:tr>${cell(p(r('Ada')) + p(r('Lovelace')))}${cell(p(r('10')))}</w:tr></w:tbl>`,
    });
    const table = blocks[0] as Extract<ArticleBlock, { type: 'table' }>;
    expect(table.header).toBe(true);
    expect(table.cols).toHaveLength(2);
    expect(table.rows[1]!.cells[0]).toEqual([{ text: 'Ada\nLovelace' }]);
    expect(tally).toEqual({});
  });

  it('reads a header flag turned off as no header row', async () => {
    const { blocks } = await read({
      body: `<w:tbl><w:tr><w:trPr><w:tblHeader w:val="false"/></w:trPr><w:tc>${p(r('A'))}</w:tc></w:tr></w:tbl>`,
    });
    expect((blocks[0] as Extract<ArticleBlock, { type: 'table' }>).header).toBeUndefined();
  });

  it('cuts a table past the caps to fit, counting it, and drops a table with no rows', async () => {
    const wide = `<w:tr>${Array.from({ length: 25 }, (_, i) => `<w:tc>${p(r(`c${i}`))}</w:tc>`).join('')}</w:tr>`;
    const { blocks, tally } = await read({
      body: `<w:tbl>${wide}</w:tbl><w:tbl></w:tbl>${p(r('After'))}`,
    });
    expect(blocks.map(textOf)).toEqual(['[table]', 'After']);
    expect((blocks[0] as Extract<ArticleBlock, { type: 'table' }>).cols).toHaveLength(20);
    expect(tally).toEqual({ tables: 1 });
  });

  it('caps a long paragraph and a long code block, and counts each', async () => {
    const long = 'x'.repeat(20_500);
    const { blocks, tally } = await read({
      body: [
        p(r(long)),
        p(r(long), styled('HTMLPreformatted')),
        p(r('more'), styled('HTMLPreformatted')),
      ].join(''),
    });
    expect(textOf(blocks[0]!).length).toBe(20_000);
    expect((blocks[1] as { text: string }).text.length).toBe(20_000);
    expect(tally.longText).toBe(3);
  });

  it('refuses more blocks than an article holds, naming how many', async () => {
    const body = Array.from({ length: 5002 }, (_, i) => p(r(`p${i}`))).join('');
    try {
      await read({ body });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(OfficeImportError);
      expect((error as OfficeImportError).failure).toBe('too-many-blocks');
      expect((error as OfficeImportError).count).toBe(5002);
    }
  });

  it('reads a document whose prefixes are not Word’s own', async () => {
    const { blocks } = await read({ prefix: 'ns0', body: p(r('Hello'), styled('Heading1')) });
    expect(blocks.map(textOf)).toEqual(['Hello']);
    expect(kindOf(blocks[0]!)).toBe('h1');
  });

  it('reads monospace paragraph styles and list paragraphs in code fonts', async () => {
    const styles = `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Src"><w:name w:val="Source"/><w:rPr><w:rFonts w:ascii="JetBrains Mono"/></w:rPr></w:style><w:style w:type="character" w:styleId="Emphasis"><w:name w:val="Emphasis"/></w:style></w:styles>`;
    const { blocks } = await read({
      styles,
      body: [
        p(r('x = 1'), styled('Src')),
        p(r('listed', '<w:rFonts w:ascii="Consolas"/>'), numbered(1)),
        p(r('em', '<w:rStyle w:val="Emphasis"/>')),
        p(r('strong', '<w:rStyle w:val="Strong"/><w:b w:val="false"/>')),
      ].join(''),
    });
    expect(blocks.map(kindOf)).toEqual(['code', 'bullet0', 'body', 'body']);
    expect((blocks[2] as Extract<ArticleBlock, { type: 'paragraph' }>).runs[0]!.i).toBe(true);
    expect((blocks[3] as Extract<ArticleBlock, { type: 'paragraph' }>).runs[0]!.b).toBeUndefined();
  });
});
