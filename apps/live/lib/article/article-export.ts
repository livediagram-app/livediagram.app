// An article page's writing for an export (docs/specs/007-editor/article-pages.md "Everywhere a
// page goes"): the operations its article's editor reads off its layout, kept to the page, with
// the page number where the page has one; and the font ids they use, so a downloaded SVG carries
// them. Null for an infographic page, or an article with no editor laid out (the writing then
// leaves the page bare rather than guessing at a layout).
import {
  articleBodyLinePx,
  articleMarginPx,
  articleTopMarginPx,
  articlesOf,
  illustratePagesOf,
  resolveArticleStyle,
  resolveFontStack,
  type LaidOutPage,
  type Tab,
} from '@livediagram/document';
import { articleHandleOf } from './article-editor-store';
import type { ArticleDrawOp } from './article-snapshot';

export type PageWriting = { ops: ArticleDrawOp[]; fonts: string[] };

/** The faces an article page's writing is set in (its style's, and code's): what an export embeds,
 *  known without measuring the writing. */
export function pageWritingFonts(tab: Tab, page: LaidOutPage): string[] {
  const doc = page.flow ? articlesOf(tab)[page.flow] : undefined;
  if (!doc) return [];
  const style = resolveArticleStyle(doc.style);
  return [style.headingFont, style.bodyFont, 'roboto-mono'];
}

export function pageWriting(tab: Tab, page: LaidOutPage): PageWriting | null {
  if (!page.flow) return null;
  const doc = articlesOf(tab)[page.flow];
  const snap = articleHandleOf(page.flow)?.snapshot();
  if (!doc || !snap) return null;
  const r = page.rect;
  const on = (x: number, y: number) =>
    x >= r.x - 1 && x <= r.x + r.width + 1 && y >= r.y - 1 && y <= r.y + r.height + 1;
  const ops = snap.filter((op) => (op.k === 'line' ? on(op.x1, op.y1) : on(op.x, op.y)));
  const style = resolveArticleStyle(doc.style);
  const own = illustratePagesOf(tab).filter((p) => p.flow === page.flow);
  if (style.pageNumbers) {
    const n = own.findIndex((p) => p.id === page.id) + 1;
    ops.push({
      k: 'text',
      x: r.x + r.width / 2,
      y: r.y + r.height - articleMarginPx(doc.style) / 2 + 4,
      text: String(n),
      family: resolveFontStack(style.bodyFont) ?? 'system-ui, sans-serif',
      size: 12,
      weight: '400',
      style: 'normal',
      color: 'rgb(71 85 105)',
      anchor: 'middle',
    });
  }
  return { ops, fonts: pageWritingFonts(tab, page) };
}

/** An article page's writing as soft bars, one per line of text: a thumbnail's or the Map's. */
export function pageWritingBars(
  page: LaidOutPage,
  ink = 'rgb(100 116 139 / 0.45)',
): ArticleDrawOp[] {
  if (!page.flow) return [];
  const bars = articleHandleOf(page.flow)?.bars(ink) ?? [];
  const r = page.rect;
  return bars.filter(
    (op) =>
      op.k === 'rect' &&
      op.x >= r.x - 1 &&
      op.x <= r.x + r.width &&
      op.y >= r.y - 1 &&
      op.y <= r.y + r.height,
  );
}

/** An article page's Lines drawn on its writing's baselines inside its margins. */
export function pageRulingOf(
  tab: Tab,
  page: LaidOutPage,
): { pitch: number; inset: number; top: number } | undefined {
  if (!page.flow) return undefined;
  const doc = articlesOf(tab)[page.flow];
  return doc
    ? {
        pitch: articleBodyLinePx(doc.style),
        inset: articleMarginPx(doc.style),
        top: articleTopMarginPx(doc.style),
      }
    : undefined;
}
