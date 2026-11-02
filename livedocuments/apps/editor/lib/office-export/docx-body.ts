// An article's blocks as a Word document's body (docs/specs/020-import-export/blueprints/office-export.md
// "Word body"): each block a paragraph in its Word style, runs with their formatting, links as hyperlinks, lists on
// the numbering definitions, and drawn zones as inline or floating pictures. Collects the relationships (links and
// images) and the numbered runs the other parts need. Pure string building.

import type { ArticleAlign, ArticleRun, ArticleTableBlock } from '@livedocuments/document';
import { REL, xmlText, type OoxmlRel } from './ooxml';
import {
  BULLET_NUM_ID,
  CODE_CHAR_STYLE_ID,
  CODE_STYLE_ID,
  HYPERLINK_STYLE_ID,
  LIST_LEVELS,
  LIST_STYLE_ID,
  PARAGRAPH_STYLE_ID,
  ruleUnder,
  TOC_HEADING_STYLE_ID,
  tocStyleId,
  TWIPS_PER_PX,
} from './docx-styles';
import type { DocxBlock, DocxImage, DocxLook, DocxToc } from './docx-types';

/** EMU per page px (96 px an inch). */
export const DOCX_EMU_PER_PX = 9525;
// The clearance a wrapped zone keeps from the text beside it, px (docs/specs/007-editor/article-pages.md "Zones").
const WRAP_CLEAR_PX = 14;
// A to-do's box, open and ticked.
const TODO_OPEN = '☐ ';
const TODO_DONE = '☒ ';
// The rule a divider draws, slate-300; a table's hairlines too.
const DIVIDER_HEX = 'CBD5E1';
// A table cell's padding, px (docs/specs/007-editor/article-pages.md "Tables", Look): 6 above and below, 10 beside.
const CELL_PAD_Y_PX = 6;
const CELL_PAD_X_PX = 10;
// The header row's tint: the accent at this share over the white page.
const HEADER_TINT = 0.1;
// The text's width when the paper is not known (A4 less Normal margins).
const FALLBACK_TEXT_WIDTH_PX = 602;
// Heading styles a contents block can link to: their paragraphs carry a bookmark.
const LINKED_HEADINGS = new Set(['h1', 'h2', 'h3']);

/** A heading's bookmark name: `_Toc` and its block id, Word's own prefix, in the characters a name may hold. */
export const tocBookmark = (id: string) => `_Toc${id.replace(/[^A-Za-z0-9_]/g, '_')}`.slice(0, 40);

/** `hex` (six digits) mixed with white, `share` of it kept. */
function tint(hex: string, share: number): string {
  const n = parseInt(hex, 16);
  const mix = (c: number) =>
    Math.round(c * share + 255 * (1 - share))
      .toString(16)
      .padStart(2, '0');
  return (mix((n >> 16) & 255) + mix((n >> 8) & 255) + mix(n & 255)).toUpperCase();
}

export type DocxBodyOut = {
  xml: string;
  rels: OoxmlRel[];
  media: { name: string; png: Uint8Array }[];
  numberedRuns: number;
};

const JC: Readonly<Record<ArticleAlign, string>> = {
  left: 'left',
  center: 'center',
  right: 'right',
  justify: 'both',
};

const hex = (c: string | undefined): string | undefined => {
  const m = c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (!m) return undefined;
  const d = m[1]!;
  return (d.length === 3 ? d.replace(/./g, (x) => x + x) : d).toUpperCase();
};

class BodyWriter {
  readonly rels: OoxmlRel[] = [];
  readonly media: { name: string; png: Uint8Array }[] = [];
  numberedRuns = 0;
  private drawingId = 0;
  private links = new Map<string, string>();
  // Floating pictures waiting for the next paragraph to anchor in.
  private pendingAnchors: string[] = [];

  private bookmarkId = 0;

  private readonly look: DocxLook;
  private readonly firstRelId: number;
  private readonly textWidthPx: number;

  constructor(look: DocxLook, firstRelId: number, textWidthPx: number) {
    this.look = look;
    this.firstRelId = firstRelId;
    this.textWidthPx = textWidthPx;
  }

