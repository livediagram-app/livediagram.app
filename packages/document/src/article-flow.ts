// The writing of an article page (docs/specs/007-editor/article-pages.md): an article's blocks in
// order and its style, stored once per article on the tab (`Tab.articles[flow]`), shared by every
// page of the article (`IllustratePage.flow`). Pure data and its reading: whatever is stored is
// read defensively, so a malformed block, run or field is dropped rather than trusted.

// Block and article limits (docs/specs/007-editor/article-pages.md "Blocks"). An article this
// large is ~250 pages of text, far inside a tab's row (MAX_TAB_BYTES, 1.99 MB) only when the
// text is too: the tab's own cap still has the last word on a save.
export const MAX_ARTICLE_BLOCKS = 5000;
export const MAX_ARTICLE_RUNS = 400;
export const MAX_ARTICLE_BLOCK_TEXT = 20_000;
export const MAX_ARTICLE_HREF = 2048;
// Zones: no wider or taller than the largest page (A3 landscape is 1587 wide), no smaller than a
// grip can still be pressed on.
export const ARTICLE_ZONE_MIN = 24;
export const ARTICLE_ZONE_MAX = 2000;
// List items step in 28 px a level, five levels deep.
export const ARTICLE_LIST_MAX_LEVEL = 4;

export type ArticleAlign = 'left' | 'center' | 'right' | 'justify';
export const ARTICLE_ALIGNS: readonly ArticleAlign[] = ['left', 'center', 'right', 'justify'];

export type ArticleParagraphStyle = 'body' | 'title' | 'subtitle' | 'h1' | 'h2' | 'h3' | 'quote';
export const ARTICLE_PARAGRAPH_STYLES: readonly ArticleParagraphStyle[] = [
  'body',
  'title',
  'subtitle',
  'h1',
  'h2',
  'h3',
  'quote',
];

export type ArticleListKind = 'bullet' | 'numbered' | 'todo';
export const ARTICLE_LIST_KINDS: readonly ArticleListKind[] = ['bullet', 'numbered', 'todo'];

export type ArticleZoneKind = 'object' | 'drawing';
export type ArticleZoneWrap = 'inline' | 'left' | 'right';
const ARTICLE_ZONE_WRAPS: readonly ArticleZoneWrap[] = ['inline', 'left', 'right'];
export type ArticleZoneAlign = 'left' | 'center' | 'right';

/** A stretch of text with one formatting. `text` may hold '\n', a line break inside the block. */
export type ArticleRun = {
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
  // Hex colours from the article's swatches.
  color?: string;
  hl?: string;
  // A margin note on this text (docs/specs/007-editor/article-pages.md "Comments and actions"):
  // the id of the marker element in the page's margin that carries its comment thread or action,
  // and which of the two it is (`nk`: 'action'; a comment when absent).
  note?: string;
  nk?: 'action';
};

export type ArticleParagraphBlock = {
  id: string;
  type: 'paragraph';
  // Absent is body text.
  style?: ArticleParagraphStyle;
  // Absent is left.
  align?: ArticleAlign;
  runs: ArticleRun[];
};

export type ArticleListBlock = {
  id: string;
  type: 'list';
  list: ArticleListKind;
  // Absent is 0.
  level?: number;
  checked?: true;
  align?: ArticleAlign;
  runs: ArticleRun[];
};

export type ArticleCodeBlock = { id: string; type: 'code'; text: string };
export type ArticleDividerBlock = { id: string; type: 'divider' };
export type ArticlePageBreakBlock = { id: string; type: 'pageBreak' };

export type ArticleZoneBlock = {
  id: string;
  type: 'zone';
  zone: ArticleZoneKind;
  // Absent is inline.
  wrap?: ArticleZoneWrap;
  // An inline zone's place across the text width; absent is centre.
  align?: ArticleZoneAlign;
  width: number;
  height: number;
  // Where the zone was last laid out: the page it fell on and its top-left from that page's
  // top-left corner (canvas px). Elements whose centre is inside it there are its elements
  // (docs/specs/007-editor/article-pages.md "Zones"). Absent until first laid out.
  at?: ArticleZoneAt;
};

export type ArticleZoneAt = { page: string; x: number; y: number };

