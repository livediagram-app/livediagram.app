// A Word document's body read into article blocks (docs/specs/020-import-export/office-import.md "Word becomes an
// article"; the blueprint's "readDocx" is the precise mapping). Pictures come out as blocks of their own, to become
// object zones once the image pipeline has stored them; everything left out is counted for the report. Pure over an
// opened package.

import type { ImageCrop } from '@livedocuments/document';
import {
  ARTICLE_FOOTNOTE_REF,
  ARTICLE_LIST_MAX_LEVEL,
  MAX_ARTICLE_BLOCK_TEXT,
  MAX_ARTICLE_BLOCKS,
  MAX_ARTICLE_TABLE_COLS,
  isSafeArticleHref,
  nextArticleBlockId,
  normaliseRuns,
  tableFromGrid,
  type ArticleAlign,
  type ArticleBlock,
  type ArticleListKind,
  type ArticleParagraphStyle,
  type ArticleRun,
} from '@livedocuments/document';
import { OfficeImportError } from './errors';
import {
  readNumbering,
  readStyles,
  runHidden,
  runMarks,
  type DocxNumbering,
  type DocxStyles,
} from './docx-styles';
import { EMU_PER_PX } from './limits';
import type { OfficePackage, OfficeRel } from './package';
import { addSkip, type SkipTally } from './tally';
import { child, find, intAttr, kids, textOf, type XmlElement } from './xml';
import { readFootnotes } from './docx-footnotes';
import {
  ALIGN,
  fieldHref,
  isContentsField,
  readTodo,
  tableParts,
  TOC_LEVELS,
  todoLevelOf,
  trimRuns,
  vmlSize,
} from './docx-parts';

export { readFootnotes } from './docx-footnotes';

/** A picture inside the file an element shows. */
export type OfficePicture = {
  /** The picture part's path in the package, the key it is stored by. */
  path: string;
  widthPx: number;
  heightPx: number;
  alt?: string;
  cropped?: true;
  /** The part of the picture shown, from a PowerPoint `a:srcRect` (docs/specs/009-elements/picture-crop-and-mask.md). */
  crop?: ImageCrop;
};

export type DocxBlock = ArticleBlock | { id: string; type: 'picture'; picture: OfficePicture };

export type DocxRead = { blocks: DocxBlock[]; pictures: OfficePicture[]; tally: SkipTally };

type Field = { instr: string; result: boolean; href?: string; toc?: true };

type Para = {
  style?: ArticleParagraphStyle;
  align?: ArticleAlign;
  list?: { kind: ArticleListKind; level: number };
  // The paragraph's left indent in twips, read for a to-do's level.
  indent?: number;
  code: boolean;
};

class DocxWalker {
  readonly blocks: DocxBlock[] = [];
  readonly pictures: OfficePicture[] = [];
  readonly tally: SkipTally = {};
  private fields: Field[] = [];
  // The paragraph being written: its kind, the runs so far, and whether every run with text is in a code font.
  private para: Para = { code: false };
  private runs: ArticleRun[] = [];
  private allMono = true;
  // Inside a table cell, pictures and breaks are dropped.
  private inTable = 0;

  private readonly styles: DocxStyles;
  private readonly numbering: DocxNumbering;
  private readonly rels: Map<string, OfficeRel>;
  private readonly footnotes: ReadonlyMap<string, string>;

  constructor(
    styles: DocxStyles,
    numbering: DocxNumbering,
    rels: Map<string, OfficeRel>,
    footnotes: ReadonlyMap<string, string> = new Map(),
  ) {
    this.styles = styles;
    this.numbering = numbering;
    this.rels = rels;
    this.footnotes = footnotes;
  }

  body(body: XmlElement | undefined): void {
    for (const el of kids(body)) this.blockLevel(el);
  }

  private blockLevel(el: XmlElement): void {
    switch (el.name) {
      case 'w:p':
        this.paragraph(el);
        return;
      case 'w:tbl':
        this.table(el);
        return;
      case 'w:sdt':
        for (const c of kids(child(el, 'w:sdtContent'))) this.blockLevel(c);
        return;
      case 'w:customXml':
      case 'w:ins':
      case 'w:moveTo':
        for (const c of kids(el)) this.blockLevel(c);
        return;
      case 'w:altChunk':
        addSkip(this.tally, 'embedded');
        return;
      case 'w:sectPr':
        this.section(el);
        return;
      default:
        return;
    }
  }

