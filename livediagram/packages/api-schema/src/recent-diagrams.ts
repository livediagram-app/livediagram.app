// The returning-visitor note the editor used to leave for the landing page (docs/specs/019-marketing/returning-visitor.md).
// Nothing writes or reads it now; its storage names stay so sign-out can clear what an
// older visit left behind.

// The localStorage key the note lived under.
export const RECENT_DIAGRAMS_KEY = 'livediagram:recent-diagrams:v1';

// The Cache Storage caches that held each noted diagram's snapshot SVG (v1, then v2).
export const RECENT_THUMBS_CACHE = 'livediagram-recent-thumbs-v2';
export const RECENT_THUMBS_CACHE_LEGACY = 'livediagram-recent-thumbs-v1';

// A snapshot SVG's solid background colour: the first <rect>'s fill, since a snapshot draws a
// full-viewBox background rect before any element (docs/specs/006-document/document-snapshots.md). Lets
// a tile paint its letterbox to match the diagram. Null when absent. The tag is cut out by index
// first, so the pattern only ever reads that one tag: linear, however the markup is shaped.
export function svgBackgroundColor(svg: string): string | null {
  const tag = openingTag(svg, '<rect');
  return tag ? (/\sfill="([^"]+)"/.exec(tag)?.[1] ?? null) : null;
}

// A snapshot SVG without its fixed width and height, so an <img> renders the vector crisp at its box's
// size instead of rasterising at the snapshot's pixel size and scaling that; the viewBox keeps its aspect.
export function scalableSnapshotSvg(svg: string): string {
  const tag = openingTag(svg, '<svg');
  if (!tag) return svg;
  const start = svg.indexOf(tag);
  const scalable = tag.replace(/ width="[^"]*"/, '').replace(/ height="[^"]*"/, '');
  return svg.slice(0, start) + scalable + svg.slice(start + tag.length);
}

// The first `<name ...>` opening tag in the markup (up to, not including, its `>`), or null.
function openingTag(svg: string, open: string): string | null {
  const start = svg.indexOf(open);
  if (start < 0) return null;
  const end = svg.indexOf('>', start);
  return svg.slice(start, end < 0 ? svg.length : end);
}
