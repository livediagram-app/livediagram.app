// Exporting one Infographic page (docs/specs/007-editor/illustrate-pages.md "Export"): exactly its
// sheet. The frame is the page's rect with no padding; the background is the page's own paint
// (the paper exports white); the elements are those that reach onto the page, cut off at its edges
// by the frame itself; and every element without colours of its own is inked for the page. The
// background is one SVG fragment, so the SVG export and the PNG / PDF rasteriser paint the same.
import {
  endpointPosition,
  pageSurface,
  type CanvasSurface,
  type Element,
  type LaidOutPage,
  type PageFill,
} from '@livediagram/document';
import { xmlEscape } from '@livediagram/icons';
import { PAGE_PATTERN_PITCH, pagePatternInk } from './illustrate-page-paint';

// The paper's colour in an export: the page as printed.
export const EXPORT_PAPER = '#ffffff';

export type PageExportFrame = {
  bounds: { x: number; y: number; w: number; h: number };
  surface: CanvasSurface;
  // The page's background as SVG markup in canvas coordinates (defs included).
  backgroundSvg: string;
  // Whether an element reaches onto the page (the rest are left out); an arrow by its resolved
  // ends, against the tab's elements.
  reaches: (el: Element, elements: readonly Element[]) => boolean;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

// A CSS linear-gradient's line (docs: CSS Images 3) as SVG user-space end points: through the
// box's centre at the angle (0deg runs bottom to top, 90deg left to right), as long as the box's
// projection onto it.
function gradientLine(fill: Extract<PageFill, { kind: 'gradient' }>, r: LaidOutPage['rect']) {
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
    paper = EXPORT_PAPER,
    idPrefix = 'lvd-page',
    ruling,
  }: {
    // The plain paper's colour: white in an export; the canvas's own paper where a page is drawn
    // as the canvas shows it (the Map).
    paper?: string;
    // Prefixes the gradient and pattern ids: pages of different tabs share ids (every tab's first
    // page), so markup inlined beside other pages' (slide thumbnails, the Map) needs its own.
    idPrefix?: string;
    // A document page's Lines, on its writing's baselines inside its margins
    // (docs/specs/007-editor/article-pages.md "Article style").
    ruling?: { pitch: number; inset: number; top: number };
  } = {},
): PageExportFrame {
  const r = page.rect;
  const { fill, pattern } = page.background ?? {};
  const id = `${idPrefix}-${page.id}`.replace(/[^a-zA-Z0-9-]/g, '');
  const rect = (paint: string) =>
    `<rect x="${r2(r.x)}" y="${r2(r.y)}" width="${r2(r.width)}" height="${r2(r.height)}" fill="${paint}"/>`;
  const parts: string[] = [];
  if (fill?.kind === 'gradient') {
    const l = gradientLine(fill, r);
    parts.push(
      `<defs><linearGradient id="${id}-fill" gradientUnits="userSpaceOnUse" x1="${r2(l.x1)}" y1="${r2(l.y1)}" x2="${r2(l.x2)}" y2="${r2(l.y2)}">` +
        `<stop offset="0" stop-color="${xmlEscape(fill.from)}"/><stop offset="1" stop-color="${xmlEscape(fill.to)}"/>` +
        `</linearGradient></defs>`,
      rect(`url(#${id}-fill)`),
    );
  } else {
    parts.push(rect(xmlEscape(fill?.color ?? paper)));
  }
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
  return {
    bounds: { x: r.x, y: r.y, w: r.width, h: r.height },
    surface: pageSurface(page) ?? 'light',
    backgroundSvg: parts.join(''),
    reaches: (el, elements) => {
      const overlaps = (x: number, y: number, rr: number, b: number) =>
        x <= r.x + r.width && rr >= r.x && y <= r.y + r.height && b >= r.y;
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
