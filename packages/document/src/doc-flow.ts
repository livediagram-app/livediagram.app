// The writing of a document page (docs/specs/007-editor/document-pages.md): a document's blocks in
// order and its style, stored once per document on the tab (`Tab.docs[flow]`), shared by every
// page of the document (`IllustratePage.flow`). Pure data and its reading: whatever is stored is
// read defensively, so a malformed block, run or field is dropped rather than trusted.

// Block and document limits (docs/specs/007-editor/document-pages.md "Blocks"). A document this
// large is ~250 pages of text, far inside a tab's row (MAX_TAB_BYTES, 1.99 MB) only when the
// text is too: the tab's own cap still has the last word on a save.
export const MAX_DOC_BLOCKS = 5000;
export const MAX_DOC_RUNS = 400;
export const MAX_DOC_BLOCK_TEXT = 20_000;
export const MAX_DOC_HREF = 2048;
// Zones: no wider or taller than the largest page (A3 landscape is 1587 wide), no smaller than a
// grip can still be pressed on.
export const DOC_ZONE_MIN = 24;
export const DOC_ZONE_MAX = 2000;
// List items step in 28 px a level, five levels deep.
export const DOC_LIST_MAX_LEVEL = 4;

export type DocAlign = 'left' | 'center' | 'right' | 'justify';
export const DOC_ALIGNS: readonly DocAlign[] = ['left', 'center', 'right', 'justify'];

export type DocParagraphStyle = 'body' | 'title' | 'subtitle' | 'h1' | 'h2' | 'h3' | 'quote';
export const DOC_PARAGRAPH_STYLES: readonly DocParagraphStyle[] = [
  'body',
  'title',
  'subtitle',
  'h1',
  'h2',
  'h3',
  'quote',
];

export type DocListKind = 'bullet' | 'numbered' | 'todo';
export const DOC_LIST_KINDS: readonly DocListKind[] = ['bullet', 'numbered', 'todo'];

export type DocZoneKind = 'object' | 'drawing';
export type DocZoneWrap = 'inline' | 'left' | 'right';
export const DOC_ZONE_WRAPS: readonly DocZoneWrap[] = ['inline', 'left', 'right'];
export type DocZoneAlign = 'left' | 'center' | 'right';

/** A stretch of text with one formatting. `text` may hold '\n', a line break inside the block. */
export type DocRun = {
  text: string;
  b?: true;
  i?: true;
  u?: true;
  s?: true;
  code?: true;
  sup?: true;
  sub?: true;
  // An http, https or mailto address.
  href?: string;
  // Hex colours from the document's swatches.
  color?: string;
  hl?: string;
};

export type DocParagraphBlock = {
  id: string;
  type: 'paragraph';
  // Absent is body text.
  style?: DocParagraphStyle;
  // Absent is left.
  align?: DocAlign;
  runs: DocRun[];
};

export type DocListBlock = {
  id: string;
  type: 'list';
  list: DocListKind;
  // Absent is 0.
  level?: number;
  checked?: true;
  align?: DocAlign;
  runs: DocRun[];
};

export type DocCodeBlock = { id: string; type: 'code'; text: string };
export type DocDividerBlock = { id: string; type: 'divider' };
export type DocPageBreakBlock = { id: string; type: 'pageBreak' };

export type DocZoneBlock = {
  id: string;
  type: 'zone';
  zone: DocZoneKind;
  // Absent is inline.
  wrap?: DocZoneWrap;
  // An inline zone's place across the text width; absent is centre.
  align?: DocZoneAlign;
  width: number;
  height: number;
  // Where the zone was last laid out: the page it fell on and its top-left from that page's
  // top-left corner (canvas px). Elements whose centre is inside it there are its elements
  // (docs/specs/007-editor/document-pages.md "Zones"). Absent until first laid out.
  at?: DocZoneAt;
};

export type DocZoneAt = { page: string; x: number; y: number };

