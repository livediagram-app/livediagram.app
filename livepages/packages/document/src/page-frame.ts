// One page as an export draws it (docs/specs/007-editor/pages-mode.md "Export"): exactly its
// sheet. The frame is the page's rect with no padding; the background is the page's own paint (the paper exports
// white): a fill, a gradient, a picture with its overlay, and a pattern; the elements are those that reach onto
// the page, cut off at its edges by the frame itself; and every element without colours of its own is inked for the
// page. The background is one SVG fragment, so the editor's SVG export, its PNG / PDF rasteriser and an agent's
// preview (apps/mcp) paint the same. Pure.
import type { CanvasSurface } from './colors';
import type { Element } from './index';
import { endpointPosition } from './geometry';
import { pageIsDark, pageSurface } from './page-content';
import { pageImageOverlayColor, pageImageTone } from './page-image';
import type { LaidOutPage, PageBackground, PageFill } from './page';
import type { PageImageFill } from './page-image';
import { r2, xmlEscape } from './svg-render-primitives';
import { pageScreenRect, wireframeFrameSvg } from './wireframe-page';
import type { WireframeFrameTheme } from './wireframe-device-svg';

// The pattern's pitch on a page, in px (the page panel's dots, grid and lines).
export const PAGE_PATTERN_PITCH = 24;

/** The elements' markup cut to a wireframe page's screen, and its overlay after them; as it is on
 *  any other page. */
export function withinPageFrame(
  frame: Pick<PageExportFrame, 'clipId' | 'overlaySvg'> | null | undefined,
  elementsSvg: string,
): string {
  if (!frame?.clipId) return elementsSvg;
  return `<g clip-path="url(#${frame.clipId})">${elementsSvg}</g>${frame.overlaySvg ?? ''}`;
}

/** The pattern's ink on a page: faint white on a dark fill, faint slate on a light one (and on the
 *  plain paper, whose sheet sets it by class on screen). */
export function pagePatternInk(background: PageBackground | undefined): string {
  return pageIsDark({ background }) ? 'rgb(255 255 255 / 0.14)' : 'rgb(15 23 42 / 0.1)';
}

/**
 * The page's picture as SVG in canvas coordinates: its tone, the picture cropped to cover the rect
 * (when its bytes are at hand as `href`), then its overlay. Ids are prefixed with `id`.
 */
export function pageImageSvg(
  fill: PageImageFill,
  rect: { x: number; y: number; width: number; height: number },
  href: string | undefined,
  id: string,
): string {
  const box = `x="${r2(rect.x)}" y="${r2(rect.y)}" width="${r2(rect.width)}" height="${r2(rect.height)}"`;
  // Under it all, the picture's tone: what shows where its bytes cannot be read.
  const parts = [`<rect ${box} fill="${xmlEscape(pageImageTone({ tone: fill.tone }))}"/>`];
  if (href) {
    const align =
      fill.position === 'top' ? 'xMidYMin' : fill.position === 'bottom' ? 'xMidYMax' : 'xMidYMid';
    parts.push(`<image ${box} href="${xmlEscape(href)}" preserveAspectRatio="${align} slice"/>`);
  }
  const o = fill.overlay;
  if (o) {
    const colour = xmlEscape(pageImageOverlayColor(o));
    if (o.kind === 'fade') {
      parts.push(
        `<defs><linearGradient id="${id}-fade" x1="0" y1="0" x2="0" y2="1">` +
          `<stop offset="0" stop-color="${colour}" stop-opacity="0"/>` +
          `<stop offset="1" stop-color="${colour}" stop-opacity="${r2(o.strength)}"/>` +
          `</linearGradient></defs>`,
        `<rect ${box} fill="url(#${id}-fade)"/>`,
      );
    } else {
      parts.push(`<rect ${box} fill="${colour}" fill-opacity="${r2(o.strength)}"/>`);
    }
  }
  return parts.join('');
}

// The paper's colour in an export: the page as printed.
export const PAGE_EXPORT_PAPER = '#ffffff';