  private section(sectPr: XmlElement): void {
    if (this.tally.headersFooters) return;
    if (
      kids(sectPr).some((c) => c.name === 'w:headerReference' || c.name === 'w:footerReference')
    ) {
      addSkip(this.tally, 'headersFooters');
    }
  }

  private paragraphKind(p: XmlElement): Para {
    const pPr = child(p, 'w:pPr');
    const styleId = child(pPr, 'w:pStyle')?.attrs['w:val'];
    const role = this.styles.roleOf(styleId, intAttr(child(pPr, 'w:outlineLvl'), 'w:val'));
    const align = ALIGN[child(pPr, 'w:jc')?.attrs['w:val'] ?? ''];
    // The numbering and its level are each the paragraph's own, else its style's: a paragraph in a list style may
    // state only its level.
    const ownNumPr = child(pPr, 'w:numPr');
    const styleNumPr = this.styles.numPrOf(styleId);
    let list: Para['list'];
    const numId = (child(ownNumPr, 'w:numId') ?? child(styleNumPr, 'w:numId'))?.attrs['w:val'];
    if (numId !== undefined && !role.style) {
      const ilvl = child(ownNumPr, 'w:ilvl') ?? child(styleNumPr, 'w:ilvl');
      const level = Math.min(ARTICLE_LIST_MAX_LEVEL, Math.max(0, intAttr(ilvl, 'w:val') ?? 0));
      const kind = this.numbering.kindOf(numId, level);
      if (kind) list = { kind, level };
    }
    const ind = child(pPr, 'w:ind');
    const indent = intAttr(ind, 'w:left') ?? intAttr(ind, 'w:start');
    return {
      ...(role.style ? { style: role.style } : {}),
      ...(align ? { align } : {}),
      ...(list ? { list } : {}),
      ...(indent !== undefined ? { indent } : {}),
      code: role.code === true,
    };
  }

  private paragraph(p: XmlElement): void {
    const pPr = child(p, 'w:pPr');
    // A table of contents' own title: the contents block draws its own.
    if (this.styles.isTocHeading(child(pPr, 'w:pStyle')?.attrs['w:val']) && !find(p, 'w:fldChar'))
      return;
    if (pPr && child(pPr, 'w:pageBreakBefore') && this.inTable === 0) this.pageBreak();
    const sectPr = child(pPr, 'w:sectPr');
    if (sectPr) this.section(sectPr);
    this.para = this.paragraphKind(p);
    this.runs = [];
    this.allMono = true;
    for (const c of kids(p)) this.inline(c, undefined);
    this.flush();
  }

  /** The paragraph so far as a block (or the next line of a code block), then a fresh one of the same kind. */
  private flush(): void {
    const runs = this.runs;
    this.runs = [];
    const allMono = this.allMono;
    this.allMono = true;
    const text = runs.map((r) => r.text).join('');
    if (text.trim() === '') return;
    if (this.para.code || (allMono && !this.para.style && !this.para.list)) {
      this.code(text);
      return;
    }
    if (text.length > MAX_ARTICLE_BLOCK_TEXT) addSkip(this.tally, 'longText');
    const trimmed = trimRuns(runs);
    const id = nextArticleBlockId();
    const todo = this.para.style ? undefined : readTodo(trimmed);
    if (todo) {
      const level = this.para.list?.level ?? todoLevelOf(this.para.indent ?? 0);
      this.push({
        id,
        type: 'list',
        list: 'todo',
        ...(level > 0 ? { level } : {}),
        ...(todo.checked ? { checked: true as const } : {}),
        ...(this.para.align ? { align: this.para.align } : {}),
        runs: normaliseRuns(todo.runs),
      });
      return;
    }
    if (this.para.list) {
      this.push({
        id,
        type: 'list',
        list: this.para.list.kind,
        ...(this.para.list.level > 0 ? { level: this.para.list.level } : {}),
        ...(this.para.align ? { align: this.para.align } : {}),
        runs: normaliseRuns(trimmed),
      });
      return;
    }
    this.push({
      id,
      type: 'paragraph',
      ...(this.para.style ? { style: this.para.style } : {}),
      ...(this.para.align ? { align: this.para.align } : {}),
      runs: normaliseRuns(trimmed),
    });
  }

  private code(text: string): void {
    const last = this.blocks[this.blocks.length - 1];
    if (last?.type === 'code') {
      const joined = `${last.text}\n${text}`;
      if (joined.length > MAX_ARTICLE_BLOCK_TEXT) addSkip(this.tally, 'longText');
      last.text = joined.slice(0, MAX_ARTICLE_BLOCK_TEXT);
      return;
    }
    if (text.length > MAX_ARTICLE_BLOCK_TEXT) addSkip(this.tally, 'longText');
    this.push({
      id: nextArticleBlockId(),
      type: 'code',
      text: text.slice(0, MAX_ARTICLE_BLOCK_TEXT),
    });
  }

