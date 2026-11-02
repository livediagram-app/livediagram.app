// Each page's rectangle on a former Pages tab's canvas, for the migration's splitter (docs/migration.md step 3, "A
// Pages tab with both kinds of page splits by page"): an element goes with the page its centre sits on.
//
// livehuddle no longer lays pages out (Pages moved to livedocuments, logos and wireframes to livedesign), so this is
// the old editor's layout as both of those still run it (livedocuments/packages/document/src/page.ts and
// livedesign/packages/design/src/page.ts `layOutPages`): the pages in one row, the first centred on the row anchor
// (`rowAt` on the first page carrying it, else the origin), each next one PAGE_GAP to the right, every page centred on
// the anchor's y. A page's sides are its size's (the long side upright in portrait; a slide size always landscape;
// `fit` and `photo` sizes its own `fit` box), from the union of the two products' size tables.
//
// Approximations, documented: a wireframe page's device is read as the default phone frame (423 x 876, turned for
// landscape) rather than its exact device geometry, and an unknown size as A4. A page is only ever a few hundred
// pixels from its true rectangle then, and an element is placed by its centre, so a split moves an element to the
// wrong page only when it sits within that much of a page's edge.

type Body = Record<string, unknown>;
type Rec = Record<string, unknown>;

export type PageRect = { pageId: string; x: number; y: number; width: number; height: number };

// The space between two pages in the row, as both products keep it.
export const PAGE_GAP = 96;
// Both products' page cap: a forged tab with more pages lays out no more.
const MAX_PAGES = 100;

// Short and long side per size id (livedocuments' and livedesign's PAGE_SIZES).
const SIZES: Readonly<Record<string, { short: number; long: number; landscapeOnly?: true }>> = {
  a4: { short: 794, long: 1123 },
  letter: { short: 816, long: 1056 },
  a3: { short: 1123, long: 1587 },
  square: { short: 1080, long: 1080 },
  social: { short: 1080, long: 1350 },
  wide: { short: 1080, long: 1920 },
  slide: { short: 1080, long: 1920, landscapeOnly: true },
  'slide-classic': { short: 1080, long: 1440, landscapeOnly: true },
  logo: { short: 1024, long: 1024 },
  device: { short: 423, long: 876 },
  photo: { short: 1080, long: 1920 },
  fit: { short: 794, long: 1123 },
};

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function sidesOf(page: Rec): { width: number; height: number } {
  const size = typeof page.size === 'string' && SIZES[page.size] ? page.size : 'a4';
  const fit = page.fit;
  if ((size === 'fit' || size === 'photo') && isRec(fit) && finite(fit.width) && finite(fit.height))
    return { width: fit.width, height: fit.height };
  const { short, long, landscapeOnly } = SIZES[size]!;
  return page.orientation === 'landscape' || landscapeOnly
    ? { width: long, height: short }
    : { width: short, height: long };
}

export function pageRectsOf(body: Body): PageRect[] {
  if (!Array.isArray(body.pages)) return [];
  const seen = new Set<string>();
  const pages = (body.pages as unknown[])
    .filter((p): p is Rec => {
      if (!isRec(p) || typeof p.id !== 'string' || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    })
    .slice(0, MAX_PAGES);
  const anchor = pages.find((p) => isRec(p.rowAt))?.rowAt as Rec | undefined;
  const ax = finite(anchor?.x) ? anchor.x : 0;
  const ay = finite(anchor?.y) ? anchor.y : 0;
  let x = 0;
  return pages.map((page, index) => {
    const { width, height } = sidesOf(page);
    if (index === 0) x = ax - width / 2;
    const rect = { pageId: page.id as string, x, y: ay - height / 2, width, height };
    x += width + PAGE_GAP;
    return rect;
  });
}
