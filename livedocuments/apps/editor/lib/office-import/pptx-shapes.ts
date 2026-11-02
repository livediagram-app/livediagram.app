// What a slide's shapes say, read the way PowerPoint draws them (docs/specs/020-import-export/blueprints/
// office-import.md "readPptx"): a placeholder with no box of its own takes its layout's, then its master's; its text
// size and anchor are inherited the same way; a text body becomes one label with bullets and indents in its text.
// Pure over parsed parts.

import type { TextAlignX, TextAlignY } from '@liveworkspace/model-core/basics';
import { child, find, intAttr, kids, path, textOf, type XmlElement } from './xml';

export type EmuBox = { x: number; y: number; cx: number; cy: number };

export type PlaceholderType = 'title' | 'body' | 'other';

/** A placeholder's identity on a slide: its normalised type and its index. */
export type PlaceholderRef = { type: PlaceholderType; rawType: string; idx?: string };

/** The parts a slide's placeholders inherit from, in order: its layout, then its master. */
export type Inheritance = { layout?: XmlElement; master?: XmlElement };

const OTHER_TYPES = new Set([
  'dt',
  'ftr',
  'sldNum',
  'hdr',
  'sldImg',
  'chart',
  'tbl',
  'clipArt',
  'dgm',
  'media',
  'pic',
]);

export function placeholderOf(shape: XmlElement): PlaceholderRef | undefined {
  const nv = kids(shape).find((c) => c.name.startsWith('p:nv'));
  const ph = path(nv, 'p:nvPr', 'p:ph');
  if (!ph) return undefined;
  const rawType = ph.attrs.type ?? 'obj';
  const type: PlaceholderType =
    rawType === 'title' || rawType === 'ctrTitle'
      ? 'title'
      : OTHER_TYPES.has(rawType)
        ? 'other'
        : 'body';
  return { type, rawType, ...(ph.attrs.idx !== undefined ? { idx: ph.attrs.idx } : {}) };
}

/** The shape on a layout or master a placeholder inherits from: by index on a layout, else by type. */
export function inheritedShape(
  tree: XmlElement | undefined,
  ref: PlaceholderRef,
  byIndex: boolean,
): XmlElement | undefined {
  const shapes = kids(tree).filter((c) => c.name === 'p:sp');
  if (byIndex && ref.idx !== undefined) {
    const same = shapes.find((s) => placeholderOf(s)?.idx === ref.idx);
    if (same) return same;
  }
  return (
    shapes.find((s) => placeholderOf(s)?.rawType === ref.rawType) ??
    shapes.find((s) => {
      const other = placeholderOf(s);
      return other !== undefined && other.type === ref.type && ref.type !== 'other';
    })
  );
}

/** A shape tree's root (`p:cSld/p:spTree`). */
export const spTreeOf = (part: XmlElement | undefined) => path(part, 'p:cSld', 'p:spTree');

/** The `a:xfrm` box of a shape's properties (`p:spPr`, `p:grpSpPr`, `p:xfrm` on a graphic frame). */
export function boxOf(shape: XmlElement | undefined): EmuBox | undefined {
  if (!shape) return undefined;
  const xfrm =
    child(child(shape, 'p:spPr') ?? child(shape, 'p:grpSpPr'), 'a:xfrm') ?? child(shape, 'p:xfrm');
  const off = child(xfrm, 'a:off');
  const ext = child(xfrm, 'a:ext');
  if (!off || !ext) return undefined;
  const box = {
    x: intAttr(off, 'x') ?? 0,
    y: intAttr(off, 'y') ?? 0,
    cx: intAttr(ext, 'cx') ?? 0,
    cy: intAttr(ext, 'cy') ?? 0,
  };
  return box.cx > 0 && box.cy > 0 ? box : undefined;
}

/** A group's mapping of its children's boxes into its parent's space. */
export type GroupMap = (box: EmuBox) => EmuBox;

export const IDENTITY: GroupMap = (b) => b;

