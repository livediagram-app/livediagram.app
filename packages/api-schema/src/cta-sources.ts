// Landing funnel (spec/153): the closed vocabulary of calls to action that
// link into the editor, and the helpers every end of the funnel shares. A
// CTA's href carries `via=<Surface>.<Slot>`; the editor's /new page reads it
// back through `ctaSourceFromSearch` and reports `Cta·Opened` / `Cta·Created`
// with it; the ingest accepts a `Cta` type only if `isCtaSource` does; the
// dashboard maps page views onto the same surfaces with `ctaSurfaceOfPath`.
// One table, so a CTA can't be linked with a source the others don't know.

// Which slots each public surface has. A source names a button, never a
// visitor: the only values it can ever take are the ones below.
export const CTA_SOURCES = {
  Home: ['Header', 'HeaderDraw', 'Hero', 'HeroDraw', 'Gallery', 'GalleryDraw', 'Closing'],
  Feature: ['Header', 'HeaderDraw', 'Hero', 'Closing'],
  Compare: ['Header', 'HeaderDraw', 'Card'],
  Faq: ['Header', 'HeaderDraw', 'Card'],
  Status: ['Header', 'HeaderDraw'],
  Dashboard: ['Header', 'HeaderDraw'],
  Help: ['Header'],
} as const satisfies Record<string, readonly string[]>;

export type CtaSurface = keyof typeof CTA_SOURCES;
export type CtaSlot<S extends CtaSurface = CtaSurface> = (typeof CTA_SOURCES)[S][number];
export type CtaSource = { [S in CtaSurface]: `${S}.${CtaSlot<S>}` }[CtaSurface];

export const CTA_SURFACES = Object.keys(CTA_SOURCES) as CtaSurface[];

// Every source, in table order (surface by surface, slots as listed).
export const ALL_CTA_SOURCES: readonly CtaSource[] = CTA_SURFACES.flatMap((surface) =>
  CTA_SOURCES[surface].map((slot) => `${surface}.${slot}` as CtaSource),
);

// The query parameter a CTA's href carries its source in.
export const CTA_VIA_PARAM = 'via';

export function isCtaSource(value: unknown): value is CtaSource {
  return typeof value === 'string' && (ALL_CTA_SOURCES as readonly string[]).includes(value);
}

export function ctaSurfaceOf(source: CtaSource): CtaSurface {
  return source.slice(0, source.indexOf('.')) as CtaSurface;
}

export function ctaSlotOf(source: CtaSource): CtaSlot {
  return source.slice(source.indexOf('.') + 1) as CtaSlot;
}

/**
 * A CTA's href: `href` with `via=<source>` added, keeping any query it has
 * (`/new?blank=1` becomes `/new?blank=1&via=Home.HeroDraw`) and any hash.
 */
export function ctaHref(href: string, source: CtaSource): string {
  const hashAt = href.indexOf('#');
  const base = hashAt === -1 ? href : href.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : href.slice(hashAt);
  const joiner = base.includes('?') ? (base.endsWith('?') || base.endsWith('&') ? '' : '&') : '?';
  return `${base}${joiner}${CTA_VIA_PARAM}=${encodeURIComponent(source)}${hash}`;
}

/**
 * The source a /new URL's query names, or null. An unknown value (a stale
 * link after a slot was renamed, or a hand-edited URL) is ignored rather than
 * guessed, so the visit counts as an ordinary /new.
 */
export function ctaSourceFromSearch(search: string): CtaSource | null {
  const via = new URLSearchParams(search).get(CTA_VIA_PARAM);
  return isCtaSource(via) ? via : null;
}

/**
 * Which surface a normalised page-view path (spec/150) belongs to, or null for
 * a page that isn't a CTA surface (the editor, the Explorer, ...). The
 * dashboard reads the funnel's first step, page views, through this.
 */
export function ctaSurfaceOfPath(path: string): CtaSurface | null {
  if (path === '/') return 'Home';
  const [first] = path.split('/').filter(Boolean);
  switch (first) {
    case 'features':
      return path === '/features' ? null : 'Feature';
    case 'alternatives':
      return 'Compare';
    case 'faq':
      return 'Faq';
    case 'status':
      return 'Status';
    case 'telemetry':
      return 'Dashboard';
    case 'help':
      return 'Help';
    default:
      return null;
  }
}