  private push(block: DocxBlock): void {
    this.blocks.push(block);
    if (this.blocks.length > MAX_ARTICLE_BLOCKS) {
      // Counted on to the end, so the message can say how many it makes.
      this.overflow = true;
    }
  }
  overflow = false;

  private pageBreak(): void {
    this.flush();
    const last = this.blocks[this.blocks.length - 1];
    // Two breaks in a row make one: an article has no empty pages to keep.
    if (!last || last.type === 'pageBreak') return;
    this.push({ id: nextArticleBlockId(), type: 'pageBreak' });
  }

  private text(text: string, rPr: XmlElement | undefined, href: string | undefined): void {
    if (!text) return;
    // Instructions of a field are never shown; its result is, linked when the field is a HYPERLINK.
    const field = this.fields[this.fields.length - 1];
    if (field && !field.result) {
      field.instr += text;
      return;
    }
    // A table of contents' entries are the contents block's to draw (with the article's own page numbers).
    if (this.inToc()) return;
    // Hidden text is neither shown nor printed in Word.
    if (runHidden(rPr, this.styles)) return;
    const link = href ?? [...this.fields].reverse().find((f) => f.href)?.href;
    const marks = runMarks(rPr, this.styles);
    if (text.trim() !== '' && !marks.code) this.allMono = false;
    this.runs.push({ text, ...marks, ...(link ? { href: link } : {}) });
  }

  private inline(el: XmlElement, href: string | undefined): void {
    switch (el.name) {
      case 'w:r':
        this.run(el, href);
        return;
      case 'w:hyperlink': {
        const rel = el.attrs['r:id'] ? this.rels.get(el.attrs['r:id']) : undefined;
        const target = rel?.external ? rel.target : undefined;
        const link = isSafeArticleHref(target) ? target.trim() : undefined;
        for (const c of kids(el)) this.inline(c, link ?? href);
        return;
      }
      case 'w:fldSimple': {
        const link = fieldHref(el.attrs['w:instr'] ?? '') ?? href;
        for (const c of kids(el)) this.inline(c, link);
        return;
      }
      case 'w:ins':
      case 'w:moveTo':
      case 'w:smartTag':
      case 'w:customXml':
      case 'w:dir':
      case 'w:bdo':
        for (const c of kids(el)) this.inline(c, href);
        return;
      case 'w:sdt':
        for (const c of kids(child(el, 'w:sdtContent'))) this.inline(c, href);
        return;
      case 'mc:AlternateContent': {
        const choice = child(el, 'mc:Choice');
        for (const c of kids(choice)) this.inline(c, href);
        return;
      }
      case 'm:oMath':
      case 'm:oMathPara':
        addSkip(this.tally, 'equations');
        return;
      default:
        // w:del, w:moveFrom, w:proofErr, bookmarks, permissions: nothing to show.
        return;
    }
  }

  private run(r: XmlElement, href: string | undefined): void {
    const rPr = child(r, 'w:rPr');
    for (const c of kids(r)) {
      if (this.inToc() && c.name !== 'w:fldChar' && c.name !== 'w:instrText') continue;
      switch (c.name) {
        case 'w:t':
          this.text(textOf(c), rPr, href);
          break;
        case 'w:instrText': {
          const field = this.fields[this.fields.length - 1];
          if (field && !field.result) field.instr += textOf(c);
          break;
        }
        case 'w:fldChar':
          this.fieldChar(c.attrs['w:fldCharType']);
          break;
        case 'w:tab':
        case 'w:ptab':
          this.text(' ', rPr, href);
          break;
        case 'w:noBreakHyphen':
          this.text('-', rPr, href);
          break;
        case 'w:br':
        case 'w:cr':
          if (c.attrs['w:type'] === 'page') {
            if (this.inTable === 0) this.pageBreak();
          } else if (c.attrs['w:type'] !== 'column') this.text('\n', rPr, href);
          break;
        case 'w:drawing':
          this.drawing(c);
          break;
        case 'w:pict':
          this.vml(c);
          break;
        case 'w:object':
          addSkip(this.tally, 'embedded');
          break;
        case 'w:footnoteReference': {
          // A footnote comes in as one (docs/specs/007-editor/article-pages.md "Footnotes"), its note plain text.
          const note = this.footnotes.get(c.attrs['w:id'] ?? '');
          if (note === undefined) addSkip(this.tally, 'footnotes');
          else this.runs.push({ text: ARTICLE_FOOTNOTE_REF, fn: note });
          break;
        }
        case 'w:endnoteReference':
          addSkip(this.tally, 'footnotes');
          break;
        case 'w:commentReference':
          addSkip(this.tally, 'comments');
          break;
        case 'mc:AlternateContent': {
          const choice = child(c, 'mc:Choice');
          if (choice) this.run({ ...r, children: choice.children }, href);
          break;
        }
      }
    }
  }

