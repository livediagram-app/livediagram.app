// An article page's writing for an export (docs/specs/007-editor/article-pages.md "Everywhere a
// page goes"): the operations its article's editor reads off its layout, kept to the page, with
// its header and footer (the page number among them) where it has them; and the font ids they use, so a downloaded SVG carries
// them. Null for an infographic page, or an article with no editor laid out (the writing then
// leaves the page bare rather than guessing at a layout).
import {
  articleBodyLinePx,
  articleMarginPx,
  articleTopMarginPx,
  articlesOf,
  pagesOf,
  resolveArticleStyle,
  type LaidOutPage,
  type Tab,
} from '@livedocuments/document';
import { articleHandleOf } from './article-editor-store';
import { bandDocumentName, pageBandLayout, type PageBandLayout } from './article-band-layout';
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
  const own = pagesOf(tab).filter((p) => p.flow === page.flow);
  ops.push(...bandOps(pageBandLayout(doc.style, own, page, bandDocumentName()), r));
  return { ops, fonts: pageWritingFonts(tab, page) };
}

// The type's middle to its baseline, for 12 px type.
const BAND_BASELINE = 4;

/** A page's header and footer as text operations at the page's place on the canvas: each part one line,
 *  cut with an ellipsis to its third of the width (the centre to the room the sides leave it). */
export function bandOps(layout: PageBandLayout | null, r: LaidOutPage['rect']): ArticleDrawOp[] {
  if (!layout) return [];
  const ops: ArticleDrawOp[] = [];
  const width = layout.right - layout.left;
  // About 6.2 px a character in 12 px type: a part longer than its share is cut short.
  const fit = (text: string, room: number) => {
    const max = Math.max(1, Math.floor(room / 6.2));
    return text.length > max ? `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…` : text;
  };
  for (const line of [layout.header, layout.footer]) {
    if (!line) continue;
    const y = r.y + line.y + BAND_BASELINE;
    const parts: [keyof typeof line.parts, number, 'start' | 'middle' | 'end'][] = [
      ['left', r.x + layout.left, 'start'],
      ['center', r.x + layout.left + width / 2, 'middle'],
      ['right', r.x + layout.right, 'end'],
    ];
    for (const [part, x, anchor] of parts) {
      const text = line.parts[part];
      if (!text) continue;
      ops.push({
        k: 'text',
        x,
        y,
        text: fit(text, width / 3 - 8),
        family: layout.font,
        size: 12,
        weight: '400',
        style: 'normal',
        color: 'rgb(71 85 105)',
        anchor,
      });
    }
  }
  return ops;
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
