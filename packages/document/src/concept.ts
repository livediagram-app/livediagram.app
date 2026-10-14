// Concept graphics (docs/specs/009-elements/concept-graphics.md): the Layer stack, the Pyramid (with its Inverted and
// Funnel variants) and the Cycle, each one element laying out its own rows. The layouts are PURE so the canvas face
// and the headless renderer place every row from the same numbers, and an export matches the editor.
//
// A LEAF module: types only from './index'.

import { clamp } from './geometry-primitives';
import type { AnimationSpeed, Element, ShapeElement } from './index';
import type { LayoutRect } from './web-components';

export type ConceptShape = 'layer-stack' | 'pyramid' | 'cycle';
export type ConceptRow = { label: string; note?: string };
export type PyramidVariant = 'pyramid' | 'inverted' | 'funnel';
export type ConceptAnim = 'build' | 'pulse' | 'flow';

export const PYRAMID_VARIANTS: readonly PyramidVariant[] = ['pyramid', 'inverted', 'funnel'];
export const CONCEPT_ANIMS: readonly ConceptAnim[] = ['build', 'pulse', 'flow'];
export const CONCEPT_LABEL_MAX = 60;
export const CONCEPT_NOTE_MAX = 40;
export const CONCEPT_ROWS_MAX = 8;

export const CONCEPT_ROWS: Readonly<
  Record<ConceptShape, { min: number; max: number; noun: string }>
> = {
  'layer-stack': { min: 2, max: 8, noun: 'Layer' },
  pyramid: { min: 2, max: 6, noun: 'Tier' },
  cycle: { min: 3, max: 8, noun: 'Step' },
};

export function isConceptShape(kind: string): kind is ConceptShape {
  return kind === 'layer-stack' || kind === 'pyramid' || kind === 'cycle';
}

export function isPyramidVariant(v: unknown): v is PyramidVariant {
  return v === 'pyramid' || v === 'inverted' || v === 'funnel';
}

export function isConceptAnim(v: unknown): v is ConceptAnim {
  return v === 'build' || v === 'pulse' || v === 'flow';
}

export function pyramidVariantOf(el: ShapeElement): PyramidVariant {
  return isPyramidVariant(el.pyramidVariant) ? el.pyramidVariant : 'pyramid';
}

/** The Concept animations a kind is offered: Flow runs along a Cycle's arcs, so only a Cycle has it. */
export function conceptAnimsFor(kind: ConceptShape): readonly ConceptAnim[] {
  return kind === 'cycle' ? CONCEPT_ANIMS : ['build', 'pulse'];
}

/** The animation an element plays: its own when its kind offers it, else none. */
export function conceptAnimOf(el: ShapeElement): ConceptAnim | null {
  if (!isConceptShape(el.shape) || !isConceptAnim(el.conceptAnim)) return null;
  return conceptAnimsFor(el.shape).includes(el.conceptAnim) ? el.conceptAnim : null;
}

/** Whether a row draws its note: a layer's side note and a funnel tier's value. */
export function conceptDrawsNotes(el: ShapeElement): boolean {
  return (
    el.shape === 'layer-stack' || (el.shape === 'pyramid' && pyramidVariantOf(el) === 'funnel')
  );
}

/** Trim + bound a row's text the way every write path should. */
export function clampConceptText(s: string, max: number): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Rows bounded for a kind: each string clamped, a blank note dropped, the list cut to the kind's max. Null when the
 *  list is below the kind's min (the write is ignored, as a web component's rows are). */
export function boundConceptRows(
  kind: ConceptShape,
  rows: readonly ConceptRow[],
): ConceptRow[] | null {
  const { min, max } = CONCEPT_ROWS[kind];
  const next = rows.slice(0, max).map((r) => {
    const label = clampConceptText(r.label, CONCEPT_LABEL_MAX);
    const note = r.note !== undefined ? clampConceptText(r.note, CONCEPT_NOTE_MAX) : '';
    return note ? { label, note } : { label };
  });
  return next.length >= min ? next : null;
}

// --- Layouts --------------------------------------------------------------------------------------