  private fieldChar(type: string | undefined): void {
    if (type === 'begin') this.fields.push({ instr: '', result: false });
    else if (type === 'separate') {
      const field = this.fields[this.fields.length - 1];
      if (field && !field.result) {
        field.result = true;
        field.href = fieldHref(field.instr);
        if (isContentsField(field.instr) && this.inTable === 0 && !this.inToc()) {
          field.toc = true;
          this.contents(field.instr);
        }
      }
    } else if (type === 'end') this.fields.pop();
  }

  private inToc(): boolean {
    return this.fields.some((f) => f.toc);
  }

  /** A Word table of contents as a contents block listing Heading 1 to the deepest level its field lists (at most
   *  Heading 3); its entries, and their page numbers from Word's own pages, are left for the block to draw. */
  private contents(instr: string): void {
    this.flush();
    const levels = Number(TOC_LEVELS.exec(instr)?.[1] ?? 3);
    const depth = Math.min(3, Math.max(1, levels));
    this.push({
      id: nextArticleBlockId(),
      type: 'toc',
      ...(depth === 1 || depth === 2 ? { depth } : {}),
    });
  }

  private picture(
    rid: string | undefined,
    link: boolean,
    widthPx: number,
    heightPx: number,
    alt?: string,
  ): void {
    if (link || !rid) {
      addSkip(this.tally, 'linkedImages');
      return;
    }
    const rel = this.rels.get(rid);
    if (!rel || rel.external) {
      addSkip(this.tally, 'linkedImages');
      return;
    }
    if (this.inTable > 0) return;
    const picture: OfficePicture = { path: rel.target, widthPx, heightPx, ...(alt ? { alt } : {}) };
    this.flush();
    this.pictures.push(picture);
    this.push({ id: nextArticleBlockId(), type: 'picture', picture });
  }

  private drawing(d: XmlElement): void {
    const frame = child(d, 'wp:inline') ?? child(d, 'wp:anchor');
    if (!frame) return;
    const extent = child(frame, 'wp:extent');
    const w = Math.round((intAttr(extent, 'cx') ?? 0) / EMU_PER_PX);
    const h = Math.round((intAttr(extent, 'cy') ?? 0) / EMU_PER_PX);
    const docPr = child(frame, 'wp:docPr');
    const alt = (docPr?.attrs.descr || docPr?.attrs.title || '').trim() || undefined;
    const data = find(frame, 'a:graphicData');
    const uri = data?.attrs.uri ?? '';
    if (uri.endsWith('/picture')) {
      const blip = find(data, 'a:blip');
      const embed = blip?.attrs['r:embed'];
      this.picture(embed ?? blip?.attrs['r:link'], !embed, w, h, alt);
    } else if (uri.endsWith('/chart')) addSkip(this.tally, 'charts');
    else if (uri.endsWith('/diagram')) addSkip(this.tally, 'diagrams');
    else addSkip(this.tally, 'textBoxes');
  }

  private vml(pict: XmlElement): void {
    const image = find(pict, 'v:imagedata');
    if (image) {
      const shape = find(pict, 'v:shape');
      const size = vmlSize(shape?.attrs.style ?? '');
      this.picture(image.attrs['r:id'], false, size.width, size.height, shape?.attrs.alt);
      return;
    }
    addSkip(this.tally, 'textBoxes');
  }

