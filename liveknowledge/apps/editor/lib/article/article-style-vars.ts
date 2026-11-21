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
} from '@liveknowledge/document';

import { pageLinkColour } from '@/lib/knowledge/page-link-colour';
import { LIME_ACCENT } from '@/lib/knowledge-style/knowledge-accent';

const MONO = resolveFontStack('roboto-mono')!;
// WCAG 2.2 AA for text.
const ACCENT_CONTRAST = 4.5;

export type ArticleInk = { tone: string; dark: boolean };

/** The variables, and the rules attribute, for an article drawn on a page of `ink`. */
export function articleStyleVars(
  style: ArticleStyle | undefined,
  themeAccent: string,
  ink: ArticleInk,
): { vars: CSSProperties; rules: string } {
  const r = resolveArticleStyle(style);
  // Held to 4.5:1 on the page: in a knowledgebase the accent is the colour of words (headings, links, a table's
  // header), never only of a rule or a bar.
  const accent = legibleOn(r.accent ?? themeAccent, ink.tone, ACCENT_CONTRAST);
  const text = ink.dark ? '#e2e8f0' : '#1e293b';
  const vars: Record<string, string> = {
    '--article-body-font': resolveFontStack(r.bodyFont) ?? 'system-ui, sans-serif',
    '--article-heading-font': resolveFontStack(r.headingFont) ?? 'system-ui, sans-serif',
    '--article-mono-font': MONO,
    '--article-size': `${ARTICLE_TEXT_SIZE_PX[r.textSize]}px`,
    '--article-leading': String(ARTICLE_LINE_HEIGHT[r.lineSpacing]),
    '--article-para': String(ARTICLE_PARAGRAPH_SPACE[r.paragraphSpacing]),
    '--article-accent': accent,
    // A page link is the brand's, on any paper (lib/knowledge/page-link-colour.ts): lime under the product's own
    // theme, the theme's accent under any other.
    '--article-page-link': pageLinkColour(ink, themeAccent === LIME_ACCENT ? null : themeAccent),
    '--article-ink': text,
    '--article-heading-color': r.accentHeadings ? accent : text,
    '--article-muted': ink.dark ? '#94a3b8' : '#64748b',
    '--article-rule': ink.dark ? 'rgb(255 255 255 / 0.22)' : 'rgb(15 23 42 / 0.16)',
    '--article-code-bg': ink.dark ? 'rgb(255 255 255 / 0.08)' : 'rgb(15 23 42 / 0.05)',
  };
  return { vars: vars, rules: r.rules };
}

/** The writing's look as drawn on `el` (its `--article-*` variables), for chrome beside the writing that wears it
 *  (the slash menu's tiles and preview). Read from the inline style the view writes: no layout. */
export function articleLookOf(el: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < el.style.length; i++) {
    const name = el.style.item(i);
    if (name.startsWith('--article-')) out[name] = el.style.getPropertyValue(name).trim();
  }
  return out;
}
