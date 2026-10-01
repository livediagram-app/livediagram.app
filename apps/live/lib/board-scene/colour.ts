// Colour resolution for a landed board scene (docs/specs/020-import-export/board-scene.md
// "Colours"): a light-reference scene colour becomes the board's ink (unset), a stock colour by
// name (adaptive per board), or its exact hex (a custom colour). Fills stay hex; a sticky's fill
// takes the nearest sticky preset's paper.
import { PEN_COLOURS, STICKY_PRESETS, hexOklch, type PenColourName } from '@livediagram/document';
import type { SceneColour } from './scene';

// Near-black and near-neutral: the board's own ink. Excalidraw's ink #1e1e1e is L 0.235, C 0.
export const INK_MAX_LIGHTNESS = 0.35;
export const INK_MAX_CHROMA = 0.04;
// A clearly coloured line colour: chroma at least this (stock teal's light version is 0.080;
// Excalidraw's bronze, 0.046, stays custom) ...
export const STOCK_MIN_CHROMA = 0.07;
// ... at a line's lightness (stock versions sit at 0.47 to 0.68; pastels from 0.86 are fills) ...
export const STOCK_LIGHTNESS_RANGE: readonly [number, number] = [0.3, 0.8];
// ... within this many degrees of a stock colour's hue (Excalidraw's orange is 12.6 from stock
// orange and its pink 16.5 from stock pink; its teal, 19 from green, stays custom).
export const STOCK_HUE_TOLERANCE_DEG = 18;

export type ResolvedColour =
  | { kind: 'ink' }
  | { kind: 'stock'; name: PenColourName }
  | { kind: 'hex'; hex: string }
  | { kind: 'unreadable' };

// '#rgb' or '#rrggbb' as lower-case '#rrggbb' (only called on a readable hex).
export function normaliseHex(hex: string): string {
  const full = hex.length === 4 ? '#' + [...hex.slice(1)].map((d) => d + d).join('') : hex;
  return full.toLowerCase();
}

const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

function resolveHex(hex: string): ResolvedColour {
  const ok = hexOklch(hex);
  if (!ok) return { kind: 'unreadable' };
  if (ok.l <= INK_MAX_LIGHTNESS && ok.c <= INK_MAX_CHROMA) return { kind: 'ink' };
  const [minL, maxL] = STOCK_LIGHTNESS_RANGE;
  if (ok.c >= STOCK_MIN_CHROMA && ok.l >= minL && ok.l <= maxL) {
    let best: PenColourName | null = null;
    let bestDistance = Infinity;
    for (const stock of PEN_COLOURS) {
      const d = hueDistance(ok.h, stock.hue);
      if (d < bestDistance) {
        best = stock.id;
        bestDistance = d;
      }
    }
    if (best && bestDistance <= STOCK_HUE_TOLERANCE_DEG) return { kind: 'stock', name: best };
  }
  return { kind: 'hex', hex: normaliseHex(hex) };
}

/**
 * A resolver for one landing: memoised per hex, so a scene of thousands of marks in a handful of
 * colours computes each colour once. Null for no colour.
 */
export function createColourResolver(): (
  colour: SceneColour | 'ink' | undefined,
) => ResolvedColour | null {
  const memo = new Map<string, ResolvedColour>();
  return (colour) => {
    if (colour === undefined) return null;
    if (colour === 'ink') return { kind: 'ink' };
    let out = memo.get(colour.hex);
    if (!out) {
      out = resolveHex(colour.hex);
      memo.set(colour.hex, out);
    }
    return out;
  };
}

/** A colour's alpha, 0 to 1; the ink and a colour without one are opaque. */
export function colourAlpha(colour: SceneColour | 'ink' | undefined): number {
  if (colour === undefined || colour === 'ink' || colour.alpha === undefined) return 1;
  return Math.min(1, Math.max(0, colour.alpha));
}

/** A resolved line colour on an element: the ink writes nothing (unreadable lands as ink). */
export function lineColourFields(c: ResolvedColour | null): {
  penColour?: PenColourName;
  strokeColor?: string;
} {
  if (c?.kind === 'stock') return { penColour: c.name };
  if (c?.kind === 'hex') return { strokeColor: c.hex };
  return {};
}

/** A resolved text colour on a text box or a shape's label. */
export function textColourFields(c: ResolvedColour | null): {
  penTextColour?: PenColourName;
  textColor?: string;
} {
  if (c?.kind === 'stock') return { penTextColour: c.name };
  if (c?.kind === 'hex') return { textColor: c.hex };
  return {};
}

/** A fill as stored: its hex, or undefined (unfilled) for none, a clear one or an unreadable one. */
export function resolveFill(fill: SceneColour | undefined): string | undefined {
  if (!fill || colourAlpha(fill) === 0) return undefined;
  return hexOklch(fill.hex) ? normaliseHex(fill.hex) : undefined;
}

function oklab(hex: string): [number, number, number] | null {
  const ok = hexOklch(hex);
  if (!ok) return null;
  const r = (ok.h * Math.PI) / 180;
  return [ok.l, ok.c * Math.cos(r), ok.c * Math.sin(r)];
}

const PRESET_LABS = STICKY_PRESETS.map((p) => ({ preset: p, lab: oklab(p.fill)! }));

/** A sticky's fill as the nearest sticky preset's paper (OKLab distance) and its readable ink. */
export function resolveStickyFill(fill: SceneColour): {
  fillColor: string;
  textColor: string;
  presetId: string;
} {
  const lab = oklab(fill.hex);
  let best = PRESET_LABS[0]!;
  if (lab) {
    let bestDistance = Infinity;
    for (const entry of PRESET_LABS) {
      const d = Math.hypot(lab[0] - entry.lab[0], lab[1] - entry.lab[1], lab[2] - entry.lab[2]);
      if (d < bestDistance) {
        best = entry;
        bestDistance = d;
      }
    }
  }
  return { fillColor: best.preset.fill, textColor: best.preset.text, presetId: best.preset.id };
}
