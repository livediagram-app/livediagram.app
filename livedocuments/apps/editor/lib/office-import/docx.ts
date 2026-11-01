// A Word document's body read into article blocks (docs/specs/020-import-export/office-import.md "Word becomes an
// article"; the blueprint's "readDocx" is the precise mapping). Pictures come out as blocks of their own, to become
// object zones once the image pipeline has stored them; everything left out is counted for the report. Pure over an
// opened package.

import {
  ARTICLE_LIST_MAX_LEVEL,
  MAX_ARTICLE_BLOCK_TEXT,
  MAX_ARTICLE_BLOCKS,
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
  runMarks,
  type DocxNumbering,
  type DocxStyles,
} from './docx-styles';
import { EMU_PER_PX } from './limits';
import type { OfficePackage, OfficeRel } from './package';
import { addSkip, type SkipTally } from './tally';
import { child, find, intAttr, kids, textOf, type XmlElement } from './xml';

/** A picture inside the file an element shows. */
export type OfficePicture = {
  /** The picture part's path in the package, the key it is stored by. */
  path: string;
  widthPx: number;
  heightPx: number;
  alt?: string;
  cropped?: true;
};

export type DocxBlock = ArticleBlock | { id: string; type: 'picture'; picture: OfficePicture };

export type DocxRead = { blocks: DocxBlock[]; pictures: OfficePicture[]; tally: SkipTally };

type Field = { instr: string; result: boolean; href?: string };

type Para = {
  style?: ArticleParagraphStyle;
  align?: ArticleAlign;
  list?: { kind: ArticleListKind; level: number };
  // The paragraph's left indent in twips, read for a to-do's level.
  indent?: number;
  code: boolean;
};

// A to-do's box at the start of a paragraph, as Word's check boxes and the Word export write it, and whether it is
// ticked (docs/specs/020-import-export/office-import.md "Word becomes an article").
const TODO_BOXES: Record<string, boolean> = { '☐': false, '☒': true, '☑': true };
// The Word export's to-do indent: 20 px, then 28 px a level, at 15 twips a px (office-export/docx-body.ts).
const todoLevelOf = (twips: number) =>
  Math.min(ARTICLE_LIST_MAX_LEVEL, Math.max(0, Math.round((twips / 15 - 20) / 28)));

/** The to-do a paragraph's runs start with, its box cut from them; undefined when they start with no box. */
function readTodo(runs: ArticleRun[]): { checked: boolean; runs: ArticleRun[] } | undefined {
  const out = trimRuns(runs);
  const first = out[0];
  if (!first) return undefined;
  const checked = TODO_BOXES[first.text[0] ?? ''];
  const after = first.text[1];
  if (checked === undefined || (after !== undefined && after !== ' ' && after !== '\u00a0'))
    return undefined;
  // The box may be a run of its own (the export writes "☐ " alone), so the space after it can open the next run.
  first.text = first.text.slice(1);
  const rest = trimRuns(out.filter((r) => r.text !== ''));
  if (rest.length === 0) return undefined;
  return {
    checked,
    runs: checked ? rest.map(({ s: _s, ...r }) => r) : rest,
  };
}

const ALIGN: Record<string, ArticleAlign> = {
  center: 'center',
  right: 'right',
  end: 'right',
  both: 'justify',
  distribute: 'justify',
};

const HYPERLINK = /^\s*HYPERLINK\s+"([^"]+)"/i;

