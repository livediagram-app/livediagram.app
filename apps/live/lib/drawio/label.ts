// A draw.io label to livediagram text (docs/specs/020-import-export/blueprints/drawio-import.md
// step 8). HTML labels are PARSED, never rendered: DOMParser('text/html') is an
// inert document (no scripts, no loads), and only text plus a closed set of
// formats is read out of it.

import { normalizeRuns, type RunHeading, type RunSize, type TextRun } from '@livediagram/document';
import { htmlFontSizePx } from './text-size';
import { hexOf } from './colour';

export type DrawioLabel = { plain: string; runs?: TextRun[] };

// A run's format while walking; `px` is the span's font size, mapped to a run size at the end.
type Format = Omit<TextRun, 'text' | 'size'> & { px?: number };

/** A span's px as a run size, or undefined to inherit the label's. */
export type RunSizeOf = (px: number) => RunSize | undefined;

const BLOCKS = new Set([
  'div',
  'p',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'tr',
  'blockquote',
  'pre',
  'ul',
  'ol',
  'table',
]);
const SKIPPED = new Set(['script', 'style', 'noscript', 'template', 'head', 'title']);
const SAFE_LINK = /^(https?:|mailto:)/i;

function formatOf(el: Element, inherited: Format): Format {
  const f: Format = { ...inherited };
  const tag = el.localName;
  if (tag === 'b' || tag === 'strong') f.bold = true;
  if (tag === 'i' || tag === 'em') f.italic = true;
  if (tag === 'u') f.underline = true;
  if (tag === 's' || tag === 'strike' || tag === 'del') f.strikethrough = true;
  if (/^h[1-3]$/.test(tag)) f.heading = Number(tag[1]) as RunHeading;
  if (/^h[4-6]$/.test(tag)) f.bold = true;
  if (tag === 'font') {
    const color = hexOf(el.getAttribute('color') ?? undefined);
    if (color) f.color = color;
    const px = htmlFontSizePx(Number(el.getAttribute('size')));
    if (px !== undefined) f.px = px;
  }
  if (tag === 'a') {
    const href = el.getAttribute('href')?.trim() ?? '';
    if (SAFE_LINK.test(href)) f.link = href;
  }
  const style = (el as HTMLElement).style;
  if (style) {
    const weight = style.fontWeight;
    if (weight === 'bold' || weight === 'bolder' || Number(weight) >= 600) f.bold = true;
    if (style.fontStyle === 'italic') f.italic = true;
    const decoration = `${style.textDecoration} ${style.textDecorationLine}`;
    if (decoration.includes('underline')) f.underline = true;
    if (decoration.includes('line-through')) f.strikethrough = true;
    const color = hexOf(style.color || undefined);
    if (color) f.color = color;
    const px = /^([\d.]+)px$/.exec(style.fontSize ?? '')?.[1];
    if (px !== undefined && Number(px) > 0) f.px = Number(px);
  }
  return f;
}

// One character per entry, with the format it carries, so line trimming and
// empty-line collapsing can work on text without losing the formatting.
type Glyph = { ch: string; f: Format };

/**
 * A cell value as text and runs. `nl2Br` is draw.io's own switch (on unless the style says `nl2Br=0`):
 * a line feed in an HTML label draws as a line break.
 */
export function readLabel(
  value: string,
  html: boolean,
  sizeOf?: RunSizeOf,
  nl2Br = true,
): DrawioLabel {
  if (!html) return { plain: value.replace(/\r\n?/g, '\n') };
  if (value.trim() === '') return { plain: '' };

  const source = nl2Br ? value.replace(/\r\n?|\n/g, '<br>') : value;
  const body = new DOMParser().parseFromString(source, 'text/html').body;
  const out: Glyph[] = [];
  const endsWithBreak = () => out.length === 0 || out[out.length - 1]!.ch === '\n';
  const push = (text: string, f: Format) => {
    for (const ch of text) out.push({ ch, f });
  };
  const blockBreak = () => {
    if (!endsWithBreak()) push('\n', {});
  };

  const walk = (node: Node, f: Format, pre: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.textContent ?? '';
      push((pre ? raw : raw.replace(/[ \t\n\r\f]+/g, ' ')).replace(/\u00a0/g, ' '), f);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.localName;
    if (SKIPPED.has(tag)) return;
    if (tag === 'br') {
      push('\n', {});
      return;
    }
    const block = BLOCKS.has(tag);
    if (block) blockBreak();
    const format = formatOf(el, f);
    if (tag === 'li') {
      const list = el.parentElement;
      const ordered = list?.localName === 'ol';
      const index = list ? Array.from(list.children).indexOf(el) + 1 : 1;
      push(ordered ? `${index}. ` : '• ', f);
    }
    if ((tag === 'td' || tag === 'th') && el.previousElementSibling) push('\t', f);
    for (const child of Array.from(el.childNodes)) walk(child, format, pre || tag === 'pre');
    if (block) blockBreak();
  };
  for (const child of Array.from(body.childNodes)) walk(child, {}, false);

  // Lines trimmed at both ends, outer empty lines dropped, inner runs of
  // empty lines collapsed to one.
  const lines: Glyph[][] = [[]];
  for (const g of out) {
    if (g.ch === '\n') lines.push([]);
    else lines[lines.length - 1]!.push(g);
  }
  const trimmed = lines.map((line) => {
    let a = 0;
    let b = line.length;
    while (a < b && line[a]!.ch === ' ') a++;
    while (b > a && (line[b - 1]!.ch === ' ' || line[b - 1]!.ch === '\t')) b--;
    return line.slice(a, b);
  });
  while (trimmed.length > 0 && trimmed[0]!.length === 0) trimmed.shift();
  while (trimmed.length > 0 && trimmed[trimmed.length - 1]!.length === 0) trimmed.pop();
  const kept = trimmed.filter((line, i) => line.length > 0 || trimmed[i - 1]?.length !== 0);

  const runs: TextRun[] = [];
  kept.forEach((line, i) => {
    if (i > 0) runs.push({ text: '\n' });
    for (const g of line) {
      const { px, ...format } = g.f;
      const size = px !== undefined ? sizeOf?.(px) : undefined;
      runs.push({ text: g.ch, ...format, ...(size ? { size } : {}) });
    }
  });
  const normalised = normalizeRuns(runs);
  const plain = normalised.map((r) => r.text).join('');
  const formatted = normalised.some((r) => Object.keys(r).length > 1);
  return formatted ? { plain, runs: normalised } : { plain };
}

/** A cell's label as draw.io draws it: its value, HTML or not, line feeds per its `nl2Br`. */
export const cellLabel = (
  cell: { value: string; html: boolean; style: { str(key: string): string | undefined } },
  sizeOf?: RunSizeOf,
): DrawioLabel => readLabel(cell.value, cell.html, sizeOf, cell.style.str('nl2Br') !== '0');
