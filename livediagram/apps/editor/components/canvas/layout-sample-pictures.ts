// The sample pictures a layout's tile shows where the layout leaves a picture for the author
// (docs/specs/007-editor/pages-mode.md "The layout gallery"): a soft drawn landscape (a sky, a sun
// and two hills) in one of a few palettes, taken in turn, so a picture-led layout reads as one at a
// glance instead of a grey box. Only the tile draws them: placing the layout lands the ordinary
// picture placeholder, ready for the author's own. Pure, our own SVG, no outside images.
import type { Element } from '@livediagram/document';

// Sky top, sky bottom, sun, far hill, near hill.
const PALETTES: readonly (readonly [string, string, string, string, string])[] = [
  ['#7dd3fc', '#e0f2fe', '#fde68a', '#38bdf8', '#0369a1'],
  ['#fdba74', '#fff7ed', '#fef3c7', '#fb923c', '#9a3412'],
  ['#86efac', '#f0fdf4', '#fef9c3', '#4ade80', '#166534'],
  ['#c4b5fd', '#f5f3ff', '#fde68a', '#a78bfa', '#5b21b6'],
];

// The art's own box: wide, so `cover` fills a tall frame from its middle (the sun and hills stay).
const ART_W = 400;
const ART_H = 300;

function art([skyTop, skyBottom, sun, far, near]: readonly string[]): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ART_W} ${ART_H}" preserveAspectRatio="xMidYMid slice">` +
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${skyTop}"/><stop offset="1" stop-color="${skyBottom}"/></linearGradient></defs>` +
    `<rect width="${ART_W}" height="${ART_H}" fill="url(#s)"/>` +
    `<circle cx="285" cy="105" r="38" fill="${sun}"/>` +
    `<path d="M0 210 Q90 140 180 190 T400 170 V300 H0Z" fill="${far}" opacity="0.85"/>` +
    `<path d="M0 250 Q120 190 230 240 T400 225 V300 H0Z" fill="${near}"/>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const ARTS = PALETTES.map(art);

// The ids a tile's pictures are given: never one an upload takes (those are server ids).
const SAMPLE_ID = 'layout-sample:';

/** The layout's elements with each empty picture given a sample, and the pictures to draw them
 *  with (id to href), for the tile's render. Elements already holding a picture keep it. */
export function withSamplePictures(elements: readonly Element[]): {
  elements: Element[];
  pictures: Map<string, { href: string }>;
} {
  const pictures = new Map<string, { href: string }>();
  let n = 0;
  const out = elements.map((el) => {
    if (el.type !== 'image' || el.imageId) return el;
    const id = `${SAMPLE_ID}${n % ARTS.length}`;
    pictures.set(id, { href: ARTS[n % ARTS.length]! });
    n += 1;
    return { ...el, imageId: id, objectFit: 'cover' as const };
  });
  return { elements: out, pictures };
}
