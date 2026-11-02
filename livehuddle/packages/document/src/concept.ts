// The Timeline (docs/specs/009-elements/timeline.md): milestones along a spine, one element laying out its own rows
// (`conceptRows`, a name and a when each). It keeps the concept-graphic vocabulary it was built with (the rows, the
// Build and Pulse animations), so a Timeline made in livediagram opens as it is. The marks are PURE so the canvas face
// and the headless renderer draw from the same numbers, and an export matches the editor.
//
// A LEAF module: types only from './index'.

import type { AnimationSpeed, Element, ShapeElement } from './index';

// The Timeline keeps the kind it was made as, a timeline rail, so every saved one opens as it.
export type ConceptShape = 'timeline-rail';
export type ConceptRow = { label: string; note?: string };
export type ConceptAnim = 'build' | 'pulse';

const CONCEPT_ANIMS: readonly ConceptAnim[] = ['build', 'pulse'];
export const CONCEPT_LABEL_MAX = 60;
export const CONCEPT_NOTE_MAX = 40;

export const CONCEPT_ROWS: Readonly<
  Record<ConceptShape, { min: number; max: number; noun: string; noteNoun?: string }>
> = {
  // A milestone's note is its when: a date, a quarter, a sprint.
  'timeline-rail': { min: 2, max: 8, noun: 'Milestone', noteNoun: 'When' },
};

export function isConceptShape(kind: string): kind is ConceptShape {
  return Object.hasOwn(CONCEPT_ROWS, kind);
}

function isConceptAnim(v: unknown): v is ConceptAnim {
  return v === 'build' || v === 'pulse';
}

/** The animations a Timeline is offered: Build and Pulse. */
export function conceptAnimsFor(_kind: ConceptShape): readonly ConceptAnim[] {
  return CONCEPT_ANIMS;
}

/** The animation an element plays: its own when its kind offers it, else none. */
export function conceptAnimOf(el: ShapeElement): ConceptAnim | null {
  if (!isConceptShape(el.shape) || !isConceptAnim(el.conceptAnim)) return null;
  return conceptAnimsFor(el.shape).includes(el.conceptAnim) ? el.conceptAnim : null;
}

/** Trim + bound a row's text the way every write path should. */
function clampConceptText(s: string, max: number): string {
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

// --- Marks ----------------------------------------------------------------------------------------

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

/** Set (or clear) a Timeline's animation, its speed or its repeat. */
export function withConceptAnim<T extends Element>(
  el: T,
  patch: { anim?: ConceptAnim | null; speed?: AnimationSpeed; repeat?: boolean },
): T {
  if (el.type !== 'shape' || !isConceptShape(el.shape)) return el;
  // An animation its kind cannot play is not written, so a stored value always plays.
  if (patch.anim && !conceptAnimsFor(el.shape).includes(patch.anim)) return el;
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

/** Whether the animation repeats: Build plays once unless asked; Pulse loops unless asked not to. */
export function conceptAnimRepeats(el: ShapeElement): boolean {
  const anim = conceptAnimOf(el);
  if (el.conceptAnimRepeat !== undefined) return el.conceptAnimRepeat;
  return anim !== 'build';
}
