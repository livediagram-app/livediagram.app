// The Knowledgebase Style (docs/specs/030-knowledgebase/page-surface.md "Knowledgebase Style"): the one look every
// page of a knowledgebase is drawn in, kept in the document's metadata as `knowledgeStyle`, beside
// `knowledgeSettings`. It travels with the document: a copy, a version, a snapshot, an export, the Drive file and a
// knowledgebase kept Offline all carry it. No page and no tab has a style of its own (./page-looks drops a stored
// one), so changing it rewrites nothing.
import { DEFAULT_SCHEME_ID } from '@liveworkspace/element-model/themes';
import { FONTS } from '@liveworkspace/model-core/fonts';
import { isArticleHex, type ArticleStyle } from './article-flow';
import { THEMES } from './themes-data';

export const KNOWLEDGE_TEXT_SIZES = ['small', 'medium', 'large'] as const;
export type KnowledgeTextSize = (typeof KNOWLEDGE_TEXT_SIZES)[number];
export const KNOWLEDGE_LINE_SPACINGS = ['compact', 'comfortable', 'relaxed'] as const;
export type KnowledgeLineSpacing = (typeof KNOWLEDGE_LINE_SPACINGS)[number];
export const KNOWLEDGE_HEADING_STYLES = ['plain', 'ruled'] as const;
export type KnowledgeHeadingStyle = (typeof KNOWLEDGE_HEADING_STYLES)[number];

export type KnowledgeStyle = {
  // A built-in theme's id; `brand` is the product's own (lime).
  theme: string;
  // Typeface ids from the shared catalogue (@liveworkspace/model-core/fonts).
  headingFont: string;
  bodyFont: string;
  textSize: KnowledgeTextSize;
  lineSpacing: KnowledgeLineSpacing;
  headingStyle: KnowledgeHeadingStyle;
  // The writing's accent, a hex colour someone picked; absent is the theme's own.
  accent?: string;
};

/** What a new knowledgebase starts in: the Everyday look, the product's own theme. */
export const DEFAULT_KNOWLEDGE_STYLE: KnowledgeStyle = {
  theme: DEFAULT_SCHEME_ID,
  headingFont: 'inter',
  bodyFont: 'inter',
  textSize: 'medium',
  lineSpacing: 'comfortable',
  headingStyle: 'plain',
};

const THEME_IDS: ReadonlySet<string> = new Set([DEFAULT_SCHEME_ID, ...THEMES.map((t) => t.id)]);
const FONT_IDS: ReadonlySet<string> = new Set(FONTS.map((f) => f.id));

/** A theme a knowledgebase can wear: the product's own, or a built-in one (the seasonal ones included). */
export const isKnowledgeTheme = (v: unknown): v is string =>
  typeof v === 'string' && THEME_IDS.has(v);
/** A typeface the writing can be set in. */
export const isKnowledgeFont = (v: unknown): v is string =>
  typeof v === 'string' && FONT_IDS.has(v);

const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => list.includes(v as T);

function objectOf(v: unknown): Record<string, unknown> | null {
  let raw = v;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
}

/** A stored style, as an object or as the JSON text a column holds: each field that is valid is kept, each that is
 *  not is the default's. Never throws. */
export function parseKnowledgeStyle(v: unknown): KnowledgeStyle {
  const raw = objectOf(v) ?? {};
  const d = DEFAULT_KNOWLEDGE_STYLE;
  return {
    theme: isKnowledgeTheme(raw.theme) ? raw.theme : d.theme,
    headingFont: isKnowledgeFont(raw.headingFont) ? raw.headingFont : d.headingFont,
    bodyFont: isKnowledgeFont(raw.bodyFont) ? raw.bodyFont : d.bodyFont,
    textSize: oneOf(KNOWLEDGE_TEXT_SIZES, raw.textSize) ? raw.textSize : d.textSize,
    lineSpacing: oneOf(KNOWLEDGE_LINE_SPACINGS, raw.lineSpacing) ? raw.lineSpacing : d.lineSpacing,
    headingStyle: oneOf(KNOWLEDGE_HEADING_STYLES, raw.headingStyle)
      ? raw.headingStyle
      : d.headingStyle,
    ...(isArticleHex(raw.accent) ? { accent: raw.accent.toLowerCase() } : {}),
  };
}

const FIELD_HELP: Readonly<Record<string, string>> = {
  theme: 'theme is a built-in theme id (brand, steel, ocean, ...).',
  headingFont: 'headingFont is a typeface id (inter, lora, nunito, ...).',
  bodyFont: 'bodyFont is a typeface id (inter, lora, nunito, ...).',
  textSize: 'textSize is small, medium or large.',
  lineSpacing: 'lineSpacing is compact, comfortable or relaxed.',
  headingStyle: 'headingStyle is plain or ruled.',
  accent: 'accent is a hex colour (#0ea5e9), or null for the theme’s own.',
};