export type ArticleBlock =
  | ArticleParagraphBlock
  | ArticleListBlock
  | ArticleCodeBlock
  | ArticleDividerBlock
  | ArticlePageBreakBlock
  | ArticleZoneBlock;

export type ArticleBlockType = ArticleBlock['type'];

export type ArticleLookId = 'clean' | 'classic' | 'report' | 'notebook' | 'bold';
export const ARTICLE_LOOK_IDS: readonly ArticleLookId[] = [
  'clean',
  'classic',
  'report',
  'notebook',
  'bold',
];

export type ArticleTextSize = 'small' | 'normal' | 'large';
export type ArticleLineSpacing = 'single' | 'onehalf' | 'double';
export type ArticleParagraphSpacing = 'none' | 'normal' | 'wide';
export type ArticleRules = 'none' | 'title' | 'headings';
export type ArticleMargins = 'narrow' | 'normal' | 'wide';

/** An article's look (docs/specs/007-editor/article-pages.md "Article style"). Every field is
 *  optional, absent being its default (`resolveArticleStyle`). */
export type ArticleStyle = {
  look?: ArticleLookId;
  headingFont?: string;
  bodyFont?: string;
  // A hex colour; absent is the tab theme's accent.
  accent?: string;
  accentHeadings?: boolean;
  textSize?: ArticleTextSize;
  lineSpacing?: ArticleLineSpacing;
  paragraphSpacing?: ArticleParagraphSpacing;
  rules?: ArticleRules;
  margins?: ArticleMargins;
  // Absent is on.
  pageNumbers?: boolean;
};

export type ArticleFlow = { blocks: ArticleBlock[]; style?: ArticleStyle };

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
export const isArticleHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);

const SAFE_HREF = /^(?:https?:\/\/|mailto:)/i;
/** A link address an article keeps: http, https or mailto, no longer than MAX_ARTICLE_HREF. */
export function isSafeArticleHref(v: unknown): v is string {
  return typeof v === 'string' && v.length <= MAX_ARTICLE_HREF && SAFE_HREF.test(v.trim());
}

/** An id an article stores or sends (a block's, a flow's, a margin note's): 1 to 64 characters. */
export const isArticleId = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= 64;
const isId = isArticleId;
const member = <T extends string>(list: readonly T[], v: unknown): v is T => list.includes(v as T);

const RUN_FLAGS = ['b', 'i', 'u', 's', 'code', 'sup', 'sub'] as const;

function parseRun(v: unknown): ArticleRun | undefined {
  const r = v as Record<string, unknown> | null;
  if (!r || typeof r !== 'object' || typeof r.text !== 'string' || r.text.length === 0)
    return undefined;
  const run: ArticleRun = { text: r.text };
  for (const flag of RUN_FLAGS) if (r[flag] === true) run[flag] = true;
  // Superscript and subscript are one or the other.
  if (run.sup && run.sub) delete run.sub;
  if (isSafeArticleHref(r.href)) run.href = r.href.trim();
  if (isArticleHex(r.color)) run.color = r.color;
  if (isArticleHex(r.hl)) run.hl = r.hl;
  if (isId(r.note)) {
    run.note = r.note;
    if (r.nk === 'action') run.nk = 'action';
  }
  return run;
}

const sameFormat = (a: ArticleRun, b: ArticleRun): boolean =>
  RUN_FLAGS.every((f) => a[f] === b[f]) &&
  a.href === b.href &&
  a.color === b.color &&
  a.hl === b.hl &&
  a.note === b.note &&
  a.nk === b.nk;

/** Runs read defensively, neighbours of one format merged, empty ones dropped, the text capped at
 *  MAX_ARTICLE_BLOCK_TEXT characters over at most MAX_ARTICLE_RUNS runs. */
export function normaliseRuns(v: unknown): ArticleRun[] {
  if (!Array.isArray(v)) return [];
  const out: ArticleRun[] = [];
  let left = MAX_ARTICLE_BLOCK_TEXT;
  for (const raw of v) {
    if (left <= 0) break;
    const run = parseRun(raw);
    if (!run) continue;
    if (run.text.length > left) run.text = run.text.slice(0, left);
    // A link's address counts against the block's budget too, so no block outgrows a room frame.
    left -= run.text.length + (run.href?.length ?? 0);
    const last = out[out.length - 1];
    if (last && sameFormat(last, run)) last.text += run.text;
    else if (out.length < MAX_ARTICLE_RUNS) out.push(run);
    else break;
  }
  return out;
}