export type DocBlock =
  | DocParagraphBlock
  | DocListBlock
  | DocCodeBlock
  | DocDividerBlock
  | DocPageBreakBlock
  | DocZoneBlock;

export type DocBlockType = DocBlock['type'];
export type DocTextBlock = DocParagraphBlock | DocListBlock;

export type DocLookId = 'clean' | 'classic' | 'report' | 'notebook' | 'bold';
export const DOC_LOOK_IDS: readonly DocLookId[] = [
  'clean',
  'classic',
  'report',
  'notebook',
  'bold',
];

export type DocTextSize = 'small' | 'normal' | 'large';
export type DocLineSpacing = 'single' | 'onehalf' | 'double';
export type DocParagraphSpacing = 'none' | 'normal' | 'wide';
export type DocRules = 'none' | 'title' | 'headings';
export type DocMargins = 'narrow' | 'normal' | 'wide';

/** A document's look (docs/specs/007-editor/document-pages.md "Document style"). Every field is
 *  optional, absent being its default (`resolveDocStyle`). */
export type DocStyle = {
  look?: DocLookId;
  headingFont?: string;
  bodyFont?: string;
  // A hex colour; absent is the tab theme's accent.
  accent?: string;
  accentHeadings?: boolean;
  textSize?: DocTextSize;
  lineSpacing?: DocLineSpacing;
  paragraphSpacing?: DocParagraphSpacing;
  rules?: DocRules;
  margins?: DocMargins;
  // Absent is on.
  pageNumbers?: boolean;
};

export type DocFlow = { blocks: DocBlock[]; style?: DocStyle };

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
export const isDocHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);

const SAFE_HREF = /^(?:https?:\/\/|mailto:)/i;
/** A link address a document keeps: http, https or mailto, no longer than MAX_DOC_HREF. */
export function isSafeDocHref(v: unknown): v is string {
  return typeof v === 'string' && v.length <= MAX_DOC_HREF && SAFE_HREF.test(v.trim());
}

const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;
const member = <T extends string>(list: readonly T[], v: unknown): v is T => list.includes(v as T);

const RUN_FLAGS = ['b', 'i', 'u', 's', 'code', 'sup', 'sub'] as const;

function parseRun(v: unknown): DocRun | undefined {
  const r = v as Record<string, unknown> | null;
  if (!r || typeof r !== 'object' || typeof r.text !== 'string' || r.text.length === 0)
    return undefined;
  const run: DocRun = { text: r.text };
  for (const flag of RUN_FLAGS) if (r[flag] === true) run[flag] = true;
  // Superscript and subscript are one or the other.
  if (run.sup && run.sub) delete run.sub;
  if (isSafeDocHref(r.href)) run.href = r.href.trim();
  if (isDocHex(r.color)) run.color = r.color;
  if (isDocHex(r.hl)) run.hl = r.hl;
  return run;
}

const sameFormat = (a: DocRun, b: DocRun): boolean =>
  RUN_FLAGS.every((f) => a[f] === b[f]) &&
  a.href === b.href &&
  a.color === b.color &&
  a.hl === b.hl;

/** Runs read defensively, neighbours of one format merged, empty ones dropped, the text capped at
 *  MAX_DOC_BLOCK_TEXT characters over at most MAX_DOC_RUNS runs. */
export function normaliseRuns(v: unknown): DocRun[] {
  if (!Array.isArray(v)) return [];
  const out: DocRun[] = [];
  let left = MAX_DOC_BLOCK_TEXT;
  for (const raw of v) {
    if (left <= 0) break;
    const run = parseRun(raw);
    if (!run) continue;
    if (run.text.length > left) run.text = run.text.slice(0, left);
    left -= run.text.length;
    const last = out[out.length - 1];
    if (last && sameFormat(last, run)) last.text += run.text;
    else if (out.length < MAX_DOC_RUNS) out.push(run);
    else break;
  }
  return out;
}

const clampSize = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.min(DOC_ZONE_MAX, Math.max(DOC_ZONE_MIN, Math.round(v)))
    : undefined;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** One stored block, or undefined when it is not one. Optional fields keep what is valid. */