/**
 * A style someone writes (the metadata write, an agent's): the stored style with the fields the write names over
 * it. Strict where the parser is forgiving: a field the write names with a value it cannot be refuses the whole
 * write, with the line that says what it takes. `accent: null` clears a picked accent.
 */
export function knowledgeStyleWrite(
  stored: KnowledgeStyle,
  write: unknown,
): { ok: true; style: KnowledgeStyle } | { ok: false; field: string; message: string } {
  const raw = objectOf(write);
  if (!raw || typeof write === 'string')
    return { ok: false, field: 'knowledgeStyle', message: 'knowledgeStyle is an object.' };
  const refuse = (field: string) => ({ ok: false as const, field, message: FIELD_HELP[field]! });
  for (const key of Object.keys(raw))
    if (!(key in FIELD_HELP))
      return {
        ok: false,
        field: key,
        message: `knowledgeStyle has no ${key}. It takes ${Object.keys(FIELD_HELP).join(', ')}.`,
      };
  const next: KnowledgeStyle = { ...stored };
  if (raw.theme !== undefined) {
    if (!isKnowledgeTheme(raw.theme)) return refuse('theme');
    next.theme = raw.theme;
  }
  for (const key of ['headingFont', 'bodyFont'] as const) {
    if (raw[key] === undefined) continue;
    if (!isKnowledgeFont(raw[key])) return refuse(key);
    next[key] = raw[key];
  }
  if (raw.textSize !== undefined) {
    if (!oneOf(KNOWLEDGE_TEXT_SIZES, raw.textSize)) return refuse('textSize');
    next.textSize = raw.textSize;
  }
  if (raw.lineSpacing !== undefined) {
    if (!oneOf(KNOWLEDGE_LINE_SPACINGS, raw.lineSpacing)) return refuse('lineSpacing');
    next.lineSpacing = raw.lineSpacing;
  }
  if (raw.headingStyle !== undefined) {
    if (!oneOf(KNOWLEDGE_HEADING_STYLES, raw.headingStyle)) return refuse('headingStyle');
    next.headingStyle = raw.headingStyle;
  }
  if (raw.accent === null) delete next.accent;
  else if (raw.accent !== undefined) {
    if (!isArticleHex(raw.accent)) return refuse('accent');
    next.accent = raw.accent.toLowerCase();
  }
  return { ok: true, style: next };
}

export function sameKnowledgeStyle(a: KnowledgeStyle, b: KnowledgeStyle): boolean {
  return (
    a.theme === b.theme &&
    a.headingFont === b.headingFont &&
    a.bodyFont === b.bodyFont &&
    a.textSize === b.textSize &&
    a.lineSpacing === b.lineSpacing &&
    a.headingStyle === b.headingStyle &&
    (a.accent ?? null) === (b.accent ?? null)
  );
}

/** The style as stored: nothing for the default, so a knowledgebase that never chose keeps no row of it. */
export const storedKnowledgeStyle = (style: KnowledgeStyle): string | null =>
  sameKnowledgeStyle(style, DEFAULT_KNOWLEDGE_STYLE) ? null : JSON.stringify(style);

/** The style a file or a create carries: a parsed one that is not the default, or nothing. */
export function carriedKnowledgeStyle(v: unknown): { knowledgeStyle?: KnowledgeStyle } {
  if (!objectOf(v)) return {};
  const style = parseKnowledgeStyle(v);
  return sameKnowledgeStyle(style, DEFAULT_KNOWLEDGE_STYLE) ? {} : { knowledgeStyle: style };
}

const ARTICLE_SIZE = { small: 'small', medium: 'normal', large: 'large' } as const;
const ARTICLE_SPACING = { compact: 'single', comfortable: 'onehalf', relaxed: 'double' } as const;

/**
 * The style every page's writing is drawn with (the article style machinery, ./article-style): the knowledgebase's
 * fonts, size, spacing and heading style on the 760 px column (Narrow margins). Headings take the accent, as the
 * links, quotes, tables and code blocks do. The same object back for the same style, so a flow handed it keeps its
 * identity across renders.
 */
export function knowledgeArticleStyle(style: KnowledgeStyle): ArticleStyle {
  const key = JSON.stringify(style);
  const made = ARTICLE_STYLES.get(key);
  if (made) return made;
  const article: ArticleStyle = {
    headingFont: style.headingFont,
    bodyFont: style.bodyFont,
    accentHeadings: true,
    textSize: ARTICLE_SIZE[style.textSize],
    lineSpacing: ARTICLE_SPACING[style.lineSpacing],
    paragraphSpacing: 'normal',
    rules: style.headingStyle === 'ruled' ? 'headings' : 'none',
    margins: 'narrow',
    ...(style.accent ? { accent: style.accent } : {}),
  };
  // A knowledgebase wears a handful of styles in a session; the cap only stops a runaway.
  if (ARTICLE_STYLES.size > 64) ARTICLE_STYLES.clear();
  ARTICLE_STYLES.set(key, article);
  return article;
}
const ARTICLE_STYLES = new Map<string, ArticleStyle>();
