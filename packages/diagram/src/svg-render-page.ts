// A Page in the export (docs/specs/009-elements/page-element.md), drawn as the canvas draws it
// (PageMasthead, PageCornerFold): the masthead inside the border and the
// padding, the body label under its rule, and the turned-back corner.

import type { BoxedElement } from './index';
import { borderOf } from './svg-render-border';
import { r2, xmlEscape } from './svg-render-primitives';

// PageMasthead's two lines always hold their height (a 19px leading-tight
// title, a 2px gap, a 12px leading-snug subtitle), then pb-2 and the 1px rule.
const TITLE_LINE_PX = 23.75;
const SUBTITLE_LINE_PX = 16.5;
export const PAGE_MASTHEAD_PX = TITLE_LINE_PX + 2 + SUBTITLE_LINE_PX + 8 + 1;
// PageCornerFold's leaf, capped at half the page.
const FOLD_PX = 22;

type Page = BoxedElement & { type: 'shape' };

const family = (fontFamily?: string) =>
  ` font-family="${xmlEscape(fontFamily ?? 'system-ui, sans-serif')}"`;

/** Where a page's body starts: under the border, the padding and the rule. */
export function pageBodyTop(el: Page, padding: number): number {
  return el.y + borderOf(el).width + padding + PAGE_MASTHEAD_PX;
}

export function svgPageMasthead(el: Page, padding: number, fontFamily?: string): string {
  const inset = borderOf(el).width + padding;
  const x = el.x + inset;
  const top = el.y + inset;
  const title = el.pageTitle ?? '';
  const subtitle = el.pageSubtitle ?? '';
  const ruleY = top + PAGE_MASTHEAD_PX - 0.5;
  return (
    (title
      ? `<text x="${r2(x)}" y="${r2(top + 18)}"${family(fontFamily)} font-size="19" font-weight="600" fill="#0f172a">${xmlEscape(title)}</text>`
      : '') +
    (subtitle
      ? `<text x="${r2(x)}" y="${r2(top + TITLE_LINE_PX + 2 + 12.5)}"${family(fontFamily)} font-size="12" font-weight="500" fill="#64748b">${xmlEscape(subtitle)}</text>`
      : '') +
    `<path d="M ${r2(x)} ${r2(ruleY)} L ${r2(el.x + el.width - inset)} ${r2(ruleY)}" stroke="${xmlEscape(el.strokeColor ?? '#d4d4d8')}" stroke-width="1"/>`
  );
}

/** The turned-back bottom-right corner: the cut painted as the paper under
 *  the page, the leaf over it a shade darker, and its diagonal edge. */
export function svgPageFold(el: Page, fill: string, stroke: string, paper: string): string {
  const size = Math.min(FOLD_PX, el.width / 2, el.height / 2);
  if (size <= 2) return '';
  const x = el.x + el.width - size;
  const y = el.y + el.height - size;
  const leaf = `M ${r2(x + size)} ${r2(y)} L ${r2(x)} ${r2(y + size)} L ${r2(x + size)} ${r2(y + size)} Z`;
  return (
    `<path d="M ${r2(x + size)} ${r2(y)} L ${r2(x + size)} ${r2(y + size)} L ${r2(x)} ${r2(y + size)} Z" fill="${xmlEscape(paper)}"/>` +
    `<path d="${leaf}" fill="${xmlEscape(fill)}" stroke="${xmlEscape(stroke)}" stroke-width="1"/>` +
    `<path d="${leaf}" fill="#0f172a" fill-opacity="0.1"/>` +
    `<path d="M ${r2(x + size)} ${r2(y)} L ${r2(x)} ${r2(y + size)}" stroke="${xmlEscape(stroke)}" stroke-width="1" fill="none"/>`
  );
}