export type LayerStackLayout = {
  bands: LayoutRect[];
  notes: LayoutRect[];
  rules: { x1: number; x2: number; y: number }[];
  labelPx: number;
  notePx: number;
};

export function layerStackLayout(
  w: number,
  h: number,
  n: number,
  notes: boolean,
): LayerStackLayout {
  const count = Math.max(1, n);
  const gap = 6;
  const bandH = Math.max(0, (h - gap * (count - 1)) / count);
  const bandW = notes ? Math.round(w * 0.62) : w;
  const bands = Array.from({ length: count }, (_, i) => ({
    x: 0,
    y: i * (bandH + gap),
    width: bandW,
    height: bandH,
  }));
  const noteX = bandW + 16;
  const labelPx = Math.round(clamp(bandH * 0.36, 11, 20));
  return {
    bands,
    notes: notes
      ? bands.map((b) => ({ x: noteX, y: b.y, width: Math.max(0, w - noteX), height: b.height }))
      : [],
    rules: notes
      ? bands.map((b) => ({ x1: bandW + 3, x2: bandW + 13, y: b.y + b.height / 2 }))
      : [],
    labelPx,
    notePx: Math.round(clamp(labelPx * 0.8, 10, 16)),
  };
}

export type PyramidLayout = {
  tiers: { points: { x: number; y: number }[]; label: LayoutRect }[];
  labelPx: number;
};

export function pyramidLayout(
  w: number,
  h: number,
  n: number,
  variant: PyramidVariant,
): PyramidLayout {
  const count = Math.max(1, n);
  const gap = 4;
  const tierH = Math.max(0, (h - gap * (count - 1)) / count);
  const cx = w / 2;
  const half = (y: number): number => {
    if (variant === 'funnel') return 0; // unused
    const depth = variant === 'inverted' ? h - y : y;
    return (depth / Math.max(1, h)) * (w / 2);
  };
  const tiers = Array.from({ length: count }, (_, i) => {
    const y0 = i * (tierH + gap);
    const y1 = y0 + tierH;
    let top: number;
    let bottom: number;
    if (variant === 'funnel') {
      top = w / 2 + (0.175 * w - w / 2) * (i / count);
      bottom = w / 2 + (0.175 * w - w / 2) * ((i + 1) / count);
    } else {
      top = half(y0);
      bottom = half(y1);
    }
    const points =
      top < 0.5
        ? [
            { x: cx, y: y0 },
            { x: cx + bottom, y: y1 },
            { x: cx - bottom, y: y1 },
          ]
        : bottom < 0.5
          ? [
              { x: cx - top, y: y0 },
              { x: cx + top, y: y0 },
              { x: cx, y: y1 },
            ]
          : [
              { x: cx - top, y: y0 },
              { x: cx + top, y: y0 },
              { x: cx + bottom, y: y1 },
              { x: cx - bottom, y: y1 },
            ];
    // An apex tier is a triangle: its label takes the wide part (the lower 60% pointing up, the upper 60% pointing
    // down). Every label is as wide as its tier at the label's middle, so it never runs past a slanted side.
    const apexUp = top < 0.5;
    const apexDown = !apexUp && bottom < 0.5;
    const ly0 = apexUp ? y0 + tierH * 0.4 : y0;
    const ly1 = apexDown ? y0 + tierH * 0.6 : y1;
    const at = (ly0 + ly1) / 2;
    const halfAt = top + (bottom - top) * ((at - y0) / Math.max(1, tierH));
    const width = Math.max(0, halfAt * 2 - 8);
    return {
      points,
      label: { x: cx - width / 2, y: ly0, width, height: ly1 - ly0 },
    };
  });
  return { tiers, labelPx: Math.round(clamp(tierH * 0.34, 10, 20)) };
}

export type CycleLayout = {
  centre: { x: number; y: number };
  ringR: number;
  discR: number;
  discs: { x: number; y: number }[];
  arcs: { d: string; end: { x: number; y: number }; angle: number }[];
  centreLabel: LayoutRect;
  labelPx: number;
};