export type PageExportFrame = {
  bounds: { x: number; y: number; w: number; h: number };
  surface: CanvasSurface;
  // The page's background as SVG markup in canvas coordinates (defs included).
  backgroundSvg: string;
  // True when the page has no paper at all: a logo page on plain paper exported see-through
  // (docs/specs/007-editor/logo-pages.md "Export"), and a wireframe page round its device
  // (docs/specs/007-editor/wireframe-pages.md "Export").
  transparent: boolean;
  // A wireframe page's screen outline (SVG path data, canvas coordinates): what its elements are
  // cut off at. Absent: the frame's bounds cut them.
  clipPath?: string;
  // The id of the <clipPath> of it that `backgroundSvg` defines, for an SVG drawing it in one document.
  clipId?: string;
  // Markup drawn over the elements: a wireframe page's camera in its screen and its system bars.
  overlaySvg?: string;
  // Whether an element reaches onto the page (the rest are left out); an arrow by its resolved
  // ends, against the tab's elements.
  reaches: (el: Element, elements: readonly Element[]) => boolean;
};

// A CSS linear-gradient's line (docs: CSS Images 3) as SVG user-space end points: through the
// box's centre at the angle (0deg runs bottom to top, 90deg left to right), as long as the box's
// projection onto it.
export function pageGradientLine(
  fill: Extract<PageFill, { kind: 'gradient' }>,
  r: LaidOutPage['rect'],
) {
  const a = (fill.angle * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const half = (Math.abs(r.width * dx) + Math.abs(r.height * dy)) / 2;
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  return { x1: cx - dx * half, y1: cy - dy * half, x2: cx + dx * half, y2: cy + dy * half };
}

function patternTile(pattern: string, ink: string): string {
  const p = PAGE_PATTERN_PITCH;
  const fill = `fill="${xmlEscape(ink)}"`;
  if (pattern === 'dots') return `<circle cx="${p / 2}" cy="${p / 2}" r="1.6" ${fill}/>`;
  if (pattern === 'grid')
    return `<rect width="${p}" height="1" ${fill}/><rect width="1" height="${p}" ${fill}/>`;
  return `<rect y="${p - 1}" width="${p}" height="1" ${fill}/>`;
}

export function pageExportFrame(
  page: LaidOutPage,
  {
    paper = PAGE_EXPORT_PAPER,
    idPrefix = 'lvd-page',
    ruling,
    transparentPaper = false,
    imageHref,
    overFill,
    frameTheme,
  }: {
    // The plain paper's colour: white in an export; the canvas's own paper where a page is drawn
    // as the canvas shows it (the Map).
    paper?: string;
    // Prefixes the gradient and pattern ids: pages of different tabs share ids (every tab's first
    // page), so markup inlined beside other pages' (slide thumbnails, the Map) needs its own.
    idPrefix?: string;
    // An article page's Lines, on its writing's baselines inside its margins
    // (docs/specs/007-editor/article-pages.md "Article style").
    ruling?: { pitch: number; inset: number; top: number };
    // A logo page's plain paper is left out (a logo goes over other things); a fill is kept.
    transparentPaper?: boolean;
    // A page picture's bytes by gallery id (a data URL, export-tab-images), to embed. Without them
    // (the Map, slide thumbnails) the page is painted in the picture's tone under its overlay.
    imageHref?: (imageId: string) => string | undefined;
    // Markup laid over the fill and under its pattern: a slide's animated background as it stands when the
    // slide opens (docs/specs/007-editor/pages-mode.md "Animated backgrounds"). The SVG's is an opaque
    // picture of the gradient with the motion painted in, so it takes the fill's place; laid over the pattern it
    // would hide it.
    overFill?: string;
    // The tab theme's colours, for a wireframe page's frame in the Theme look.
    frameTheme?: WireframeFrameTheme;
  } = {},
): PageExportFrame {
  // A wireframe page's paint is its screen's, inside its device (docs/specs/007-editor/
  // wireframe-pages.md "The screen"); any other page's is its sheet's.
  const device = wireframeFrameSvg(page, {
    dark: pageIsDark(page),
    ...(frameTheme ? { theme: frameTheme } : {}),
  });
  const r = device ? pageScreenRect(page) : page.rect;
  const { fill, pattern } = page.background ?? {};
  const id = `${idPrefix}-${page.id}`.replace(/[^a-zA-Z0-9-]/g, '');
  const rect = (paint: string) =>
    `<rect x="${r2(r.x)}" y="${r2(r.y)}" width="${r2(r.width)}" height="${r2(r.height)}" fill="${paint}"/>`;
  const parts: string[] = [];
  const transparent = !!device || (transparentPaper && page.kind === 'logo' && !fill);
  if (fill?.kind === 'gradient') {
    const l = pageGradientLine(fill, r);
    parts.push(
      `<defs><linearGradient id="${id}-fill" gradientUnits="userSpaceOnUse" x1="${r2(l.x1)}" y1="${r2(l.y1)}" x2="${r2(l.x2)}" y2="${r2(l.y2)}">` +
        `<stop offset="0" stop-color="${xmlEscape(fill.from)}"/><stop offset="1" stop-color="${xmlEscape(fill.to)}"/>` +
        `</linearGradient></defs>`,
      rect(`url(#${id}-fill)`),
    );
  } else if (fill?.kind === 'image') {
    // Offline Mode's inline bytes are the picture itself; a gallery id is looked up.
    const href = fill.imageId.startsWith('data:') ? fill.imageId : imageHref?.(fill.imageId);
    parts.push(pageImageSvg(fill, r, href, id));
  } else if (!transparent || device) {
    parts.push(rect(xmlEscape(fill?.color ?? paper)));
  }
  if (overFill) parts.push(overFill);
  if (pattern && ruling && pattern === 'lines') {
    // Ruled inside the margins, one line under each line of body text.
    const p = ruling.pitch;
    const ink = xmlEscape(pagePatternInk(page.background));
    parts.push(
      `<defs><pattern id="${id}-pattern" patternUnits="userSpaceOnUse" x="${r2(r.x + ruling.inset)}" y="${r2(r.y + ruling.top)}" width="${r2(r.width - 2 * ruling.inset)}" height="${r2(p)}">` +
        `<rect y="${r2(p - 1)}" width="${r2(r.width - 2 * ruling.inset)}" height="1" fill="${ink}"/></pattern></defs>`,
      `<rect x="${r2(r.x + ruling.inset)}" y="${r2(r.y + ruling.top)}" width="${r2(r.width - 2 * ruling.inset)}" height="${r2(r.height - ruling.top - ruling.inset)}" fill="url(#${id}-pattern)"/>`,
    );
  } else if (pattern) {
    const p = PAGE_PATTERN_PITCH;
    parts.push(
      `<defs><pattern id="${id}-pattern" patternUnits="userSpaceOnUse" x="${r2(r.x)}" y="${r2(r.y)}" width="${p}" height="${p}">` +
        `${patternTile(pattern, pagePatternInk(page.background))}</pattern></defs>`,
      rect(`url(#${id}-pattern)`),
    );
  }
  const p = page.rect;
  return {
    bounds: { x: p.x, y: p.y, w: p.width, h: p.height },
    surface: pageSurface(page) ?? 'light',
    // A device's frame under its screen, the screen's paint cut to its rounded outline.
    backgroundSvg: device
      ? `<defs><clipPath id="${id}-screen"><path d="${device.screen}"/></clipPath></defs>` +
        device.under +
        `<g clip-path="url(#${id}-screen)">${parts.join('')}</g>`
      : parts.join(''),
    transparent,
    ...(device ? { clipPath: device.screen, clipId: `${id}-screen`, overlaySvg: device.over } : {}),
    reaches: (el, elements) => {
      // An article's note marker is the editor's, never part of the page: no export or preview draws it.
      if (el.type === 'annotation' && el.articleNote) return false;
      const overlaps = (x: number, y: number, rr: number, b: number) =>
        x <= p.x + p.width && rr >= p.x && y <= p.y + p.height && b >= p.y;
      if (el.type !== 'arrow') return overlaps(el.x, el.y, el.x + el.width, el.y + el.height);
      const a = endpointPosition(el.from, elements as Element[]);
      const b = endpointPosition(el.to, elements as Element[]);
      return overlaps(
        Math.min(a.x, b.x),
        Math.min(a.y, b.y),
        Math.max(a.x, b.x),
        Math.max(a.y, b.y),
      );
    },
  };
}