/** A field's link address, when it is a HYPERLINK to an address an article keeps. */
function fieldHref(instr: string): string | undefined {
  const m = HYPERLINK.exec(instr);
  return m && isSafeArticleHref(m[1]) ? m[1].trim() : undefined;
}

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

  constructor(styles: DocxStyles, numbering: DocxNumbering, rels: Map<string, OfficeRel>) {
    this.styles = styles;
    this.numbering = numbering;
    this.rels = rels;
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
    const numPr = child(pPr, 'w:numPr') ?? this.styles.numPrOf(styleId);
    let list: Para['list'];
    const numId = child(numPr, 'w:numId')?.attrs['w:val'];
    if (numId !== undefined && !role.style) {
      const level = Math.min(
        ARTICLE_LIST_MAX_LEVEL,
        Math.max(0, intAttr(child(numPr, 'w:ilvl'), 'w:val') ?? 0),
      );
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
        case 'w:footnoteReference':
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
      if (field) {
        field.result = true;
        field.href = fieldHref(field.instr);
      }
    } else if (type === 'end') this.fields.pop();
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
    for (const tr of kids(tbl)) {
      if (tr.name !== 'w:tr') continue;
      if (grid.length === 0) {
        const flag = child(child(tr, 'w:trPr'), 'w:tblHeader')?.attrs['w:val'];
        header = !!child(child(tr, 'w:trPr'), 'w:tblHeader') && flag !== 'false' && flag !== '0';
      }
      const row: ArticleRun[][] = [];
      for (const tc of kids(tr)) {
        if (tc.name !== 'w:tc') continue;
        this.runs = [];
        this.cell(tc, '\n');
        row.push(trimRuns(this.runs));
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
    for (const tr of kids(tbl)) {
      if (tr.name !== 'w:tr') continue;
      const row: ArticleRun[] = [];
      for (const tc of kids(tr)) {
        if (tc.name !== 'w:tc') continue;
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
    let first = true;
    for (const el of kids(tc)) {
      if (el.name === 'w:p') {
        const before = this.runs.length;
        if (!first) this.runs.push({ text: between });
        for (const c of kids(el)) this.inline(c, undefined);
        if (this.runs.length > before) first = false;
      } else if (el.name === 'w:tbl') {
        const outer = this.runs;
        this.table(el);
        this.runs = outer;
      } else if (el.name === 'w:sdt') {
        this.cell({ ...el, children: child(el, 'w:sdtContent')?.children ?? [] }, between);
      }
    }
  }
}

/** Runs with the paragraph's leading and trailing whitespace removed, line breaks inside kept. */
function trimRuns(runs: ArticleRun[]): ArticleRun[] {
  const out = runs.map((r) => ({ ...r }));
  while (out.length > 0 && out[0]!.text.trimStart() === '') out.shift();
  while (out.length > 0 && out[out.length - 1]!.text.trimEnd() === '') out.pop();
  if (out.length === 0) return out;
  out[0]!.text = out[0]!.text.trimStart();
  out[out.length - 1]!.text = out[out.length - 1]!.text.trimEnd();
  return out;
}

/** A VML shape's width and height (`width:120pt;height:80pt` or px), in px. */
function vmlSize(style: string): { width: number; height: number } {
  const read = (key: string) => {
    const m = new RegExp(`${key}\\s*:\\s*([\\d.]+)(pt|px|in)?`, 'i').exec(style);
    if (!m) return 0;
    const v = Number(m[1]);
    const unit = (m[2] ?? 'px').toLowerCase();
    return Math.round(unit === 'pt' ? (v * 96) / 72 : unit === 'in' ? v * 96 : v);
  };
  return { width: read('width'), height: read('height') };
}

export async function readDocx(pkg: OfficePackage): Promise<DocxRead> {
  const root = await pkg.readXml(pkg.mainPath);
  const rels = await pkg.rels(pkg.mainPath);
  const partOf = async (type: string) => {
    const rel = [...rels.values()].find((r) => r.type === type && !r.external);
    return rel ? pkg.readXml(rel.target) : undefined;
  };
  const styles = readStyles(await partOf('styles'));
  const numbering = readNumbering(await partOf('numbering'));
  const walker = new DocxWalker(styles, numbering, rels);
  walker.body(child(root, 'w:body'));
  if (walker.overflow) throw new OfficeImportError('too-many-blocks', walker.blocks.length);
  return { blocks: walker.blocks, pictures: walker.pictures, tally: walker.tally };
}
