// The map's layout (docs/specs/009-elements/map.md "What it shows"; blueprint "Layout"): the view it
// frames, how the plane maps onto the element's box, each country's fill and each pin's place and
// label side. Pure and shared by the canvas view, the Map dialog's preview and the SVG export, so
// the three draw the same map.

import {
  isMapRegion,
  projectLonLat,
  regionWindow,
  type MapGeometry,
  type MapPin,
  type MapRegion,
} from './map-model';

export type MapFields = {
  mapRegion?: MapRegion;
  mapCountry?: string;
  mapHighlights?: readonly string[];
  mapPins?: readonly MapPin[];
};

export type MapColours = { land: string; accent: string; paper: string; text: string };

// How far a focused country's frame is padded each side, as a share of its size.
const COUNTRY_PAD = 0.12;
// The context countries' opacity round a focused country (D196).
export const MAP_FAINT_OPACITY = 0.45;
// Below this a box draws nothing.
const MIN_SIDE = 8;

export type MapLayoutCountry = {
  code: string;
  name: string;
  d: string;
  fill: string;
  opacity: number;
};
export type MapLayoutPin = {
  id: string;
  x: number;
  y: number;
  label?: string;
  side: 'right' | 'left';
};

export type MapLayoutResult = {
  // Plane units to element px: px = plane * scale + offset.
  scale: number;
  tx: number;
  ty: number;
  countries: MapLayoutCountry[];
  pins: MapLayoutPin[];
  pinRadius: number;
  pinRing: number;
  labelSize: number;
  labelHalo: number;
  borderWidth: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The view window in the plane: the focused country's padded frame, else the region's. */
export function mapWindow(
  el: MapFields,
  geometry: MapGeometry | null,
): { x: number; y: number; w: number; h: number } {
  const row = el.mapCountry ? geometry?.countries.find((c) => c[0] === el.mapCountry) : undefined;
  if (row) {
    const [, , , x0, y0, x1, y1] = row;
    const w = Math.max(1, x1 - x0);
    const h = Math.max(1, y1 - y0);
    return {
      x: x0 - w * COUNTRY_PAD,
      y: y0 - h * COUNTRY_PAD,
      w: w * (1 + 2 * COUNTRY_PAD),
      h: h * (1 + 2 * COUNTRY_PAD),
    };
  }
  return regionWindow(isMapRegion(el.mapRegion) ? el.mapRegion : 'world');
}

/**
 * The map in a box of `width` × `height` px. Without geometry (not loaded yet) the countries are
 * empty and the caller draws the placeholder; pins are placed all the same.
 */
export function mapLayout(
  el: MapFields,
  width: number,
  height: number,
  geometry: MapGeometry | null,
  colours: MapColours,
): MapLayoutResult | null {
  if (width < MIN_SIDE || height < MIN_SIDE) return null;
  const win = mapWindow(el, geometry);
  const scale = Math.min(width / win.w, height / win.h);
  const tx = (width - win.w * scale) / 2 - win.x * scale;
  const ty = (height - win.h * scale) / 2 - win.y * scale;
  const short = Math.min(width, height);
  const focus = el.mapCountry && geometry?.countries.some((c) => c[0] === el.mapCountry);
  const lit = new Set(el.mapHighlights ?? []);
  const countries: MapLayoutCountry[] = (geometry?.countries ?? []).map(([code, name, d]) => ({
    code,
    name,
    d,
    fill: lit.has(code) ? colours.accent : colours.land,
    opacity: focus && code !== el.mapCountry && !lit.has(code) ? MAP_FAINT_OPACITY : 1,
  }));
  const pinRadius = clamp(short * 0.022, 3.5, 9);
  const labelSize = clamp(short * 0.055, 10, 22);
  const gap = pinRadius + labelSize * 0.35;
  const pins: MapLayoutPin[] = (el.mapPins ?? []).map((p) => {
    const [px, py] = projectLonLat(p.lon, p.lat);
    const x = px * scale + tx;
    const y = py * scale + ty;
    const estimated = (p.label?.length ?? 0) * labelSize * 0.56;
    return {
      id: p.id,
      x,
      y,
      ...(p.label ? { label: p.label } : {}),
      side: x + gap + estimated > width ? 'left' : 'right',
    };
  });
  return {
    scale,
    tx,
    ty,
    countries,
    pins,
    pinRadius,
    pinRing: Math.max(1.5, pinRadius * 0.35),
    labelSize,
    labelHalo: Math.max(2, labelSize * 0.22),
    borderWidth: clamp(scale * 6, 0.5, 1.2),
  };
}

/** Where a pin's label starts, from its pin: right of it, or ending left of it. */
export function pinLabelAnchor(
  pin: MapLayoutPin,
  layout: Pick<MapLayoutResult, 'pinRadius' | 'labelSize'>,
): { x: number; anchor: 'start' | 'end' } {
  const gap = layout.pinRadius + layout.labelSize * 0.35;
  return pin.side === 'right'
    ? { x: pin.x + gap, anchor: 'start' }
    : { x: pin.x - gap, anchor: 'end' };
}
