// Drawing a page design (docs/specs/011-theme/blueprints/page-designs.md "Drawing", "Still frame"): its layers for a
// page, memoised so a deck of same-sized pages draws once, and the still frame every export, thumbnail and preview
// paints. Pure.
import { PAGE_DESIGN_BY_ID, type PageDesignId } from './catalogue';
import { grainSvg, n, seeded, type DesignLayer, type DesignPalette } from './draw-kit';
import { DESIGN_DRAWERS } from './drawers';
import type { DesignTuning, PageDesign } from './tuning';
import { resolveTuning } from './tuning';

/** The design cache's size: 100 pages (the page cap) and room for previews and tiles. */
export const DESIGN_CACHE_MAX = 160;

/** Where a page sits in a flowing strip: its left edge's offset and the strip's whole width. */
export type DesignStrip = { x: number; span: number };

/** What a design is drawn for. */
export type DesignPaintInput = {
  design: PageDesign;
  // Tuning after the page's role (rhythm) is applied; else the design's own.
  tuning?: DesignTuning;
  palette: DesignPalette;
  width: number;
  height: number;
  strip?: DesignStrip;
  // The tab's font, a CSS font stack (Type Watermark draws in it).
  font?: string;
};

/** A design drawn for a page: its layers (ids unique to the drawing) and how its root shows them. */
export type PaintedDesign = {
  id: PageDesignId;
  key: string;
  uid: string;
  width: number;
  height: number;
  layers: readonly DesignLayer[];
  intensity: number;
  calm: number;
  grain: number;
  animate: boolean;
  speed: number;
  palette: DesignPalette;
  tuning: DesignTuning;
};

const DEFAULT_FONT = 'Inter, system-ui, sans-serif';

