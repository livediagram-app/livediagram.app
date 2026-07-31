// The eraser's settings (spec/113): how it erases, how big it is, what it may
// remove, and what it does with a group — plus the pure helpers the erase
// gesture uses to apply them.
//
// Device-local, like the other tool panels (spec/111, spec/112): it is set for
// the job in front of you, not stored on the diagram. Never sent to the api.

import { selectionMembers, type Element } from '@livediagram/diagram';
import { readLocalStorageSafe, writeLocalStorageSafe } from './local-storage-safe';

export type EraserMode = 'sweep' | 'tap';
export type EraserSize = 'point' | 'small' | 'medium' | 'large';
// What the eraser is allowed to remove. 'drawings' is the one that makes
// sketching over a diagram safe; 'arrows' is for rewiring without disturbing
// the boxes.
export type EraserTarget = 'anything' | 'drawings' | 'arrows';
export type EraserGroups = 'piece' | 'group';

export type EraserConfig = {
  mode: EraserMode;
  size: EraserSize;
  target: EraserTarget;
  groups: EraserGroups;
};

// Today's eraser exactly: drag across things, one pixel wide, delete whatever
// it touches, one member at a time. Anyone who never opens the panel sees no
// change at all.
export const DEFAULT_ERASER_CONFIG: EraserConfig = {
  mode: 'sweep',
  size: 'point',
  target: 'anything',
  groups: 'piece',
};

export const ERASER_MODES: readonly { id: EraserMode; label: string; hint: string }[] = [
  { id: 'sweep', label: 'Sweep', hint: 'Drag across things to erase them' },
  { id: 'tap', label: 'Tap', hint: 'One press, one thing — for a crowded canvas' },
];

export const ERASER_SIZES: readonly { id: EraserSize; label: string }[] = [
  { id: 'point', label: 'Point' },
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
];

export const ERASER_TARGETS: readonly { id: EraserTarget; label: string; hint: string }[] = [
  { id: 'anything', label: 'Anything', hint: 'Every element the brush touches' },
  { id: 'drawings', label: 'Drawings', hint: 'Only pencil and highlighter strokes' },
  { id: 'arrows', label: 'Arrows', hint: 'Only connectors — the boxes stay put' },
];

export const ERASER_GROUPS: readonly { id: EraserGroups; label: string; hint: string }[] = [
  { id: 'piece', label: 'Just the piece', hint: 'Erase the one element you touched' },
  { id: 'group', label: 'Whole group', hint: 'Erase everything grouped with it' },
];

// --- What the gesture uses --------------------------------------------------

// Brush radius in SCREEN px (the hit test works on client coordinates, and the
// brush should feel the same size however far the canvas is zoomed).
const SIZE_RADIUS: Record<EraserSize, number> = { point: 0, small: 18, medium: 36, large: 72 };

export function eraserRadius(config: EraserConfig): number {
  return SIZE_RADIUS[config.size];
}

// The points to hit-test for one pointer position: the centre, plus two rings
// of samples out to the radius. Sampling beats geometry here because the
// eraser's hit test is the DOM's (elementsFromPoint), which already knows
// about every element type, arrow hit-bands included — this just asks it a few
// more times. Twelve points on the rim is dense enough that a brush can't slip
// past a thin arrow between samples.
export function eraserSamplePoints(
  clientX: number,
  clientY: number,
  radius: number,
): { x: number; y: number }[] {
  if (radius <= 0) return [{ x: clientX, y: clientY }];
  const points = [{ x: clientX, y: clientY }];
  for (const ring of [radius / 2, radius]) {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      points.push({ x: clientX + Math.cos(angle) * ring, y: clientY + Math.sin(angle) * ring });
    }
  }
  return points;
}

// Is this element one the current filter allows the eraser to remove? Locking
// and layer state are checked separately, by the gesture — no setting here can
// override those.
export function eraserAllows(element: Element, target: EraserTarget): boolean {
  if (target === 'anything') return true;
  if (target === 'arrows') return element.type === 'arrow';
  // Drawings: the freehand family, which covers both the Pencil and the
  // Highlighter (they share the element type and differ by variant).
  return element.type === 'freehand';
}

// The ids one touch should remove: just the element, or everything grouped
// with it. `selectionMembers` is the same helper selection uses to expand a
// click into its group, so an erase and a select agree on what a group is —
// including the ungrouped case, where it returns the one id.
export function eraserIdsFor(
  element: Element,
  elements: Element[],
  groups: EraserGroups,
): string[] {
  if (groups === 'piece') return [element.id];
  return selectionMembers(elements, element.id);
}

// --- Parsing ----------------------------------------------------------------

function pick<T extends string>(value: unknown, options: readonly { id: T }[], fallback: T): T {
  return options.some((option) => option.id === value) ? (value as T) : fallback;
}

export function parseEraserConfig(raw: unknown): EraserConfig {
  const parsed: unknown = typeof raw === 'string' ? safeJson(raw) : raw;
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_ERASER_CONFIG };
  const o = parsed as Record<string, unknown>;
  return {
    mode: pick(o.mode, ERASER_MODES, DEFAULT_ERASER_CONFIG.mode),
    size: pick(o.size, ERASER_SIZES, DEFAULT_ERASER_CONFIG.size),
    target: pick(o.target, ERASER_TARGETS, DEFAULT_ERASER_CONFIG.target),
    groups: pick(o.groups, ERASER_GROUPS, DEFAULT_ERASER_CONFIG.groups),
  };
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// --- Storage ----------------------------------------------------------------

const STORAGE_KEY = 'livediagram:v2:eraser-config';

export function loadEraserConfig(): EraserConfig {
  return parseEraserConfig(readLocalStorageSafe(STORAGE_KEY));
}

export function saveEraserConfig(config: EraserConfig): void {
  writeLocalStorageSafe(STORAGE_KEY, JSON.stringify(config));
}
