// Where each page of an old Pages tab sat on its canvas, for the splitter's `pageRects` hook (docs/migration.md,
// step 3: an element goes with the page its centre is on).
//
// This is the old site's own layout, because the old canvas is what placed the elements: its
// packages/document/src/page.ts (pagesOf, pageDimensions, layOutPages) at the production schema level, cut down to
// the geometry. No product today knows all five page kinds: livedocuments' page.ts reads a logo or wireframe page as
// A4 and livedesign's reads an article or slide that way, so neither would put a mixed tab's pages where they were. The
// wireframe devices' frames are livedesign's wireframe-device.ts, which is the old file unchanged (a leaf module with
// no imports).
import {
  DEFAULT_WIREFRAME_DEVICE,
  WIREFRAME_DEVICES,
  deviceGeometry,
  isWireframeDeviceId,
  type WireframeDeviceId,
} from '../../../../livedesign/packages/design/src/wireframe-device.ts';

export type PageRect = { pageId: string; x: number; y: number; width: number; height: number };

type Orientation = 'portrait' | 'landscape';
type Size =
  | 'a4'
  | 'letter'
  | 'a3'
  | 'square'
  | 'social'
  | 'wide'
  | 'slide'
  | 'slide-classic'
  | 'logo'
  | 'device'
  | 'fit';

const A4_SHORT_SIDE = 794;
const A4_LONG_SIDE = 1123;
const PAGE_GAP = 96;
const MAX_PAGES = 100;
const LOGO_SIDE = 1024;
const FIT_PAGE_MIN_SIDE = 200;
const FIT_PAGE_MAX_SIDE = 19200;

const SIZES: Readonly<
  Record<
    Size,
    { short: number; long: number; landscapeOnly?: true; logoOnly?: true; deviceOnly?: true }
  >
> = {
  a4: { short: A4_SHORT_SIDE, long: A4_LONG_SIDE },
  letter: { short: 816, long: 1056 },
  a3: { short: 1123, long: 1587 },
  square: { short: 1080, long: 1080 },
  social: { short: 1080, long: 1350 },
  wide: { short: 1080, long: 1920 },
  slide: { short: 1080, long: 1920, landscapeOnly: true },
  'slide-classic': { short: 1080, long: 1440, landscapeOnly: true },
  logo: { short: LOGO_SIDE, long: LOGO_SIDE, logoOnly: true },
  device: { short: 423, long: 876, deviceOnly: true },
  fit: { short: A4_SHORT_SIDE, long: A4_LONG_SIDE },
};
const SLIDE_SIZES: readonly Size[] = ['slide', 'slide-classic'];

