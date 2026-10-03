// An article's style resolved to the values its writing is drawn with
// (docs/specs/007-editor/article-pages.md "Article style", "Type"): every field's default, and
// the looks an article can start from. Pure; the editor turns the result into CSS variables and
// the exports read the same numbers.
import { articlesOf } from './article-flow';
import { withArticleFlow } from './article-pages';
import { illustratePagesOf, withIllustratePages } from './illustrate-page';
import type { Tab } from './index';
import type {
  ArticleLineSpacing,
  ArticleLookId,
  ArticleMargins,
  ArticleParagraphSpacing,
  ArticleParagraphStyle,
  ArticleRules,
  ArticleStyle,
  ArticleTextSize,
} from './article-flow';

export const ARTICLE_TEXT_SIZE_PX: Readonly<Record<ArticleTextSize, number>> = {
  small: 14,
  normal: 16,
  large: 18,
};
export const ARTICLE_LINE_HEIGHT: Readonly<Record<ArticleLineSpacing, number>> = {
  single: 1.3,
  onehalf: 1.5,
  double: 2,
};
// Space after a body paragraph, in lines.
export const ARTICLE_PARAGRAPH_SPACE: Readonly<Record<ArticleParagraphSpacing, number>> = {
  none: 0,
  normal: 0.75,
  wide: 1.5,
};
export const ARTICLE_MARGIN_PX: Readonly<Record<ArticleMargins, number>> = {
  narrow: 48,
  normal: 96,
  wide: 144,
};

// Each style's size at Normal text size, its weight, and the space before and after it in lines
// (docs/specs/007-editor/article-pages.md "Type"). Body's space after is the paragraph spacing.
export const ARTICLE_TYPE: Readonly<
  Record<
    ArticleParagraphStyle | 'code',
    { size: number; weight: number; before: number; after: number }
  >
> = {
  body: { size: 16, weight: 400, before: 0, after: -1 },
  title: { size: 36, weight: 700, before: 0, after: 0.5 },
  subtitle: { size: 20, weight: 400, before: 0, after: 1 },
  h1: { size: 28, weight: 700, before: 1.2, after: 0.4 },
  h2: { size: 22, weight: 650, before: 1, after: 0.3 },
  h3: { size: 18, weight: 650, before: 0.8, after: 0.2 },
  quote: { size: 18, weight: 400, before: 0.5, after: 0.75 },
  code: { size: 14, weight: 400, before: 0.5, after: 0.75 },
};

export type ResolvedArticleStyle = {
  headingFont: string;
  bodyFont: string;
  // Null: the tab theme's accent.
  accent: string | null;
  accentHeadings: boolean;
  textSize: ArticleTextSize;
  lineSpacing: ArticleLineSpacing;
  paragraphSpacing: ArticleParagraphSpacing;
  rules: ArticleRules;
  margins: ArticleMargins;
  pageNumbers: boolean;
};

type LookFields = Omit<ResolvedArticleStyle, 'accent' | 'margins' | 'pageNumbers'> & {
  // Whether the look rules the pages (their Lines pattern, aligned to the text).
  ruled: boolean;
};

// The looks (docs/specs/007-editor/article-pages.md "Article style"), in the order the Style tab
// shows them. Clean is also what an article with no style reads as.
export const ARTICLE_LOOKS: Readonly<Record<ArticleLookId, { label: string } & LookFields>> = {
  clean: {
    label: 'Clean',
    headingFont: 'inter',
    bodyFont: 'inter',
    accentHeadings: false,
    textSize: 'normal',
    lineSpacing: 'onehalf',
    paragraphSpacing: 'normal',
    rules: 'none',
    ruled: false,
  },
  classic: {
    label: 'Classic',
    headingFont: 'lora',
    bodyFont: 'lora',
    accentHeadings: false,
    textSize: 'normal',
    lineSpacing: 'onehalf',
    paragraphSpacing: 'normal',
    rules: 'title',
    ruled: false,
  },
  report: {
    label: 'Report',
    headingFont: 'poppins',
    bodyFont: 'inter',
    accentHeadings: true,
    textSize: 'normal',
    lineSpacing: 'onehalf',
    paragraphSpacing: 'normal',
    rules: 'headings',
    ruled: false,
  },
  notebook: {
    label: 'Notebook',
    headingFont: 'nunito',
    bodyFont: 'nunito',
    accentHeadings: true,
    textSize: 'normal',
    lineSpacing: 'onehalf',
    paragraphSpacing: 'none',
    rules: 'none',
    ruled: true,
  },
  bold: {
    label: 'Bold',
    headingFont: 'oswald',
    bodyFont: 'inter',
    accentHeadings: true,
    textSize: 'large',
    lineSpacing: 'onehalf',
    paragraphSpacing: 'normal',
    rules: 'headings',
    ruled: false,
  },
};

