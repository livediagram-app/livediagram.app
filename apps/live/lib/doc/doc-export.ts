// A document page's writing for an export (docs/specs/007-editor/document-pages.md "Everywhere a
// page goes"): the operations its document's editor reads off its layout, kept to the page, with
// the page number where the page has one; and the font ids they use, so a downloaded SVG carries
// them. Null for an infographic page, or a document with no editor laid out (the writing then
// leaves the page bare rather than guessing at a layout).
import {
  docBodyLinePx,
  docMarginPx,
  docsOf,
  illustratePagesOf,
  resolveDocStyle,
  resolveFontStack,
  type LaidOutPage,
  type Tab,
} from '@livediagram/document';
import { docHandleOf } from './doc-editor-store';
import type { DocDrawOp } from './doc-snapshot';

export type PageWriting = { ops: DocDrawOp[]; fonts: string[] };

export function pageWriting(tab: Tab, page: LaidOutPage): PageWriting | null {
  if (!page.flow) return null;
  const doc = docsOf(tab)[page.flow];
  const snap = docHandleOf(page.flow)?.snapshot();
  if (!doc || !snap) return null;
  const r = page.rect;
  const on = (x: number, y: number) =>
    x >= r.x - 1 && x <= r.x + r.width + 1 && y >= r.y - 1 && y <= r.y + r.height + 1;
  const ops = snap.filter((op) => (op.k === 'line' ? on(op.x1, op.y1) : on(op.x, op.y)));
  const style = resolveDocStyle(doc.style);
  const own = illustratePagesOf(tab).filter((p) => p.flow === page.flow);
  if (style.pageNumbers && own.length > 1) {
    const n = own.findIndex((p) => p.id === page.id) + 1;
    ops.push({
      k: 'text',
      x: r.x + r.width / 2,
      y: r.y + r.height - docMarginPx(doc.style) / 2 + 4,
      text: String(n),
      family: resolveFontStack(style.bodyFont) ?? 'system-ui, sans-serif',
      size: 12,
      weight: '400',
      style: 'normal',
      color: 'rgb(71 85 105)',
      anchor: 'middle',
    });
  }
  return { ops, fonts: [style.headingFont, style.bodyFont, 'roboto-mono'] };
}

/** A document page's Lines drawn on its writing's baselines inside its margins. */
export function pageRulingOf(
  tab: Tab,
  page: LaidOutPage,
): { pitch: number; inset: number } | undefined {
  if (!page.flow) return undefined;
  const doc = docsOf(tab)[page.flow];
  return doc ? { pitch: docBodyLinePx(doc.style), inset: docMarginPx(doc.style) } : undefined;
}