  /** A table (docs/specs/007-editor/article-pages.md "Tables"): across the text width, its columns in their shares,
   *  ruled in hairlines; a header row repeated on every page, bold on a tint of the accent. */
  table(t: ArticleTableBlock): string {
    const width = Math.round(this.textWidthPx * TWIPS_PER_PX);
    const cols = t.cols.map((c) => Math.round(c.w * width));
    const line = (side: string) =>
      `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="${DIVIDER_HEX}"/>`;
    const tblPr =
      `<w:tblPr><w:tblW w:w="${width}" w:type="dxa"/>` +
      `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(line).join('')}</w:tblBorders>` +
      '<w:tblLayout w:type="fixed"/>' +
      `<w:tblCellMar><w:top w:w="${Math.round(CELL_PAD_Y_PX * TWIPS_PER_PX)}" w:type="dxa"/>` +
      `<w:left w:w="${Math.round(CELL_PAD_X_PX * TWIPS_PER_PX)}" w:type="dxa"/>` +
      `<w:bottom w:w="${Math.round(CELL_PAD_Y_PX * TWIPS_PER_PX)}" w:type="dxa"/>` +
      `<w:right w:w="${Math.round(CELL_PAD_X_PX * TWIPS_PER_PX)}" w:type="dxa"/></w:tblCellMar>` +
      '<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr>';
    const grid = `<w:tblGrid>${cols.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
    const fill = tint(this.look.accent, HEADER_TINT);
    const rows = t.rows
      .map((row, r) => {
        const head = r === 0 && t.header === true;
        const cells = row.cells
          .map((runs, c) => {
            const tcPr = `<w:tcPr><w:tcW w:w="${cols[c]}" w:type="dxa"/>${head ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}</w:tcPr>`;
            const content = this.runs(head ? runs.map((x) => ({ ...x, b: true as const })) : runs);
            return `<w:tc>${tcPr}<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${content}</w:p></w:tc>`;
          })
          .join('');
        return `<w:tr>${head ? '<w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>'}${cells}</w:tr>`;
      })
      .join('');
    return `<w:tbl>${tblPr}${grid}${rows}</w:tbl>`;
  }

  /** A contents block (docs/specs/007-editor/article-pages.md "Table of contents"): a "Contents" heading, then Word's
   *  table of contents field, its cached result the entries as the page shows them, each a link to its heading's
   *  bookmark with its page number on a dotted right tab, so it reads at once and Update Field refreshes it. */
  toc(t: DocxToc): string {
    const tab = `<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${Math.round(this.textWidthPx * TWIPS_PER_PX)}"/></w:tabs>`;
    const begin =
      '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
      `<w:r><w:instrText xml:space="preserve"> TOC \\o "1-${t.depth}" \\h \\z \\u </w:instrText></w:r>` +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r>';
    const end = '<w:r><w:fldChar w:fldCharType="end"/></w:r>';
    let out = this.paragraph(
      `<w:pStyle w:val="${TOC_HEADING_STYLE_ID}"/>`,
      this.run({ text: 'Contents' }),
    );
    if (t.entries.length === 0) return out + this.paragraph('', begin + end);
    t.entries.forEach((e, i) => {
      const page = e.page === undefined ? '' : `<w:r><w:tab/></w:r><w:r><w:t>${e.page}</w:t></w:r>`;
      const link = `<w:hyperlink w:anchor="${tocBookmark(e.id)}" w:history="1">${this.run({ text: e.text })}${page}</w:hyperlink>`;
      out += this.paragraph(
        `<w:pStyle w:val="${tocStyleId(e.level)}"/>${tab}`,
        (i === 0 ? begin : '') + link + (i === t.entries.length - 1 ? end : ''),
      );
    });
    return out;
  }

  private relId(): string {
    return `rId${this.firstRelId + this.rels.length}`;
  }

  private linkId(href: string): string {
    const known = this.links.get(href);
    if (known) return known;
    const id = this.relId();
    this.rels.push({ id, type: REL.hyperlink, target: href, external: true });
    this.links.set(href, id);
    return id;
  }

