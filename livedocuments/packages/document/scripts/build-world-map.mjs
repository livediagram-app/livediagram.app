// Builds src/map-geometry.generated.ts, the map element's country outlines and places
// (docs/specs/009-elements/map.md "Geometry"; blueprint "Assets and external resources").
//
// Source: Natural Earth 1:110m Cultural Vectors v5.1.2 (public domain, https://www.naturalearthdata.com/about/terms-of-use/):
//   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson
//   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_populated_places_simple.geojson
//
// Run from this package with the two downloaded files:
//   node scripts/build-world-map.mjs <countries.geojson> <places.geojson>
//
// Each country is projected once with Equal Earth into a MAP_WORLD_WIDTH-wide plane (the same
// constants as src/map-model.ts, which projects pins at render), rounded to whole units, written as
// one relative SVG path, with its bounding box for framing a single country. Antarctica is left
// out: a slide map never needs it and it is the widest shape in the set.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Keep in step with src/map-model.ts (a test checks the two agree).
const MAP_WORLD_WIDTH = 4000;
const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;
const X_MAX = Math.PI / (M * A1);
const SCALE = MAP_WORLD_WIDTH / (2 * X_MAX);

function project(lon, lat) {
  const lam = (lon * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const t = Math.asin(M * Math.sin(phi));
  const t2 = t * t;
  const t6 = t2 * t2 * t2;
  const x = (lam * Math.cos(t)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
  const y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
  return [Math.round((x + X_MAX) * SCALE), Math.round(-y * SCALE + yHalf())];
}

function yHalf() {
  const t = Math.asin(M);
  const t2 = t * t;
  const t6 = t2 * t2 * t2;
  return t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)) * SCALE;
}

const [countriesPath, placesPath] = process.argv.slice(2);
if (!countriesPath || !placesPath) {
  console.error('usage: node scripts/build-world-map.mjs <countries.geojson> <places.geojson>');
  process.exit(1);
}

// The United States frames on the lower 48: Alaska sits close enough to join its frame by distance, which left the
// lower 48 small in the box. Alaska and Hawaii are drawn in insets instead (src/map-insets.ts).
const MAIN_LAND_ONLY = new Set(['US']);

const countries = JSON.parse(readFileSync(countriesPath, 'utf8'));
const places = JSON.parse(readFileSync(placesPath, 'utf8'));

function codeOf(p) {
  const eh = p.ISO_A2_EH;
  if (typeof eh === 'string' && /^[A-Z]{2}$/.test(eh)) return eh;
  const a2 = p.ISO_A2;
  if (typeof a2 === 'string' && /^[A-Z]{2}$/.test(a2)) return a2;
  // Kosovo, Northern Cyprus, Somaliland: no ISO alpha-2, so their Natural Earth A3 code.
  return p.ADM0_A3;
}

function ringPath(ring) {
  const pts = [];
  for (const [lon, lat] of ring) {
    const p = project(lon, lat);
    const last = pts[pts.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p);
  }
  if (pts.length > 1) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) pts.pop();
  }
  if (pts.length < 3) return null;
  return pts;
}

const rows = [];
for (const f of countries.features) {
  const p = f.properties;
  const code = codeOf(p);
  if (code === 'AQ') continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  let d = '';
  let first = true;
  let cx = 0;
  let cy = 0;
  // Each outer ring's box and area: the country frames on its biggest piece and the pieces near it,
  // so France frames on Europe (not French Guiana); the United States frames on its lower 48 (MAIN_LAND_ONLY).
  const pieces = [];
  for (const poly of polys) {
    poly.forEach((ring, ri) => {
      const pts = ringPath(ring);
      if (!pts) return;
      const [sx, sy] = pts[0];
      // The first ring moves absolutely; each later one relative to where the last ring closed (its start).
      d += first ? `M${sx} ${sy}` : `m${sx - cx} ${sy - cy}`;
      first = false;
      const seg = [];
      for (let i = 1; i < pts.length; i++) {
        seg.push(`${pts[i][0] - pts[i - 1][0]} ${pts[i][1] - pts[i - 1][1]}`);
      }
      d += `l${seg.join(' ').replace(/ -/g, '-')}z`;
      cx = sx;
      cy = sy;
      if (ri > 0) return;
      let area = 0;
      const box = [Infinity, Infinity, -Infinity, -Infinity];
      pts.forEach(([x, y], i) => {
        const [nx, ny] = pts[(i + 1) % pts.length];
        area += x * ny - nx * y;
        box[0] = Math.min(box[0], x);
        box[1] = Math.min(box[1], y);
        box[2] = Math.max(box[2], x);
        box[3] = Math.max(box[3], y);
      });
      pieces.push({ area: Math.abs(area) / 2, box });
    });
  }
  if (!d) continue;
  pieces.sort((a, b) => b.area - a.area);
  const main = pieces[0].box;
  const reach = Math.max(main[2] - main[0], main[3] - main[1]) * 0.35;
  const frame = [...main];
  // A country whose far land is drawn in its own inset (src/map-insets.ts) frames on its main land alone.
  for (const { box } of MAIN_LAND_ONLY.has(code) ? [] : pieces.slice(1)) {
    const gapX = Math.max(0, box[0] - main[2], main[0] - box[2]);
    const gapY = Math.max(0, box[1] - main[3], main[1] - box[3]);
    if (Math.max(gapX, gapY) > reach) continue;
    frame[0] = Math.min(frame[0], box[0]);
    frame[1] = Math.min(frame[1], box[1]);
    frame[2] = Math.max(frame[2], box[2]);
    frame[3] = Math.max(frame[3], box[3]);
  }
  rows.push([code, p.NAME, d, ...frame]);
}
rows.sort((a, b) => a[1].localeCompare(b[1]));

const placeRows = places.features
  .map((f) => {
    const p = f.properties;
    return [
      p.name,
      typeof p.iso_a2 === 'string' && /^[A-Z]{2}$/.test(p.iso_a2) ? p.iso_a2 : '',
      Math.round(p.latitude * 100) / 100,
      Math.round(p.longitude * 100) / 100,
    ];
  })
  .sort((a, b) => a[0].localeCompare(b[0]));

const height = Math.round(yHalf() * 2);
const out =
  `// GENERATED by scripts/build-world-map.mjs from Natural Earth 1:110m v5.1.2 (public domain). Do not edit.\n` +
  `// The map element's geometry (docs/specs/009-elements/map.md "Geometry"): loaded on demand, never from the\n` +
  `// package barrel. Countries: [code, name, relative SVG path, x0, y0, x1, y1] in an Equal Earth plane\n` +
  `// MAP_WORLD_WIDTH wide; places: [name, country code, latitude, longitude].\n` +
  `import type { MapGeometry } from './map-model';\n\n` +
  `export const MAP_GEOMETRY: MapGeometry = {\n` +
  `  width: ${MAP_WORLD_WIDTH},\n` +
  `  height: ${height},\n` +
  `  countries: ${JSON.stringify(rows)},\n` +
  `  places: ${JSON.stringify(placeRows)},\n` +
  `};\n`;

const target = fileURLToPath(new URL('../src/map-geometry.generated.ts', import.meta.url));
writeFileSync(target, out);
console.log(
  `${rows.length} countries, ${placeRows.length} places, ${out.length} bytes -> ${target}`,
);
