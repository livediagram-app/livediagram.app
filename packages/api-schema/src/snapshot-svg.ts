// A document snapshot's SVG (docs/specs/006-document/document-snapshots.md), as the Explorer's
// thumbnails draw it.

// A snapshot SVG's solid background colour: the first <rect>'s fill, since a snapshot draws a
// full-viewBox background rect before any element (docs/specs/006-document/document-snapshots.md). Lets
// a tile paint its letterbox to match the drawing. Null when absent. The tag is cut out by index
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