export function cycleLayout(w: number, h: number, n: number): CycleLayout {
  const count = Math.max(1, n);
  const S = Math.min(w, h) / 2;
  const r = Math.min(S * 0.26, S * Math.sin(Math.PI / Math.max(2, count)) * 0.6);
  const R = Math.max(1, S - r - 2);
  const centre = { x: w / 2, y: h / 2 };
  const angleOf = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / count;
  const at = (a: number) => ({ x: centre.x + R * Math.cos(a), y: centre.y + R * Math.sin(a) });
  const discs = Array.from({ length: count }, (_, i) => at(angleOf(i)));
  const inset = Math.asin(Math.min(1, (r + 6) / R));
  const arcs =
    count < 2
      ? []
      : Array.from({ length: count }, (_, i) => {
          const a0 = angleOf(i) + inset;
          const a1 = angleOf(i + 1) - inset;
          const p0 = at(a0);
          const p1 = at(a1);
          const large = a1 - a0 > Math.PI ? 1 : 0;
          return {
            d: `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${R.toFixed(2)} ${R.toFixed(2)} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
            end: p1,
            // The direction of travel at the arc's end, for its arrowhead (clockwise is +90°).
            angle: a1 + Math.PI / 2,
          };
        });
  const side = Math.max(0, (R - r) * 1.2);
  return {
    centre,
    ringR: R,
    discR: r,
    discs,
    arcs,
    centreLabel: { x: centre.x - side / 2, y: centre.y - side / 2, width: side, height: side },
    labelPx: Math.round(clamp(r * 0.36, 10, 16)),
  };
}

/** A small arrowhead at `tip`, pointing along `angle` (radians), `size` long. */
export function arrowheadPoints(
  tip: { x: number; y: number },
  angle: number,
  size: number,
): string {
  const back = { x: tip.x - Math.cos(angle) * size, y: tip.y - Math.sin(angle) * size };
  const nx = -Math.sin(angle) * size * 0.6;
  const ny = Math.cos(angle) * size * 0.6;
  return `${tip.x.toFixed(2)},${tip.y.toFixed(2)} ${(back.x + nx).toFixed(2)},${(back.y + ny).toFixed(2)} ${(back.x - nx).toFixed(2)},${(back.y - ny).toFixed(2)}`;
}

/** The size a row's text is drawn at: its kind's size, shrunk until the words fit `width` (a character estimate, so
 *  the canvas and the export agree), never under 10. Past that, the words are ellipsed. */
export function conceptFitPx(text: string, width: number, px: number): number {
  if (!text) return px;
  return Math.max(10, Math.min(px, Math.floor(width / Math.max(1, text.length * 0.6))));
}

// --- Writes ---------------------------------------------------------------------------------------

/** Set (or clear back to Pyramid) a pyramid's variant. */
export function withPyramidVariant<T extends Element>(el: T, variant: PyramidVariant | null): T {
  if (el.type !== 'shape' || el.shape !== 'pyramid') return el;
  const next = { ...el } as T & { pyramidVariant?: PyramidVariant };
  if (variant && variant !== 'pyramid') next.pyramidVariant = variant;
  else delete next.pyramidVariant;
  return next;
}

/** Set (or clear) a concept graphic's animation, its speed or its repeat. */
export function withConceptAnim<T extends Element>(
  el: T,
  patch: { anim?: ConceptAnim | null; speed?: AnimationSpeed; repeat?: boolean },
): T {
  if (el.type !== 'shape' || !isConceptShape(el.shape)) return el;
  const next = { ...el } as T & {
    conceptAnim?: ConceptAnim;
    conceptAnimSpeed?: AnimationSpeed;
    conceptAnimRepeat?: boolean;
  };
  if (patch.anim !== undefined) {
    if (patch.anim) next.conceptAnim = patch.anim;
    else delete next.conceptAnim;
  }
  if (patch.speed !== undefined) next.conceptAnimSpeed = patch.speed;
  if (patch.repeat !== undefined) next.conceptAnimRepeat = patch.repeat;
  return next;
}

/** Whether the animation repeats: Build plays once unless asked; Pulse and Flow loop unless asked not to. */
export function conceptAnimRepeats(el: ShapeElement): boolean {
  const anim = conceptAnimOf(el);
  if (el.conceptAnimRepeat !== undefined) return el.conceptAnimRepeat;
  return anim !== 'build';
}