export function parseDocBlock(v: unknown): DocBlock | undefined {
  const b = v as Record<string, unknown> | null;
  if (!b || typeof b !== 'object' || !isId(b.id)) return undefined;
  const id = b.id;
  const align = member(DOC_ALIGNS, b.align) && b.align !== 'left' ? { align: b.align } : {};
  switch (b.type) {
    case 'paragraph': {
      const style =
        member(DOC_PARAGRAPH_STYLES, b.style) && b.style !== 'body' ? { style: b.style } : {};
      return { id, type: 'paragraph', ...style, ...align, runs: normaliseRuns(b.runs) };
    }
    case 'list': {
      if (!member(DOC_LIST_KINDS, b.list)) return undefined;
      const level =
        finite(b.level) && b.level >= 1
          ? { level: Math.min(DOC_LIST_MAX_LEVEL, Math.floor(b.level)) }
          : {};
      const checked = b.list === 'todo' && b.checked === true ? { checked: true as const } : {};
      return {
        id,
        type: 'list',
        list: b.list,
        ...level,
        ...checked,
        ...align,
        runs: normaliseRuns(b.runs),
      };
    }
    case 'code':
      return {
        id,
        type: 'code',
        text: typeof b.text === 'string' ? b.text.slice(0, MAX_DOC_BLOCK_TEXT) : '',
      };
    case 'divider':
      return { id, type: 'divider' };
    case 'pageBreak':
      return { id, type: 'pageBreak' };
    case 'zone': {
      const width = clampSize(b.width);
      const height = clampSize(b.height);
      if (b.zone !== 'object' && b.zone !== 'drawing') return undefined;
      if (width === undefined || height === undefined) return undefined;
      const at = b.at as Record<string, unknown> | null | undefined;
      return {
        id,
        type: 'zone',
        zone: b.zone,
        ...(member(DOC_ZONE_WRAPS, b.wrap) && b.wrap !== 'inline' ? { wrap: b.wrap } : {}),
        ...(b.align === 'left' || b.align === 'right' ? { align: b.align } : {}),
        width,
        height,
        ...(at && typeof at === 'object' && isId(at.page) && finite(at.x) && finite(at.y)
          ? { at: { page: at.page, x: at.x, y: at.y } }
          : {}),
      };
    }
    default:
      return undefined;
  }
}

const STYLE_ENUMS = {
  textSize: ['small', 'normal', 'large'],
  lineSpacing: ['single', 'onehalf', 'double'],
  paragraphSpacing: ['none', 'normal', 'wide'],
  rules: ['none', 'title', 'headings'],
  margins: ['narrow', 'normal', 'wide'],
} as const;

const FONT_ID = /^[a-z0-9-]{1,40}$/;