const clampSize = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.min(ARTICLE_ZONE_MAX, Math.max(ARTICLE_ZONE_MIN, Math.round(v)))
    : undefined;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** One stored block, or undefined when it is not one. Optional fields keep what is valid. */
export function parseArticleBlock(v: unknown): ArticleBlock | undefined {
  const b = v as Record<string, unknown> | null;
  if (!b || typeof b !== 'object' || !isId(b.id)) return undefined;
  const id = b.id;
  const align = member(ARTICLE_ALIGNS, b.align) && b.align !== 'left' ? { align: b.align } : {};
  switch (b.type) {
    case 'paragraph': {
      const style =
        member(ARTICLE_PARAGRAPH_STYLES, b.style) && b.style !== 'body' ? { style: b.style } : {};
      return { id, type: 'paragraph', ...style, ...align, runs: normaliseRuns(b.runs) };
    }
    case 'list': {
      if (!member(ARTICLE_LIST_KINDS, b.list)) return undefined;
      const level =
        finite(b.level) && b.level >= 1
          ? { level: Math.min(ARTICLE_LIST_MAX_LEVEL, Math.floor(b.level)) }
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
        text: typeof b.text === 'string' ? b.text.slice(0, MAX_ARTICLE_BLOCK_TEXT) : '',
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
        ...(member(ARTICLE_ZONE_WRAPS, b.wrap) && b.wrap !== 'inline' ? { wrap: b.wrap } : {}),
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

export function parseArticleStyle(v: unknown): ArticleStyle | undefined {
  const s = v as Record<string, unknown> | null;
  if (!s || typeof s !== 'object') return undefined;
  const out: ArticleStyle = {};
  if (member(ARTICLE_LOOK_IDS, s.look)) out.look = s.look;
  if (typeof s.headingFont === 'string' && FONT_ID.test(s.headingFont))
    out.headingFont = s.headingFont;
  if (typeof s.bodyFont === 'string' && FONT_ID.test(s.bodyFont)) out.bodyFont = s.bodyFont;
  if (isArticleHex(s.accent)) out.accent = s.accent;
  if (typeof s.accentHeadings === 'boolean') out.accentHeadings = s.accentHeadings;
  for (const [key, values] of Object.entries(STYLE_ENUMS)) {
    if ((values as readonly string[]).includes(s[key] as string))
      (out as Record<string, unknown>)[key] = s[key];
  }
  if (typeof s.pageNumbers === 'boolean') out.pageNumbers = s.pageNumbers;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** A stored article's writing, read defensively: unreadable blocks dropped, repeated ids
 *  dropped after the first, at most MAX_ARTICLE_BLOCKS. Never empty: an article with no block reads
 *  as one empty paragraph. */
export function parseArticleFlow(v: unknown, fallbackId = 'b-empty'): ArticleFlow {
  const f = v as Record<string, unknown> | null;
  const seen = new Set<string>();
  const blocks: ArticleBlock[] = [];
  if (f && typeof f === 'object' && Array.isArray(f.blocks)) {
    for (const raw of f.blocks) {
      if (blocks.length >= MAX_ARTICLE_BLOCKS) break;
      const block = parseArticleBlock(raw);
      if (!block || seen.has(block.id)) continue;
      seen.add(block.id);
      blocks.push(block);
    }
  }
  if (blocks.length === 0) blocks.push({ id: fallbackId, type: 'paragraph', runs: [] });
  const style = f && typeof f === 'object' ? parseArticleStyle(f.style) : undefined;
  return style ? { blocks, style } : { blocks };
}

const parsedArticles = new WeakMap<object, Readonly<Record<string, ArticleFlow>>>();

/** The tab's articles' writing by flow id, each read defensively (`parseArticleFlow`); the same
 *  object back for the same stored `articles`, so readers can memo on it. */
export function articlesOf(tab: object | undefined): Readonly<Record<string, ArticleFlow>> {
  const articles = (tab as { articles?: unknown } | undefined)?.articles;
  if (!articles || typeof articles !== 'object' || Array.isArray(articles)) return EMPTY_ARTICLES;
  const cached = parsedArticles.get(articles);
  if (cached) return cached;
  const out: Record<string, ArticleFlow> = {};
  for (const [flow, raw] of Object.entries(articles)) {
    if (isId(flow)) out[flow] = parseArticleFlow(raw, `${flow}-b0`);
  }
  parsedArticles.set(articles, out);
  return out;
}

const EMPTY_ARTICLES: Readonly<Record<string, ArticleFlow>> = Object.freeze({});

/** Whether two blocks (or any plain JSON values) are the same, whatever order their keys are in:
 *  a block read from storage and one built in the editor list their fields differently. */
export function sameArticleValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bs = b as unknown[];
    return a.length === bs.length && a.every((v, i) => sameArticleValue(v, bs[i]));
  }
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  return (
    ka.length === kb.length &&
    ka.every((k) =>
      sameArticleValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    )
  );
}

/** A new block id: `b-` and eight hex digits, never one in `taken`. */
export function nextArticleBlockId(taken?: ReadonlySet<string>): string {
  let id: string;
  do id = `b-${crypto.randomUUID().slice(0, 8)}`;
  while (taken?.has(id));
  return id;
}

/** A new article's flow id: `art-` and eight hex digits, never one in `taken`. */
export function nextArticleFlowId(taken?: ReadonlySet<string>): string {
  let id: string;
  do id = `art-${crypto.randomUUID().slice(0, 8)}`;
  while (taken?.has(id));
  return id;
}

/** A new article's writing: an empty Title and an empty paragraph. */
export function newArticleFlow(): ArticleFlow {
  const title = nextArticleBlockId();
  const body = nextArticleBlockId(new Set([title]));
  return {
    blocks: [
      { id: title, type: 'paragraph', style: 'title', runs: [] },
      { id: body, type: 'paragraph', runs: [] },
    ],
  };
}

/** A copy of an article's writing with every block given a fresh id (a duplicated article). */
export function withFreshArticleBlockIds(flow: ArticleFlow): ArticleFlow {
  const taken = new Set<string>();
  const blocks = flow.blocks.map((b) => {
    const id = nextArticleBlockId(taken);
    taken.add(id);
    return { ...b, id };
  });
  return flow.style ? { blocks, style: flow.style } : { blocks };
}

const ROMAN: [number, string][] = [
  [10, 'x'],
  [9, 'ix'],
  [5, 'v'],
  [4, 'iv'],
  [1, 'i'],
];
const roman = (n: number): string => {
  let out = '';
  for (const [v, s] of ROMAN)
    while (n >= v) {
      out += s;
      n -= v;
    }
  return out;
};
const alpha = (n: number): string => {
  let out = '';
  for (let k = n; k > 0; k = Math.floor((k - 1) / 26))
    out = String.fromCharCode(97 + ((k - 1) % 26)) + out;
  return out;
};
const BULLETS = ['•', '◦', '▪'];

/**
 * Each list item's marker (docs/specs/007-editor/article-pages.md "Blocks"): a numbered item counts
 * 1, 2, 3 at level 0, a, b, c at level 1, i, ii, iii at level 2, repeating, through a run of list
 * items; a bullet or to-do at a level restarts that level's count; any other block ends the run.
 * Bullets are •, ◦, ▪ by level. A to-do's marker is its box (empty here).
 */
export function articleListMarkers(
  blocks: readonly ({ type: string; list?: ArticleListKind; level?: number } & { id: string })[],
): Map<string, string> {
  const out = new Map<string, string>();
  let counts: number[] = [];
  for (const b of blocks) {
    if (b.type !== 'list' || !b.list) {
      counts = [];
      continue;
    }
    const level = b.level ?? 0;
    counts.length = level + 1;
    if (b.list === 'numbered') {
      const n = (counts[level] ?? 0) + 1;
      counts[level] = n;
      const style = level % 3;
      out.set(b.id, `${style === 0 ? n : style === 1 ? alpha(n) : roman(n)}.`);
    } else {
      counts[level] = 0;
      out.set(b.id, b.list === 'bullet' ? BULLETS[level % 3]! : '');
    }
  }
  return out;
}
