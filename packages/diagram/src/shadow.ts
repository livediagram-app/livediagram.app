// Element drop shadows (spec/86). The numeric ElementShadow model, the
// preset catalogue behind the Shadow category's tiles, and the render
// builders shared by the canvas (CSS box-shadow / drop-shadow filter)
// and the headless SVG export (feDropShadow defs), so the two surfaces
// can't drift apart.

// Type-only import from the barrel (no runtime cycle) — the Element
// union itself lives in index.ts, same pattern as element-types.ts.
import type { Element } from './index';

export type ElementShadow = {
  // Horizontal / vertical offset in px, clamped to ±SHADOW_LIMITS.offset.
  offsetX: number;
  offsetY: number;
  // Blur radius in px (CSS box-shadow semantics), 0..SHADOW_LIMITS.blur.
  blur: number;
  // Shadow strength 0..1 (the alpha on the fixed ink colour).
  opacity: number;
};

// Slider ranges (spec/86). Clamped on write AND on render so a
// hand-edited / imported payload can't draw an absurd shadow.
export const SHADOW_LIMITS = { offset: 24, blur: 48 } as const;

// The fixed shadow ink: slate-900, matching the UI's text ink. A single
// colour keeps shadows reading as shade under every theme and keeps the
// model to four sliders (spec/86 leaves a colour picker as follow-up).
export const SHADOW_COLOR_RGB = '15, 23, 42';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function clampShadow(s: ElementShadow): ElementShadow {
  return {
    offsetX: clamp(Math.round(s.offsetX), -SHADOW_LIMITS.offset, SHADOW_LIMITS.offset),
    offsetY: clamp(Math.round(s.offsetY), -SHADOW_LIMITS.offset, SHADOW_LIMITS.offset),
    blur: clamp(Math.round(s.blur), 0, SHADOW_LIMITS.blur),
    opacity: clamp(s.opacity, 0, 1),
  };
}

export type ShadowPresetId = 'soft' | 'drop' | 'lifted' | 'hard';

// The tile presets (spec/86). Soft / Drop / Lifted are elevation steps;
// Hard is the zero-blur offset "poster" shadow. A separate None tile
// clears the field, so it isn't an entry here.
export const SHADOW_PRESETS: { id: ShadowPresetId; label: string; shadow: ElementShadow }[] = [
  { id: 'soft', label: 'Soft', shadow: { offsetX: 0, offsetY: 2, blur: 8, opacity: 0.18 } },
  { id: 'drop', label: 'Drop', shadow: { offsetX: 0, offsetY: 4, blur: 12, opacity: 0.25 } },
  { id: 'lifted', label: 'Lifted', shadow: { offsetX: 0, offsetY: 10, blur: 24, opacity: 0.28 } },
  { id: 'hard', label: 'Hard', shadow: { offsetX: 6, offsetY: 6, blur: 0, opacity: 0.35 } },
];

// What a slider drag starts from when the element has no shadow yet
// (spec/86): the Drop preset's values, so the first drag produces a
// visible shadow instead of a degenerate all-zero one.
export const DEFAULT_SHADOW: ElementShadow = SHADOW_PRESETS[1]!.shadow;

// The boxed types that draw a visible body a shadow can sit under
// (spec/86). Text / freehand / annotation / table / arrows are out: a
// bounding-box shadow under a text run or a grid reads as a bug.
export function supportsShadow(
  el: Pick<Element, 'type'>,
): el is Extract<Element, { shadow?: ElementShadow }> {
  return (
    el.type === 'shape' || el.type === 'sticky' || el.type === 'image' || el.type === 'link-card'
  );
}

const rgba = (s: ElementShadow) => `rgba(${SHADOW_COLOR_RGB}, ${clampShadow(s).opacity})`;

// CSS box-shadow value — the cheap path for opaque rectangular bodies
// (CSS-native shapes / stickies / link cards): follows border-radius.
export function shadowBoxCss(s: ElementShadow): string {
  const c = clampShadow(s);
  return `${c.offsetX}px ${c.offsetY}px ${c.blur}px ${rgba(c)}`;
}

// CSS filter value — for transparent wrappers (SVG silhouettes, icons,
// data shapes, images): drop-shadow follows the drawn alpha, not the box.
export function shadowFilterCss(s: ElementShadow): string {
  const c = clampShadow(s);
  return `drop-shadow(${c.offsetX}px ${c.offsetY}px ${c.blur}px ${rgba(c)})`;
}

// Deterministic def id for the export filter: elements sharing a shadow
// share one <filter>. Negative offsets encode as `n<abs>` so the id stays
// a valid XML name.
export function shadowFilterId(s: ElementShadow): string {
  const c = clampShadow(s);
  const enc = (v: number) => (v < 0 ? `n${-v}` : `${v}`);
  return `elshadow-${enc(c.offsetX)}-${enc(c.offsetY)}-${c.blur}-${Math.round(c.opacity * 100)}`;
}

// The export-side <filter> def (spec/86). stdDeviation is blur/2 (the
// CSS blur radius ≈ 2σ equivalence) so exports match the canvas. The
// filter region gets generous margins: the default 10% clips big
// blurs/offsets on small elements.
export function svgShadowFilterDef(s: ElementShadow): string {
  const c = clampShadow(s);
  return (
    `<filter id="${shadowFilterId(c)}" x="-50%" y="-50%" width="200%" height="200%">` +
    `<feDropShadow dx="${c.offsetX}" dy="${c.offsetY}" stdDeviation="${c.blur / 2}"` +
    ` flood-color="rgb(${SHADOW_COLOR_RGB})" flood-opacity="${c.opacity}"/>` +
    `</filter>`
  );
}