export function groupMap(group: XmlElement, outer: GroupMap): GroupMap {
  const xfrm = path(group, 'p:grpSpPr', 'a:xfrm');
  const off = child(xfrm, 'a:off');
  const ext = child(xfrm, 'a:ext');
  const chOff = child(xfrm, 'a:chOff');
  const chExt = child(xfrm, 'a:chExt');
  if (!off || !ext || !chOff || !chExt) return outer;
  const sx = (intAttr(ext, 'cx') ?? 0) / Math.max(1, intAttr(chExt, 'cx') ?? 1);
  const sy = (intAttr(ext, 'cy') ?? 0) / Math.max(1, intAttr(chExt, 'cy') ?? 1);
  const ox = intAttr(off, 'x') ?? 0;
  const oy = intAttr(off, 'y') ?? 0;
  const cx = intAttr(chOff, 'x') ?? 0;
  const cy = intAttr(chOff, 'y') ?? 0;
  return (b) =>
    outer({ x: ox + (b.x - cx) * sx, y: oy + (b.y - cy) * sy, cx: b.cx * sx, cy: b.cy * sy });
}

// --- Text ---------------------------------------------------------------------------------------------------------

export type TextBody = {
  label: string;
  /** The first run's own size, in points, when it states one. */
  sizePt?: number;
  /** The first paragraph's own alignment, when it states one. */
  alignX?: TextAlignX;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

const on = (v: string | undefined) => v === '1' || v === 'true';

/** A text body as one label: a line a paragraph, bullets and numbers written in, two spaces of indent a level. */
export function readTextBody(
  txBody: XmlElement | undefined,
  bulletedByDefault: (level: number) => boolean,
): TextBody | undefined {
  if (!txBody) return undefined;
  const lines: string[] = [];
  let sizePt: number | undefined;
  let alignX: TextAlignX | 'inherit' | undefined;
  let runs = 0;
  let bold = 0;
  let italic = 0;
  let underline = 0;
  // Numbered paragraphs count along consecutive ones at the same level.
  const counters = new Map<number, number>();
  for (const p of kids(txBody)) {
    if (p.name !== 'a:p') continue;
    const pPr = child(p, 'a:pPr');
    const level = Math.max(0, Math.min(8, intAttr(pPr, 'lvl') ?? 0));
    let text = '';
    for (const r of kids(p)) {
      if (r.name === 'a:br') {
        text += '\n';
        continue;
      }
      if (r.name !== 'a:r' && r.name !== 'a:fld') continue;
      const t = textOf(child(r, 'a:t'));
      if (!t) continue;
      text += t;
      const rPr = child(r, 'a:rPr');
      if (t.trim() !== '') {
        runs += 1;
        if (on(rPr?.attrs.b)) bold += 1;
        if (on(rPr?.attrs.i)) italic += 1;
        if (rPr?.attrs.u !== undefined && rPr.attrs.u !== 'none') underline += 1;
      }
      const sz = intAttr(rPr, 'sz');
      if (sizePt === undefined && sz !== undefined && sz > 0) sizePt = sz / 100;
    }
    if (alignX === undefined && text.trim() !== '') alignX = alignOf(pPr) ?? 'inherit';
    let marker = '';
    if (text.trim() !== '') {
      if (child(pPr, 'a:buAutoNum')) {
        const n = (counters.get(level) ?? 0) + 1;
        counters.set(level, n);
        marker = `${n}. `;
      } else {
        counters.delete(level);
        if (child(pPr, 'a:buChar') || (bulletedByDefault(level) && !child(pPr, 'a:buNone')))
          marker = '• ';
      }
    } else counters.clear();
    lines.push(text.trim() === '' ? '' : `${'  '.repeat(level)}${marker}${text}`);
  }
  while (lines.length > 0 && lines[0] === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  if (lines.length === 0) return undefined;
  return {
    label: lines.join('\n'),
    ...(sizePt !== undefined ? { sizePt } : {}),
    ...(alignX !== undefined && alignX !== 'inherit' ? { alignX } : {}),
    bold: runs > 0 && bold === runs,
    italic: runs > 0 && italic === runs,
    underline: runs > 0 && underline === runs,
  };
}

/** A paragraph properties' alignment, if it states one. */
function alignOf(pPr: XmlElement | undefined): TextAlignX | undefined {
  const algn = pPr?.attrs.algn;
  if (algn === undefined) return undefined;
  return algn === 'ctr' ? 'center' : algn === 'r' ? 'right' : 'left';
}

/** The level-1 alignment a shape's own list style gives, if any. */
export function listStyleAlignOf(shape: XmlElement | undefined): TextAlignX | undefined {
  return alignOf(path(shape, 'p:txBody', 'a:lstStyle', 'a:lvl1pPr'));
}

/** The alignment a master's text styles give a placeholder of this type, if any. */
export function masterStyleAlign(
  master: XmlElement | undefined,
  type: PlaceholderType,
): TextAlignX | undefined {
  const styles = child(master, 'p:txStyles');
  const style = child(
    styles,
    type === 'title' ? 'p:titleStyle' : type === 'body' ? 'p:bodyStyle' : 'p:otherStyle',
  );
  return alignOf(child(style, 'a:lvl1pPr'));
}

/** A shape's vertical anchor, if it states one. */
export function anchorOf(shape: XmlElement | undefined): TextAlignY | undefined {
  const a = path(shape, 'p:txBody', 'a:bodyPr')?.attrs.anchor;
  return a === 'ctr' ? 'middle' : a === 'b' ? 'bottom' : a === 't' ? 'top' : undefined;
}

/** The level-1 default size (points) a shape's own list style gives, if any. */
export function listStyleSizeOf(shape: XmlElement | undefined): number | undefined {
  const sz = intAttr(path(shape, 'p:txBody', 'a:lstStyle', 'a:lvl1pPr', 'a:defRPr'), 'sz');
  return sz !== undefined && sz > 0 ? sz / 100 : undefined;
}

/** The size (points) a master's text styles give a placeholder of this type. */
export function masterStyleSize(
  master: XmlElement | undefined,
  type: PlaceholderType,
): number | undefined {
  const styles = child(master, 'p:txStyles');
  const style = child(
    styles,
    type === 'title' ? 'p:titleStyle' : type === 'body' ? 'p:bodyStyle' : 'p:otherStyle',
  );
  const sz = intAttr(path(style, 'a:lvl1pPr', 'a:defRPr'), 'sz');
  return sz !== undefined && sz > 0 ? sz / 100 : undefined;
}

/** `a:normAutofit`'s font scale (1 when the text is not shrunk to fit). */
export function fontScaleOf(shape: XmlElement | undefined): number {
  const fit = find(path(shape, 'p:txBody', 'a:bodyPr'), 'a:normAutofit');
  const scale = intAttr(fit, 'fontScale');
  return scale !== undefined && scale > 0 ? scale / 100_000 : 1;
}

/** Whether a list style's level turns bullets on (true), off (false), or says nothing (undefined). */
function levelBullet(lstStyle: XmlElement | undefined, level: number): boolean | undefined {
  const lvl = child(lstStyle, `a:lvl${level + 1}pPr`);
  if (child(lvl, 'a:buNone')) return false;
  if (child(lvl, 'a:buChar') || child(lvl, 'a:buAutoNum')) return true;
  return undefined;
}

/** Whether a shape's paragraphs at a level are bulleted when they say nothing themselves: the first list style that
 *  says (the shape's, its layout's, its master's, then the master's body text style for a body placeholder), else a
 *  body placeholder's are and every other shape's are not. */
export function bulletDefault(
  shapes: readonly (XmlElement | undefined)[],
  master: XmlElement | undefined,
  type: PlaceholderType | undefined,
): (level: number) => boolean {
  return (level) => {
    for (const s of shapes) {
      const said = levelBullet(path(s, 'p:txBody', 'a:lstStyle'), level);
      if (said !== undefined) return said;
    }
    if (type !== 'body') return false;
    return levelBullet(path(master, 'p:txStyles', 'p:bodyStyle'), level) ?? true;
  };
}

/** The default sizes when nothing states one (points). */
export const DEFAULT_SIZE_PT: Record<PlaceholderType | 'none', number> = {
  title: 44,
  body: 28,
  other: 18,
  none: 18,
};
