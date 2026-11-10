// The map element's model (docs/specs/009-elements/map.md; blueprint "Domain and naming",
// "Constants", "Projection"): its fields' types and limits, the regions, the Equal Earth projection
// pins are placed with, and the validators the store and the editor share. Light: the country
// geometry itself is `map-geometry.generated.ts`, reached only through the
// `@livedocuments/document/map-geometry` subpath and loaded on demand.

export const MAP_REGIONS = [
  'world',
  'europe',
  'africa',
  'asia',
  'middle-east',
  'north-america',
  'south-america',
  'oceania',
] as const;
export type MapRegion = (typeof MAP_REGIONS)[number];

export const MAP_REGION_LABELS: Record<MapRegion, string> = {
  world: 'World',
  europe: 'Europe',
  africa: 'Africa',
  asia: 'Asia',
  'middle-east': 'Middle East',
  'north-america': 'North America',
  'south-america': 'South America',
  oceania: 'Oceania',
};

// Each region's window as west, south, east, north in degrees (D197).
export const MAP_REGION_WINDOWS: Record<MapRegion, readonly [number, number, number, number]> = {
  world: [-180, -57, 180, 84],
  europe: [-25, 34, 45, 71],
  africa: [-20, -36, 55, 38],
  asia: [25, -11, 150, 60],
  'middle-east': [24, 11, 64, 43],
  'north-america': [-170, 7, -50, 75],
  'south-america': [-85, -57, -32, 14],
  oceania: [110, -48, 180, 0],
};

export const MAP_PINS_MAX = 40;
export const MAP_HIGHLIGHTS_MAX = 60;
export const MAP_PIN_LABEL_MAX = 40;
export const MAP_LAT_MAX = 85;

export type MapPin = { id: string; lat: number; lon: number; label?: string };

// [code, name, relative SVG path, x0, y0, x1, y1]: one country, its frame its main land and the
// pieces near it.
export type MapCountryRow = readonly [string, string, string, number, number, number, number];
// [name, country code ('' when none), latitude, longitude].
export type MapPlaceRow = readonly [string, string, number, number];
export type MapGeometry = {
  width: number;
  height: number;
  countries: readonly MapCountryRow[];
  places: readonly MapPlaceRow[];
};

// What the View picker sets: a region, or one country to frame.
export type MapViewChoice = { region: MapRegion } | { country: string };

export function isMapShape(kind: unknown): kind is 'map' {
  return kind === 'map';
}

export function isMapRegion(v: unknown): v is MapRegion {
  return typeof v === 'string' && (MAP_REGIONS as readonly string[]).includes(v);
}

/** A country code as the map stores it: ISO alpha-2, or Natural Earth's three letters. */
export function isMapCode(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Z]{2,3}$/.test(v);
}

export function isMapPin(v: unknown): v is MapPin {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    p.id.length > 0 &&
    typeof p.lat === 'number' &&
    Number.isFinite(p.lat) &&
    Math.abs(p.lat) <= MAP_LAT_MAX &&
    typeof p.lon === 'number' &&
    Number.isFinite(p.lon) &&
    Math.abs(p.lon) <= 180 &&
    (p.label === undefined || (typeof p.label === 'string' && p.label.length <= MAP_PIN_LABEL_MAX))
  );
}

// ---- Equal Earth (Šavrič, Patterson and Jenny, 2018), as the build script projects the countries.

// The plane the geometry is projected into: this wide, its height MAP_PLANE_HEIGHT.
export const MAP_WORLD_WIDTH = 4000;
const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;
const X_MAX = Math.PI / (M * A1);
const SCALE = MAP_WORLD_WIDTH / (2 * X_MAX);
const yOf = (t: number) => {
  const t2 = t * t;
  const t6 = t2 * t2 * t2;
  return t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
};
const Y_HALF = yOf(Math.asin(M)) * SCALE;
export const MAP_PLANE_HEIGHT = Math.round(Y_HALF * 2);

/** A longitude and latitude in the plane, x east from 0 and y south from 0. */
export function projectLonLat(lon: number, lat: number): [number, number] {
  const lam = (lon * Math.PI) / 180;
  const t = Math.asin(M * Math.sin((lat * Math.PI) / 180));
  const t2 = t * t;
  const t6 = t2 * t2 * t2;
  const x = (lam * Math.cos(t)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
  return [(x + X_MAX) * SCALE, Y_HALF - yOf(t) * SCALE];
}

/** The inverse, for a click on the map: Newton's method on θ, the latitude kept to MAP_LAT_MAX. */
export function unprojectPoint(px: number, py: number): { lon: number; lat: number } {
  const x = px / SCALE - X_MAX;
  const y = (Y_HALF - py) / SCALE;
  let t = y / A1;
  for (let i = 0; i < 12; i++) {
    const t2 = t * t;
    const t6 = t2 * t2 * t2;
    const f = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)) - y;
    const df = A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2);
    const step = f / df;
    t -= step;
    if (Math.abs(step) < 1e-9) break;
  }
  const t2 = t * t;
  const t6 = t2 * t2 * t2;
  const lam = (M * x * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))) / Math.cos(t);
  const lat = (Math.asin(Math.max(-1, Math.min(1, Math.sin(t) / M))) * 180) / Math.PI;
  const lon = (lam * 180) / Math.PI;
  return {
    lon: Math.max(-180, Math.min(180, lon)),
    lat: Math.max(-MAP_LAT_MAX, Math.min(MAP_LAT_MAX, lat)),
  };
}

/** A region's window in the plane: the box round a 5 × 5 sample of its edges and inside. */
export function regionWindow(region: MapRegion): { x: number; y: number; w: number; h: number } {
  const [w, s, e, n] = MAP_REGION_WINDOWS[region];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i <= 4; i++) {
    for (let j = 0; j <= 4; j++) {
      const [x, y] = projectLonLat(w + ((e - w) * i) / 4, s + ((n - s) * j) / 4);
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** A pin's label as stored: trimmed, at most MAP_PIN_LABEL_MAX, absent when empty. */
export function cleanPinLabel(label: string | undefined): string | undefined {
  const t = (label ?? '').trim().slice(0, MAP_PIN_LABEL_MAX);
  return t ? t : undefined;
}

// ---- The loaded geometry (docs/specs/009-elements/map.md "Exports and other surfaces"): provided once by
// whoever loads it (the editor's lazy loader, a worker before it renders a tab with a map), read by
// the synchronous renderers. Immutable static data, so one module-level slot is safe.
let provided: MapGeometry | null = null;

export function provideMapGeometry(geometry: MapGeometry): void {
  provided = geometry;
}

/** The geometry provided so far, or null: a map then draws as its placeholder. */
export function providedMapGeometry(): MapGeometry | null {
  return provided;
}

// ---- Colours (D195): the accent a new map drops with, the land's soft default per paper, and the
// paper a pin's ring and a label's halo are drawn in.
export const MAP_DEFAULT_ACCENT = '#3b82f6';

export function mapLandColour(
  fill: string | undefined,
  surface: 'light' | 'dark' = 'light',
): string {
  return fill ?? (surface === 'dark' ? '#334155' : '#dbe3ec');
}

export function mapPaperColour(surface: 'light' | 'dark' = 'light'): string {
  return surface === 'dark' ? '#0f172a' : '#ffffff';
}