type Page = {
  id: string;
  orientation: Orientation;
  size?: Size;
  fit?: { width: number; height: number };
  rowAt?: { x: number; y: number };
  flow?: string;
  device?: WireframeDeviceId;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isSize = (v: unknown): v is Size => typeof v === 'string' && Object.hasOwn(SIZES, v);
const isOrientation = (v: unknown): v is Orientation => v === 'portrait' || v === 'landscape';
const clampSide = (n: number) =>
  Math.min(FIT_PAGE_MAX_SIDE, Math.max(FIT_PAGE_MIN_SIDE, Math.round(n)));

function parseFit(v: unknown): Page['fit'] {
  if (!isRecord(v) || !isNumber(v.width) || !isNumber(v.height) || v.width <= 0 || v.height <= 0)
    return undefined;
  return { width: clampSide(v.width), height: clampSide(v.height) };
}

function parseRowAt(v: unknown): Page['rowAt'] {
  if (!isRecord(v) || !isNumber(v.x) || !isNumber(v.y)) return undefined;
  return { x: Math.round(v.x), y: Math.round(v.y) };
}

// The old parsePageFields, keeping what decides a page's place and size.
function parsePage(v: unknown): Page | undefined {
  if (!isRecord(v) || typeof v.id !== 'string' || !isOrientation(v.orientation)) return undefined;
  const rowAt = parseRowAt(v.rowAt);
  const at = rowAt ? { rowAt } : {};
  if (v.kind === 'slide') {
    const size = isSize(v.size) && SLIDE_SIZES.includes(v.size) ? v.size : 'slide';
    return { id: v.id, orientation: 'landscape', size, ...at };
  }
  if (v.kind === 'logo') return { id: v.id, orientation: 'portrait', size: 'logo', ...at };
  if (v.kind === 'wireframe') {
    const device = isWireframeDeviceId(v.device) ? v.device : DEFAULT_WIREFRAME_DEVICE;
    const orientation = WIREFRAME_DEVICES[device].turns ? v.orientation : 'portrait';
    return { id: v.id, orientation, size: 'device', device, ...at };
  }
  const flow =
    v.kind === 'article'
      ? typeof v.flow === 'string' && v.flow.length > 0 && v.flow.length <= 64
        ? v.flow
        : v.id
      : undefined;
  const fit = v.size === 'fit' && v.kind !== 'article' ? parseFit(v.fit) : undefined;
  const ownSize =
    isSize(v.size) &&
    v.size !== 'a4' &&
    !SIZES[v.size].logoOnly &&
    !SIZES[v.size].deviceOnly &&
    (v.size !== 'fit' || fit !== undefined);
  return {
    id: v.id,
    orientation: v.orientation,
    ...(ownSize ? { size: v.size as Size } : {}),
    ...(ownSize && fit ? { fit } : {}),
    ...(flow ? { flow } : {}),
    ...at,
  };
}

// The old withArticlesTogether: an article's pages join its first page's run and take its size and orientation.
function withArticlesTogether(pages: Page[]): Page[] {
  const byFlow = new Map<string, Page[]>();
  for (const p of pages) {
    if (!p.flow) continue;
    const run = byFlow.get(p.flow);
    if (run) run.push(p);
    else byFlow.set(p.flow, [p]);
  }
  if (byFlow.size === 0) return pages;
  const out: Page[] = [];
  for (const p of pages) {
    if (!p.flow) {
      out.push(p);
      continue;
    }
    const run = byFlow.get(p.flow);
    if (!run) continue;
    byFlow.delete(p.flow);
    const [lead, ...rest] = run as [Page, ...Page[]];
    out.push(lead);
    for (const q of rest) {
      const { size: _size, fit: _fit, ...own } = q;
      out.push({
        ...own,
        orientation: lead.orientation,
        ...(lead.size ? { size: lead.size } : {}),
      });
    }
  }
  return out;
}

function pagesOf(tab: Record<string, unknown>): Page[] {
  const seen = new Set<string>();
  const stored = Array.isArray(tab.pages)
    ? tab.pages.map(parsePage).filter((p): p is Page => {
        if (!p || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
    : [];
  if (stored.length > 0) {
    // The row anchor is the first page's that carries one.
    const first = stored.findIndex((p) => p.rowAt);
    const anchored = stored.map((p, i) =>
      i === first || !p.rowAt ? p : { ...p, rowAt: undefined },
    );
    return withArticlesTogether(anchored.slice(0, MAX_PAGES));
  }
  const orientation = isOrientation(tab.pageOrientation) ? tab.pageOrientation : 'portrait';
  return [{ id: 'page-1', orientation }];
}

function dimensions(page: Page): { width: number; height: number } {
  if (page.size === 'fit' && page.fit) return page.fit;
  if (page.size === 'device') {
    const g = deviceGeometry(
      page.device ?? DEFAULT_WIREFRAME_DEVICE,
      page.orientation === 'landscape',
    );
    return { width: g.width, height: g.height };
  }
  const { short, long, landscapeOnly } = SIZES[page.size ?? 'a4'];
  return page.orientation === 'portrait' && !landscapeOnly
    ? { width: short, height: long }
    : { width: long, height: short };
}

// The modes a stored tab may name Pages by (the old site's, before and after its renames).
const PAGES_MODES: ReadonlySet<unknown> = new Set(['pages', 'illustrate', 'infographic']);

/** Each page's rectangle on an old Pages tab's canvas, in canvas units: the first centred on the row anchor, each
 *  further one a gap to the right, all on the row's axis. Empty for a tab that isn't a Pages tab and stores no
 *  pages, so the splitter treats it as having none. */
export function pageRects(body: Record<string, unknown>): PageRect[] {
  if (!PAGES_MODES.has(body.opensIn) && !Array.isArray(body.pages)) return [];
  const pages = pagesOf(body);
  const at = pages.find((p) => p.rowAt)?.rowAt ?? { x: 0, y: 0 };
  let x = 0;
  return pages.map((page, index) => {
    const { width, height } = dimensions(page);
    if (index === 0) x = at.x - width / 2;
    const rect = { pageId: page.id, x, y: at.y - height / 2, width, height };
    x += width + PAGE_GAP;
    return rect;
  });
}
