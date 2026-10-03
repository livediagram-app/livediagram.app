// A document's resolved style as the CSS variables its writing is drawn with
// (docs/specs/007-editor/document-pages.md "Document style", "Type"; app/document-pages.css reads
// them). The ink follows the page: dark text on a light page, light on a dark one; the accent is
// kept legible against the page.
import type { CSSProperties } from 'react';
import {
  DOC_LINE_HEIGHT,
  DOC_PARAGRAPH_SPACE,
  DOC_TEXT_SIZE_PX,
  legibleOn,
  resolveDocStyle,
  resolveFontStack,
  type DocStyle,
} from '@livediagram/document';

const MONO = resolveFontStack('roboto-mono')!;

export type DocInk = { tone: string; dark: boolean };

/** The variables, and the rules attribute, for a document drawn on a page of `ink`. */
export function docStyleVars(
  style: DocStyle | undefined,
  themeAccent: string,
  ink: DocInk,
): { vars: CSSProperties; rules: string } {
  const r = resolveDocStyle(style);
  const accent = legibleOn(r.accent ?? themeAccent, ink.tone);
  const text = ink.dark ? '#e2e8f0' : '#1e293b';
  const vars: Record<string, string> = {
    '--doc-body-font': resolveFontStack(r.bodyFont) ?? 'system-ui, sans-serif',
    '--doc-heading-font': resolveFontStack(r.headingFont) ?? 'system-ui, sans-serif',
    '--doc-mono-font': MONO,
    '--doc-size': `${DOC_TEXT_SIZE_PX[r.textSize]}px`,
    '--doc-leading': String(DOC_LINE_HEIGHT[r.lineSpacing]),
    '--doc-para': String(DOC_PARAGRAPH_SPACE[r.paragraphSpacing]),
    '--doc-accent': accent,
    '--doc-ink': text,
    '--doc-heading-color': r.accentHeadings ? accent : text,
    '--doc-muted': ink.dark ? '#94a3b8' : '#64748b',
    '--doc-rule': ink.dark ? 'rgb(255 255 255 / 0.22)' : 'rgb(15 23 42 / 0.16)',
    '--doc-code-bg': ink.dark ? 'rgb(255 255 255 / 0.08)' : 'rgb(15 23 42 / 0.05)',
  };
  return { vars: vars as CSSProperties, rules: r.rules };
}