/** Every field of an article's style, its own or its default. */
export function resolveArticleStyle(style: ArticleStyle | undefined): ResolvedArticleStyle {
  const base = ARTICLE_LOOKS.clean;
  return {
    headingFont: style?.headingFont ?? base.headingFont,
    bodyFont: style?.bodyFont ?? base.bodyFont,
    accent: style?.accent ?? null,
    accentHeadings: style?.accentHeadings ?? base.accentHeadings,
    textSize: style?.textSize ?? base.textSize,
    lineSpacing: style?.lineSpacing ?? base.lineSpacing,
    paragraphSpacing: style?.paragraphSpacing ?? base.paragraphSpacing,
    rules: style?.rules ?? base.rules,
    margins: style?.margins ?? 'normal',
    pageNumbers: style?.pageNumbers ?? true,
  };
}

/** A look applied: every field it sets, keeping the article's accent, margins and page numbers. */
export function withArticleLook(
  style: ArticleStyle | undefined,
  look: ArticleLookId,
): ArticleStyle {
  const { label: _label, ruled: _ruled, ...fields } = ARTICLE_LOOKS[look];
  void _label;
  void _ruled;
  return {
    ...(style?.accent ? { accent: style.accent } : {}),
    ...(style?.margins ? { margins: style.margins } : {}),
    ...(style?.pageNumbers !== undefined ? { pageNumbers: style.pageNumbers } : {}),
    look,
    ...fields,
  };
}

/** An article's page margin, in canvas px. */
export function articleMarginPx(style: ArticleStyle | undefined): number {
  return ARTICLE_MARGIN_PX[resolveArticleStyle(style).margins];
}

/** The least top margin an article page has, canvas px, whatever its margins: room for the page
 *  toolbar's card (44 px, 4 px clear) above the first line at 100% and below, so writing never
 *  starts under it (Narrow's 48 would). */
export const ARTICLE_TOP_MIN_PX = 72;

/** An article's top margin, in canvas px: its margin, never less than ARTICLE_TOP_MIN_PX. */
export function articleTopMarginPx(style: ArticleStyle | undefined): number {
  return Math.max(articleMarginPx(style), ARTICLE_TOP_MIN_PX);
}

/** The body text's line height in canvas px: the pitch ruled lines are drawn at. */
export function articleBodyLinePx(style: ArticleStyle | undefined): number {
  const r = resolveArticleStyle(style);
  return ARTICLE_TEXT_SIZE_PX[r.textSize] * ARTICLE_LINE_HEIGHT[r.lineSpacing];
}

/**
 * An article's style changed (docs/specs/007-editor/article-pages.md "Article style"): a look
 * sets every field it has (keeping the accent, margins and page numbers); one field changed is
 * that field alone, and the article no longer names a look. Choosing Notebook rules the article's
 * pages (their Lines pattern); leaving it takes the lines away again. One tab edit.
 */
export function withArticleStyleChanged<
  T extends Pick<Tab, 'elements'> & { pages?: unknown; articles?: unknown },
>(tab: T, flow: string, change: { look: ArticleLookId } | { patch: Partial<ArticleStyle> }): T {
  const doc = articlesOf(tab)[flow];
  if (!doc) return tab;
  const was = doc.style;
  let style: ArticleStyle;
  if ('look' in change) style = withArticleLook(was, change.look);
  else {
    const { look: _look, ...rest } = { ...was, ...change.patch };
    void _look;
    style = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined),
    ) as ArticleStyle;
  }
  let next: T = withArticleFlow(
    tab,
    flow,
    Object.keys(style).length ? { blocks: doc.blocks, style } : { blocks: doc.blocks },
  );
  const ruledBefore = was?.look === 'notebook';
  const ruledNow = 'look' in change && ARTICLE_LOOKS[change.look].ruled;
  if (ruledNow !== ruledBefore && 'look' in change) {
    const pages = illustratePagesOf(next).map((p) => {
      if (p.flow !== flow) return p;
      const background = { ...p.background };
      if (ruledNow) background.pattern = 'lines';
      else if (background.pattern === 'lines') delete background.pattern;
      const { background: _b, ...own } = p;
      void _b;
      return background.fill || background.pattern ? { ...own, background } : own;
    });
    next = withIllustratePages(next, pages) as T;
  }
  return next;
}