  /** A table in the body: a table block (docs/specs/020-import-export/office-import.md), its rows and cells, each
   *  cell's paragraphs joined by line breaks, a repeated first row as its header row, merged cells read as one. A
   *  table cut to the table's caps is counted for the report. */
  private gridTable(tbl: XmlElement): void {
    this.flush();
    const saved = { para: this.para, allMono: this.allMono };
    this.inTable += 1;
    const grid: ArticleRun[][][] = [];
    let header = false;
    for (const tr of tableParts(tbl, 'w:tr')) {
      const trPr = child(tr, 'w:trPr');
      if (grid.length === 0) {
        const flag = child(trPr, 'w:tblHeader')?.attrs['w:val'];
        header = !!child(trPr, 'w:tblHeader') && flag !== 'false' && flag !== '0';
      }
      // Grid columns the row skips at its start, and those a merged cell covers past its first, are empty cells,
      // so every cell stays in its own column (bounded: past the table's cap they are cut anyway).
      const row: ArticleRun[][] = [];
      const pad = (n: number | undefined) => {
        for (let i = 0; i < (n ?? 0) && row.length <= MAX_ARTICLE_TABLE_COLS; i++) row.push([]);
      };
      const cells = tableParts(tr, 'w:tc');
      if (cells.length > 0) pad(intAttr(child(trPr, 'w:gridBefore'), 'w:val'));
      for (const tc of cells) {
        this.runs = [];
        this.cell(tc, '\n');
        row.push(trimRuns(this.runs));
        pad((intAttr(child(child(tc, 'w:tcPr'), 'w:gridSpan'), 'w:val') ?? 1) - 1);
      }
      // A row with no cell at all holds nothing to keep.
      if (row.length > 0) grid.push(row);
    }
    this.inTable -= 1;
    this.para = saved.para;
    this.allMono = saved.allMono;
    this.runs = [];
    const block = tableFromGrid(nextArticleBlockId(), grid, header);
    if (!block) return;
    const width = grid.reduce((n, r) => Math.max(n, r.length), 0);
    if (block.rows.length < grid.length || block.cols.length < width) addSkip(this.tally, 'tables');
    this.push(block);
  }

  /** A table inside a table's cell: its rows read as text into the cell, cells joined by " · ". */
  private table(tbl: XmlElement): void {
    if (this.inTable === 0) {
      this.gridTable(tbl);
      return;
    }
    const saved = { para: this.para, runs: this.runs, allMono: this.allMono };
    this.inTable += 1;
    for (const tr of tableParts(tbl, 'w:tr')) {
      const row: ArticleRun[] = [];
      for (const tc of tableParts(tr, 'w:tc')) {
        this.runs = [];
        this.cell(tc, ' ');
        const cell = trimRuns(this.runs);
        if (cell.length === 0) continue;
        if (row.length > 0) row.push({ text: ' · ' });
        row.push(...cell);
      }
      this.runs = [];
      if (row.length > 0) saved.runs.push({ text: ' ' }, ...row);
    }
    this.inTable -= 1;
    this.para = saved.para;
    this.runs = saved.runs;
    this.allMono = saved.allMono;
  }

  /** A cell's paragraphs into the runs, `between` them (a line break in a table block's cell). */
  private cell(tc: XmlElement, between: string): void {
    this.cellParts(tc, between, { first: true });
  }

  /** The cell's paragraphs and tables under `el`, a content control or custom XML walked into with the same `at`, so
   *  a paragraph inside one still follows the one before it with `between`. */
  private cellParts(el: XmlElement | undefined, between: string, at: { first: boolean }): void {
    for (const c of kids(el)) {
      if (c.name === 'w:p') {
        const before = this.runs.length;
        if (!at.first) this.runs.push({ text: between });
        for (const r of kids(c)) this.inline(r, undefined);
        if (this.runs.length > before) at.first = false;
      } else if (c.name === 'w:tbl') {
        const outer = this.runs;
        this.table(c);
        this.runs = outer;
      } else if (c.name === 'w:sdt') {
        this.cellParts(child(c, 'w:sdtContent'), between, at);
      } else if (c.name === 'w:customXml') {
        this.cellParts(c, between, at);
      }
    }
  }
}

export async function readDocx(pkg: OfficePackage): Promise<DocxRead> {
  const root = await pkg.readXml(pkg.mainPath);
  const rels = await pkg.rels(pkg.mainPath);
  const partOf = async (type: string) => {
    const rel = [...rels.values()].find((r) => r.type === type && !r.external);
    return rel ? pkg.readXml(rel.target) : undefined;
  };
  const styles = readStyles(await partOf('styles'));
  const numbering = readNumbering(await partOf('numbering'), styles);
  const footnotes = readFootnotes(await partOf('footnotes'), styles);
  const walker = new DocxWalker(styles, numbering, rels, footnotes);
  walker.body(child(root, 'w:body'));
  if (walker.overflow) throw new OfficeImportError('too-many-blocks', walker.blocks.length);
  return { blocks: walker.blocks, pictures: walker.pictures, tally: walker.tally };
}
