// An article's resolved style as the CSS variables its writing is drawn with
// (docs/specs/007-editor/article-pages.md "Article style", "Type"; app/article-pages.css reads
// them). The ink follows the page: dark text on a light page, light on a dark one; the accent is
// kept legible against the page.
import type { CSSProperties } from 'react';
import {
  ARTICLE_LINE_HEIGHT,
  ARTICLE_PARAGRAPH_SPACE,
  ARTICLE_TEXT_SIZE_PX,
  legibleOn,
  resolveArticleStyle,
  resolveFontStack,
  type ArticleStyle,
} from '@livediagram/document';

const MONO = resolveFontStack('roboto-mono')!;

export type ArticleInk = { tone: string; dark: boolean };

/** The variables, and the rules attribute, for an article drawn on a page of `ink`. */
export function articleStyleVars(
  style: ArticleStyle | undefined,
  themeAccent: string,
  ink: ArticleInk,
): { vars: CSSProperties; rules: string } {
  const r = resolveArticleStyle(style);
  const accent = legibleOn(r.accent ?? themeAccent, ink.tone);
  const text = ink.dark ? '#e2e8f0' : '#1e293b';
  const vars: Record<string, string> = {
    '--article-body-font': resolveFontStack(r.bodyFont) ?? 'system-ui, sans-serif',
    '--article-heading-font': resolveFontStack(r.headingFont) ?? 'system-ui, sans-serif',
    '--article-mono-font': MONO,
    '--article-size': `${ARTICLE_TEXT_SIZE_PX[r.textSize]}px`,
    '--article-leading': String(ARTICLE_LINE_HEIGHT[r.lineSpacing]),
    '--article-para': String(ARTICLE_PARAGRAPH_SPACE[r.paragraphSpacing]),
    '--article-accent': accent,
    '--article-ink': text,
    '--article-heading-color': r.accentHeadings ? accent : text,
    '--article-muted': ink.dark ? '#94a3b8' : '#64748b',
    '--article-rule': ink.dark ? 'rgb(255 255 255 / 0.22)' : 'rgb(15 23 42 / 0.16)',
    '--article-code-bg': ink.dark ? 'rgb(255 255 255 / 0.08)' : 'rgb(15 23 42 / 0.05)',
  };
  return { vars: vars as CSSProperties, rules: r.rules };
}