export function parseDocStyle(v: unknown): DocStyle | undefined {
  const s = v as Record<string, unknown> | null;
  if (!s || typeof s !== 'object') return undefined;
  const out: DocStyle = {};
  if (member(DOC_LOOK_IDS, s.look)) out.look = s.look;
  if (typeof s.headingFont === 'string' && FONT_ID.test(s.headingFont))
    out.headingFont = s.headingFont;
  if (typeof s.bodyFont === 'string' && FONT_ID.test(s.bodyFont)) out.bodyFont = s.bodyFont;
  if (isDocHex(s.accent)) out.accent = s.accent;
  if (typeof s.accentHeadings === 'boolean') out.accentHeadings = s.accentHeadings;
  for (const [key, values] of Object.entries(STYLE_ENUMS)) {
    if ((values as readonly string[]).includes(s[key] as string))
      (out as Record<string, unknown>)[key] = s[key];
  }
  if (typeof s.pageNumbers === 'boolean') out.pageNumbers = s.pageNumbers;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** A stored document's writing, read defensively: unreadable blocks dropped, repeated ids
 *  dropped after the first, at most MAX_DOC_BLOCKS. Never empty: a document with no block reads
 *  as one empty paragraph. */
export function parseDocFlow(v: unknown, fallbackId = 'b-empty'): DocFlow {
  const f = v as Record<string, unknown> | null;
  const seen = new Set<string>();
  const blocks: DocBlock[] = [];
  if (f && typeof f === 'object' && Array.isArray(f.blocks)) {
    for (const raw of f.blocks) {
      if (blocks.length >= MAX_DOC_BLOCKS) break;
      const block = parseDocBlock(raw);
      if (!block || seen.has(block.id)) continue;
      seen.add(block.id);
      blocks.push(block);
    }
  }
  if (blocks.length === 0) blocks.push({ id: fallbackId, type: 'paragraph', runs: [] });
  const style = f && typeof f === 'object' ? parseDocStyle(f.style) : undefined;
  return style ? { blocks, style } : { blocks };
}

const parsedDocs = new WeakMap<object, Readonly<Record<string, DocFlow>>>();

/** The tab's documents' writing by flow id, each read defensively (`parseDocFlow`); the same
 *  object back for the same stored `docs`, so readers can memo on it. */
export function docsOf(tab: object | undefined): Readonly<Record<string, DocFlow>> {
  const docs = (tab as { docs?: unknown } | undefined)?.docs;
  if (!docs || typeof docs !== 'object' || Array.isArray(docs)) return EMPTY_DOCS;
  const cached = parsedDocs.get(docs);
  if (cached) return cached;
  const out: Record<string, DocFlow> = {};
  for (const [flow, raw] of Object.entries(docs)) {
    if (isId(flow)) out[flow] = parseDocFlow(raw, `${flow}-b0`);
  }
  parsedDocs.set(docs, out);
  return out;
}

const EMPTY_DOCS: Readonly<Record<string, DocFlow>> = Object.freeze({});

/** A new block id: `b-` and eight hex digits, never one in `taken`. */
export function nextDocBlockId(taken?: ReadonlySet<string>): string {
  let id: string;
  do id = `b-${crypto.randomUUID().slice(0, 8)}`;
  while (taken?.has(id));
  return id;
}

/** A new document's flow id: `doc-` and eight hex digits, never one in `taken`. */
export function nextDocFlowId(taken?: ReadonlySet<string>): string {
  let id: string;
  do id = `doc-${crypto.randomUUID().slice(0, 8)}`;
  while (taken?.has(id));
  return id;
}

/** A new document's writing: an empty Title and an empty paragraph. */
export function newDocFlow(): DocFlow {
  const title = nextDocBlockId();
  const body = nextDocBlockId(new Set([title]));
  return {
    blocks: [
      { id: title, type: 'paragraph', style: 'title', runs: [] },
      { id: body, type: 'paragraph', runs: [] },
    ],
  };
}

/** Whether a block holds formatted text (a paragraph or a list item). */
export function isDocTextBlock(b: DocBlock): b is DocTextBlock {
  return b.type === 'paragraph' || b.type === 'list';
}

/** A block's plain text: its runs joined, a code block's text, nothing for the rest. */
export function docBlockText(b: DocBlock): string {
  if (isDocTextBlock(b)) return b.runs.map((r) => r.text).join('');
  if (b.type === 'code') return b.text;
  return '';
}

/** How many words the writing holds (runs of non-space characters). */
export function docWordCount(blocks: readonly DocBlock[]): number {
  let n = 0;
  for (const b of blocks) {
    const words = docBlockText(b).match(/\S+/g);
    if (words) n += words.length;
  }
  return n;
}

/** A copy of a document's writing with every block given a fresh id (a duplicated document). */
export function withFreshDocBlockIds(flow: DocFlow): DocFlow {
  const taken = new Set<string>();
  const blocks = flow.blocks.map((b) => {
    const id = nextDocBlockId(taken);
    taken.add(id);
    return { ...b, id };
  });
  return flow.style ? { blocks, style: flow.style } : { blocks };
}