  /** One run's XML: its formatting in the schema's order, its text with line breaks. */
  run(r: ArticleRun, extra: { strike?: boolean; colour?: string } = {}): string {
    const colour = extra.colour ?? hex(r.color);
    const highlight = hex(r.hl);
    const rPr =
      (r.href
        ? `<w:rStyle w:val="${HYPERLINK_STYLE_ID}"/>`
        : r.code
          ? `<w:rStyle w:val="${CODE_CHAR_STYLE_ID}"/>`
          : '') +
      (r.b ? '<w:b/><w:bCs/>' : '') +
      (r.i ? '<w:i/><w:iCs/>' : '') +
      (r.s || extra.strike ? '<w:strike/>' : '') +
      (colour ? `<w:color w:val="${colour}"/>` : '') +
      (r.u ? '<w:u w:val="single"/>' : '') +
      (highlight ? `<w:shd w:val="clear" w:color="auto" w:fill="${highlight}"/>` : '') +
      (r.sup
        ? '<w:vertAlign w:val="superscript"/>'
        : r.sub
          ? '<w:vertAlign w:val="subscript"/>'
          : '');
    const pieces = r.text
      .split('\n')
      .map((t) => (t ? `<w:t xml:space="preserve">${xmlText(t)}</w:t>` : ''));
    return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}${pieces.join('<w:br/>')}</w:r>`;
  }

  /** Runs, a run of one link's text wrapped in its hyperlink. */
  runs(runs: readonly ArticleRun[], extra: { strike?: boolean; colour?: string } = {}): string {
    let out = '';
    for (let i = 0; i < runs.length;) {
      const href = runs[i]!.href;
      if (!href) {
        out += this.run(runs[i]!, extra);
        i += 1;
        continue;
      }
      let inner = '';
      while (i < runs.length && runs[i]!.href === href) inner += this.run(runs[i++]!, extra);
      out += `<w:hyperlink r:id="${this.linkId(href)}" w:history="1">${inner}</w:hyperlink>`;
    }
    return out;
  }

  /** A paragraph, with any floating picture waiting for it anchored at its start. */
  paragraph(pPr: string, content: string): string {
    const anchors = this.pendingAnchors.join('');
    this.pendingAnchors = [];
    return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${anchors}${content}</w:p>`;
  }

  /** Whatever pictures are still waiting, in a paragraph of their own (the article ended on them). */
  flushAnchors(): string {
    return this.pendingAnchors.length ? this.paragraph('', '') : '';
  }

  image(img: DocxImage): string {
    this.drawingId += 1;
    const n = this.drawingId;
    const name = `image${n}.png`;
    this.media.push({ name, png: img.png });
    const rid = this.relId();
    this.rels.push({ id: rid, type: REL.image, target: `media/${name}` });
    const cx = Math.round(img.widthPx * DOCX_EMU_PER_PX);
    const cy = Math.round(img.heightPx * DOCX_EMU_PER_PX);
    const graphic =
      '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
      '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      `<pic:nvPicPr><pic:cNvPr id="${n}" name="Picture ${n}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
      '</pic:pic></a:graphicData></a:graphic>';
    const common = `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>`;
    const docPr =
      `<wp:docPr id="${n}" name="Picture ${n}"/>` +
      '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>';
    if (img.wrap === 'inline') {
      const drawing = `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">${common}${docPr}${graphic}</wp:inline></w:drawing></w:r>`;
      // An image's line takes its own height, never the text's leading.
      return this.paragraph(
        `<w:spacing w:line="240" w:lineRule="auto"/><w:jc w:val="${img.align === 'left' ? 'left' : img.align === 'right' ? 'right' : 'center'}"/>`,
        drawing,
      );
    }
    const clear = Math.round(WRAP_CLEAR_PX * DOCX_EMU_PER_PX);
    const side = img.wrap === 'left' ? 'left' : 'right';
    this.pendingAnchors.push(
      `<w:r><w:drawing><wp:anchor distT="0" distB="${clear}" distL="${clear}" distR="${clear}" simplePos="0"` +
        ` relativeHeight="${251_658_240 + n}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="0">` +
        '<wp:simplePos x="0" y="0"/>' +
        `<wp:positionH relativeFrom="margin"><wp:align>${side}</wp:align></wp:positionH>` +
        '<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>' +
        `${common}<wp:wrapSquare wrapText="${side === 'left' ? 'right' : 'left'}"/>${docPr}${graphic}</wp:anchor></w:drawing></w:r>`,
    );
    return '';
  }

  blocks(blocks: readonly DocxBlock[]): string {
    let out = '';
    // The num of the numbered run in progress: a new one each time another block ends a run.
    let numbered: number | null = null;
    for (const b of blocks) {
      // Any other block ends a numbered run, and so does a bullet or to-do at the top level (it restarts that
      // level's count); one nested deeper leaves the run going (D74).
      if (b.type !== 'list' || (b.list !== 'numbered' && (b.level ?? 0) === 0)) numbered = null;
      switch (b.type) {
        case 'paragraph': {
          const style = b.style ?? 'body';
          // An empty title or heading is only a placeholder on the canvas; an empty body paragraph is spacing.
          if (style !== 'body' && b.runs.every((r) => !r.text.trim())) break;
          const pPr =
            (style !== 'body' ? `<w:pStyle w:val="${PARAGRAPH_STYLE_ID[style]}"/>` : '') +
            (b.align && b.align !== 'left' ? `<w:jc w:val="${JC[b.align]}"/>` : '');
          // A heading carries a bookmark, so a contents entry in Word can link to it.
          let content = this.runs(b.runs);
          if (LINKED_HEADINGS.has(style)) {
            const id = this.bookmarkId++;
            content =
              `<w:bookmarkStart w:id="${id}" w:name="${tocBookmark(b.id)}"/>` +
              content +
              `<w:bookmarkEnd w:id="${id}"/>`;
          }
          out += this.paragraph(pPr, content);
          break;
        }
        case 'list': {
          const level = Math.min(LIST_LEVELS - 1, Math.max(0, b.level ?? 0));
          const jc = b.align && b.align !== 'left' ? `<w:jc w:val="${JC[b.align]}"/>` : '';
          if (b.list === 'todo') {
            // A to-do is a list item with its box written in, ticked and struck through when done.
            const box = { text: b.checked ? TODO_DONE : TODO_OPEN };
            const done = b.checked ? { strike: true, colour: this.look.muted } : {};
            const indent = `<w:ind w:left="${Math.round((20 + 28 * level) * TWIPS_PER_PX)}"/>`;
            out += this.paragraph(
              `<w:pStyle w:val="${LIST_STYLE_ID}"/>${indent}${jc}`,
              this.run(box) + this.runs(b.runs, done),
            );
            break;
          }
          let numId = BULLET_NUM_ID;
          if (b.list === 'numbered') {
            if (numbered === null) {
              this.numberedRuns += 1;
              numbered = BULLET_NUM_ID + this.numberedRuns;
            }
            numId = numbered;
          }
          out += this.paragraph(
            `<w:pStyle w:val="${LIST_STYLE_ID}"/><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${numId}"/></w:numPr>${jc}`,
            this.runs(b.runs),
          );
          break;
        }
        case 'code':
          out += this.paragraph(
            `<w:pStyle w:val="${CODE_STYLE_ID}"/>`,
            this.run({ text: b.text || ' ' }),
          );
          break;
        case 'divider':
          out += this.paragraph(ruleUnder(DIVIDER_HEX), '');
          break;
        case 'pageBreak':
          out += this.paragraph('', '<w:r><w:br w:type="page"/></w:r>');
          break;
        case 'image':
          out += this.image(b);
          break;
        case 'table':
          // Word runs two tables straight after each other together, and a body ends on a paragraph: an empty
          // paragraph follows each table.
          out += this.table(b) + '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>';
          break;
        case 'docxToc':
          out += this.toc(b);
          break;
      }
    }
    return out + this.flushAnchors();
  }
}

/** The body's XML for the blocks, its relationships numbered from `firstRelId`. */
export function docxBody(
  blocks: readonly DocxBlock[],
  look: DocxLook,
  firstRelId: number,
  textWidthPx: number = FALLBACK_TEXT_WIDTH_PX,
): DocxBodyOut {
  const w = new BodyWriter(look, firstRelId, textWidthPx);
  const xml = w.blocks(blocks);
  return { xml, rels: w.rels, media: w.media, numberedRuns: w.numberedRuns };
}
