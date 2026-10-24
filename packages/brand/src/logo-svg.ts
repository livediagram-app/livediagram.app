import { BRAND_APPS, type BrandApp } from './apps';
import { BRAND_MARK_VIEWBOX, brandMarkSvg } from './geometry';
import type { PrismScheme } from './prism';

// An app's horizontal lockup (mark + "live<word>" wordmark) as a standalone SVG,
// for its marketing/media/logo/. The wordmark follows the spec's split: "live" in
// the accent, the app's word in ink. It is set as live text in the system UI stack
// the apps use, so it renders in the viewer's font; outline it in a design tool
// before print use.

// Lockup box: the 270-unit mark, a 24-unit gap, then the wordmark.
const BRAND_LOGO_SIZE = { width: 1040, height: 270 } as const;
const FONT_STACK = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function brandLogoSvg(app: BrandApp, scheme: PrismScheme): string {
  const mark = brandMarkSvg({ app, variant: 'full', scheme, idPrefix: 'm-' }).replace(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_MARK_VIEWBOX}"`,
    `<svg x="0" y="0" width="270" height="270" viewBox="${BRAND_MARK_VIEWBOX}"`,
  );
  const { word, lockup } = BRAND_APPS[app];
  const { accent, ink } = lockup[scheme];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BRAND_LOGO_SIZE.width} ${BRAND_LOGO_SIZE.height}">` +
    mark +
    `<text x="294" y="178" font-family="${FONT_STACK}" font-size="128" font-weight="600" letter-spacing="-3">` +
    `<tspan fill="${accent}">live</tspan><tspan fill="${ink}">${word}</tspan></text>` +
    `</svg>`
  );
}
