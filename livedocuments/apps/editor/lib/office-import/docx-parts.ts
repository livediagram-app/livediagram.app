// The Word reader's small pure parts (docx.ts walks the body with them): a to-do's box, a paragraph's alignment, a
// field's link or contents switch, a table's rows and cells, trimmed runs, and a VML picture's size.

import {
  ARTICLE_LIST_MAX_LEVEL,
  isSafeArticleHref,
  type ArticleAlign,
  type ArticleRun,
} from '@livedocuments/document';
import { child, kids, type XmlElement } from './xml';

// A to-do's box at the start of a paragraph, as Word's check boxes and the Word export write it, and whether it is
// ticked (docs/specs/020-import-export/office-import.md "Word becomes an article").
const TODO_BOXES: Record<string, boolean> = { '☐': false, '☒': true, '☑': true };
// The Word export's to-do indent: 20 px, then 28 px a level, at 15 twips a px (office-export/docx-body.ts).
export const todoLevelOf = (twips: number) =>
  Math.min(ARTICLE_LIST_MAX_LEVEL, Math.max(0, Math.round((twips / 15 - 20) / 28)));

/** The to-do a paragraph's runs start with, its box cut from them; undefined when they start with no box. */
export function readTodo(runs: ArticleRun[]): { checked: boolean; runs: ArticleRun[] } | undefined {
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

export const ALIGN: Record<string, ArticleAlign> = {
  center: 'center',
  right: 'right',
  end: 'right',
  both: 'justify',
  distribute: 'justify',
};

const HYPERLINK = /^\s*HYPERLINK\s+"([^"]+)"/i;
// A table of contents field, and the heading levels its \o switch lists ("1-3"). One with \c or \a lists captions
// (a table of figures), not headings: its result stays as written.
const TOC_FIELD = /^\s*TOC\b/i;
const TOC_CAPTIONS = /\\[ca]\b/i;
export const TOC_LEVELS = /\\o\s+"\s*\d+\s*-\s*(\d+)\s*"/i;
export const isContentsField = (instr: string) =>
  TOC_FIELD.test(instr) && !TOC_CAPTIONS.test(instr);

/** A field's link address, when it is a HYPERLINK to an address an article keeps. */
export function fieldHref(instr: string): string | undefined {
  const m = HYPERLINK.exec(instr);
  return m && isSafeArticleHref(m[1]) ? m[1].trim() : undefined;
}

/** A table's rows or a row's cells (`name`), in order, looking inside content controls and custom XML. */
export function tableParts(
  el: XmlElement | undefined,
  name: string,
  out: XmlElement[] = [],
): XmlElement[] {
  for (const c of kids(el)) {
    if (c.name === name) out.push(c);
    else if (c.name === 'w:sdt') tableParts(child(c, 'w:sdtContent'), name, out);
    else if (c.name === 'w:customXml') tableParts(c, name, out);
  }
  return out;
}

/** Runs with the paragraph's leading and trailing whitespace removed, line breaks inside kept. */
export function trimRuns(runs: ArticleRun[]): ArticleRun[] {
  const out = runs.map((r) => ({ ...r }));
  while (out.length > 0 && out[0]!.text.trimStart() === '') out.shift();
  while (out.length > 0 && out[out.length - 1]!.text.trimEnd() === '') out.pop();
  if (out.length === 0) return out;
  out[0]!.text = out[0]!.text.trimStart();
  out[out.length - 1]!.text = out[out.length - 1]!.text.trimEnd();
  return out;
}

// The CSS lengths a VML shape's style gives its size in, as px (96 to the inch); no unit is px.
const VML_PX_PER: Record<string, number> = {
  '': 1,
  px: 1,
  pt: 96 / 72,
  pc: 16,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
};

/** A VML shape's width and height (`width:120pt;height:3cm`), in px; an unknown unit reads as 0. */
export function vmlSize(style: string): { width: number; height: number } {
  const read = (key: string) => {
    const m = new RegExp(`(?:^|;)\\s*${key}\\s*:\\s*([\\d.]+)\\s*([a-z]*)`, 'i').exec(style);
    const per = m ? VML_PX_PER[m[2]!.toLowerCase()] : undefined;
    const px = per === undefined ? 0 : Number(m![1]) * per;
    return Number.isFinite(px) ? Math.round(px) : 0;
  };
  return { width: read('width'), height: read('height') };
}
