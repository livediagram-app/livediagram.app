// The furniture's light (docs/specs/009-elements/furniture-art-style.md): the shaded illustration style every piece
// is painted in, by both renderers (each editor's FurnitureView and the headless svg-render-office-art). Light falls
// from above the room's camera, so a top surface (a `panel`) is lit at its top and turns a little darker toward the
// floor, a vertical face toward the room (a `face`) sits in shade, and every edge is drawn in a deeper shade of its
// own material rather than one ink, the way an illustrator outlines wood in dark wood and fabric in dark fabric.
// Shadows are soft contact shadows. Pure: no React, no DOM, safe in a worker.

import { parseCssColour } from '@liveworkspace/model-core/css-colour';

type Rgba = { r: number; g: number; b: number; a: number };

// A colour as channels with its alpha (0-1): hex, a CSS name, or the rgb()/rgba() a seat wash is written as.
export function rgbaOf(color: string): Rgba | null {
  const c = color.trim();
  const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(c);
  if (fn) {
    const alpha = fn[4] === undefined ? 1 : fn[4].endsWith('%') ? parseFloat(fn[4]) / 100 : +fn[4];
    return { r: +fn[1]!, g: +fn[2]!, b: +fn[3]!, a: alpha };
  }
  const hex = /^#([0-9a-f]{8})$/i.exec(c);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return { r: (n >>> 24) & 255, g: (n >>> 16) & 255, b: (n >>> 8) & 255, a: (n & 255) / 255 };
  }
  const rgb = parseCssColour(c);
  return rgb ? { ...rgb, a: 1 } : null;
}

const hex2 = (n: number) =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');

function write({ r, g, b, a }: Rgba): string {
  const body = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  return a >= 0.999 ? body : `${body}${hex2(a * 255)}`;
}

/** The colour moved toward white (a share > 0) or black (< 0), its alpha kept; the colour itself when unreadable. */
export function tone(color: string, share: number): string {
  const c = rgbaOf(color);
  if (!c) return color;
  const to = share >= 0 ? 255 : 0;
  const s = Math.abs(share);
  return write({
    r: c.r + (to - c.r) * s,
    g: c.g + (to - c.g) * s,
    b: c.b + (to - c.b) * s,
    a: c.a,
  });
}

// How strongly the light models each surface (DEFAULTS.md D236).
export const FURNITURE_LIGHT = {
  // A top surface: lit at its far edge, a touch of shade at its near edge.
  panelTop: 0.2,
  panelBottom: -0.1,
  // A face toward the room: in shade, deepening toward the floor.
  faceTop: -0.16,
  faceBottom: -0.34,
  // An edge: a deeper shade of the part's own material.
  edge: -0.5,
} as const;

/** The two stops a part's gradient runs between, top to bottom, and the edge it is outlined in. */
export type PartShade = { top: string; bottom: string; edge: string };

export function partShade(color: string, role: 'panel' | 'face'): PartShade {
  const L = FURNITURE_LIGHT;
  return role === 'panel'
    ? {
        top: tone(color, L.panelTop),
        bottom: tone(color, L.panelBottom),
        edge: tone(color, L.edge),
      }
    : { top: tone(color, L.faceTop), bottom: tone(color, L.faceBottom), edge: tone(color, L.edge) };
}

/**
 * The gradients one drawing needs: one per (role, colour) pair among its lit parts, so a drawing with a hundred
 * parts in three materials writes three or four gradients, never one per part. Keyed `${role}|${colour}`.
 */
export function shadeKeys(
  parts: readonly { role: string; fill?: string }[],
  seat: string,
): Map<string, { role: 'panel' | 'face'; color: string; index: number }> {
  const out = new Map<string, { role: 'panel' | 'face'; color: string; index: number }>();
  for (const p of parts) {
    if (p.role !== 'panel' && p.role !== 'face') continue;
    const color = p.fill ?? seat;
    const key = `${p.role}|${color}`;
    if (!out.has(key)) out.set(key, { role: p.role, color, index: out.size });
  }
  return out;
}

// The contact shadow: a soft radial falloff instead of a flat ellipse.
export const FURNITURE_SOFT_SHADOW = {
  color: '#0b1220',
  // Opacity at the centre, at the stop where it starts to fade, and at the rim.
  stops: [
    [0, 0.3],
    [0.55, 0.2],
    [1, 0],
  ],
} as const;

// A soft outline: thinner than the old ink, in the material's own deeper shade.
export const FURNITURE_EDGE_STROKE = 1.25;
