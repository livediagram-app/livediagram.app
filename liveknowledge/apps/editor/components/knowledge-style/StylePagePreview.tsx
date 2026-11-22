'use client';

// The sample the Text panel shows (docs/specs/030-knowledgebase/page-surface.md "Fine-tune"): a heading and a line
// with a link, set in the knowledgebase's typefaces, size, spacing and heading style and coloured as its pages are
// (lib/knowledge-style/look-page-preview.ts previewInks). It follows each choice as it is made. A picture of
// writing for sighted readers; its label says what it shows.
import {
  ARTICLE_LINE_HEIGHT,
  ARTICLE_TEXT_SIZE_PX,
  knowledgeArticleStyle,
  resolveArticleStyle,
  resolveFontStack,
  type KnowledgeStyle,
} from '@liveknowledge/document';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { previewInks } from '@/lib/knowledge-style/look-page-preview';

export function StylePagePreview({ style, label }: { style: KnowledgeStyle; label: string }) {
  const { appearance } = useAppearance();
  const r = resolveArticleStyle(knowledgeArticleStyle(style));
  const c = previewInks(style, appearance);
  const size = ARTICLE_TEXT_SIZE_PX[r.textSize];
  const heading = resolveFontStack(r.headingFont) ?? 'system-ui, sans-serif';
  const body = resolveFontStack(r.bodyFont) ?? 'system-ui, sans-serif';
  return (
    <div
      role="img"
      aria-label={label}
      className="h-24 overflow-hidden rounded-lg border border-slate-200 px-5 py-3 dark:border-slate-700"
      style={{ backgroundColor: c.paper, color: c.ink }}
    >
      <p
        aria-hidden
        style={{
          fontFamily: heading,
          fontSize: size * 1.375,
          fontWeight: 600,
          lineHeight: 1.25,
          color: c.accent,
          paddingBottom: r.rules === 'headings' ? '0.18em' : undefined,
          borderBottom: r.rules === 'headings' ? `1.5px solid ${c.accent}` : undefined,
        }}
      >
        How We Work
      </p>
      <p
        aria-hidden
        className="mt-1.5 truncate"
        style={{ fontFamily: body, fontSize: size, lineHeight: ARTICLE_LINE_HEIGHT[r.lineSpacing] }}
      >
        Write it down once, where everyone looks.{' '}
        <span style={{ color: c.accent, textDecoration: 'underline' }}>Read more</span>
      </p>
    </div>
  );
}