/** A short stable hash of a string (FNV-1a), in base 36. */
export function hashKey(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const cache = new Map<string, readonly DesignLayer[]>();

function drawKey(input: DesignPaintInput, t: DesignTuning): string {
  const p = input.palette;
  return [
    input.design.id,
    Math.round(input.width),
    Math.round(input.height),
    p.a,
    p.b,
    p.c,
    p.ink,
    p.base,
    p.dark ? 1 : 0,
    t.scale,
    t.angle,
    t.focus[0],
    t.focus[1],
    t.seed,
    t.blur,
    t.variant,
    input.strip ? `${Math.round(input.strip.x)}/${Math.round(input.strip.span)}` : '',
    input.design.id === 'type-watermark' ? (input.font ?? '') : '',
  ].join('|');
}

/** The design's layers for a page, from the cache when it has drawn the same before. */
export function paintPageDesign(input: DesignPaintInput): PaintedDesign {
  const t = input.tuning ?? resolveTuning(input.design);
  const key = drawKey(input, t);
  const uid = `pd${hashKey(key)}`;
  let layers = cache.get(key);
  if (layers) {
    // Most recently used goes last.
    cache.delete(key);
    cache.set(key, layers);
  } else {
    const w = Math.max(1, input.width);
    const h = Math.max(1, input.height);
    const draw = DESIGN_DRAWERS[input.design.id];
    layers = draw({
      w,
      h,
      p: input.palette,
      t,
      rnd: seeded(t.seed * 7919 + 17),
      uid,
      ox: input.strip?.x ?? 0,
      span: Math.max(w, input.strip?.span ?? w),
      font: input.font ?? DEFAULT_FONT,
    });
    // A design that does not animate has no moving layer, whatever it drew.
    if (!PAGE_DESIGN_BY_ID[input.design.id].animates)
      layers = layers.map(({ svg, defs }) => ({ svg, ...(defs ? { defs } : {}) }));
    cache.set(key, layers);
    if (cache.size > DESIGN_CACHE_MAX) cache.delete(cache.keys().next().value!);
  }
  return {
    id: input.design.id,
    key,
    uid,
    width: input.width,
    height: input.height,
    layers,
    intensity: t.intensity,
    calm: t.calm,
    grain: t.grain,
    animate: t.animate && PAGE_DESIGN_BY_ID[input.design.id].animates === true,
    speed: t.speed,
    palette: input.palette,
    tuning: t,
  };
}

/** Empties the drawing cache (tests). */
export function clearPageDesignCache(): void {
  cache.clear();
}

/** How many drawings the cache holds (tests). */
export function pageDesignCacheSize(): number {
  return cache.size;
}

/** The calm (safe area) as stops of a radial mask: each an offset and the design's share there, the middle quietest.
 *  The screen's CSS mask and the still frame's SVG mask use the same stops. */
export function calmStops(calm: number): [offset: number, alpha: number][] {
  const c = Math.max(0, Math.min(1, calm));
  return [
    [0, 1 - c * 0.92],
    [0.45, 1 - c * 0.8],
    [0.8, 1 - c * 0.25],
    [1, 1],
  ];
}

/** The calm as a CSS mask image: an ellipse fitting the page, the middle quietest. */
export function calmMaskCss(calm: number): string | undefined {
  if (calm <= 0.001) return undefined;
  const stops = calmStops(calm)
    .map(([o, a]) => `rgba(0,0,0,${n(a)}) ${n(o * 100)}%`)
    .join(', ');
  return `radial-gradient(closest-side ellipse at 50% 50%, ${stops})`;
}

/** The grain over a design: a fine static noise in the ink, its share of the intensity. */
export function grainLayerSvg(
  d: Pick<PaintedDesign, 'uid' | 'width' | 'height' | 'grain' | 'palette' | 'tuning'>,
) {
  if (d.grain <= 0.001) return '';
  return grainSvg(
    `${d.uid}-grain`,
    d.width,
    d.height,
    d.palette.ink,
    d.grain * 0.55,
    d.tuning.seed,
    0.9,
  );
}

/** A rounded plate behind text, in page px. */
export type DesignScrim = {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  opacity: number;
};

/** The scrims' markup, in page px. */
export function scrimsSvg(scrims: readonly DesignScrim[]): string {
  return scrims
    .map(
      (s) =>
        `<rect x="${n(s.x)}" y="${n(s.y)}" width="${n(s.width)}" height="${n(s.height)}" rx="12" fill="${s.fill}" fill-opacity="${n(s.opacity)}"/>`,
    )
    .join('');
}

/**
 * The design's still frame as one SVG group at `x`, `y` (the page's corner in the frame's px): every layer at rest,
 * clipped to the page, with the calm mask, the grain and the scrims. `idPrefix` keeps two frames' ids apart in one
 * document (an export of several pages).
 */
export function pageDesignSvg(
  d: PaintedDesign,
  at: { x: number; y: number },
  scrims: readonly DesignScrim[] = [],
  idPrefix = '',
): string {
  const uid = `${idPrefix}${d.uid}`;
  const body = (d.layers.map((l) => (l.defs ?? '') + l.svg).join('') + grainLayerSvg(d)).replaceAll(
    d.uid,
    uid,
  );
  const clip = `${uid}-clip`;
  const mask = `${uid}-calm`;
  const calm = d.calm > 0.001;
  const stops = calmStops(d.calm)
    .map(([o, a]) => `<stop offset="${n(o)}" stop-color="#fff" stop-opacity="${n(a)}"/>`)
    .join('');
  return (
    `<g transform="translate(${n(at.x)} ${n(at.y)})" aria-hidden="true">` +
    `<defs><clipPath id="${clip}"><rect width="${n(d.width)}" height="${n(d.height)}"/></clipPath>` +
    (calm
      ? `<radialGradient id="${mask}-g" cx="0.5" cy="0.5" r="0.5">${stops}</radialGradient>` +
        `<mask id="${mask}" maskUnits="userSpaceOnUse" x="0" y="0" width="${n(d.width)}" height="${n(d.height)}">` +
        `<rect width="${n(d.width)}" height="${n(d.height)}" fill="url(#${mask}-g)"/></mask>`
      : '') +
    `</defs><g clip-path="url(#${clip})">` +
    `<g opacity="${n(d.intensity)}"${calm ? ` mask="url(#${mask})"` : ''}>${body}</g>` +
    scrimsSvg(scrims) +
    `</g></g>`
  );
}
