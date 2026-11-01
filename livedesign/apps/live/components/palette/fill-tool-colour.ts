'use client';

// The colour the Fill tool pours (docs/specs/023-draw-mode/drawing-tools.md "The Fill tool"), one
// per browser: the logo Draw's row, the category flyout's tile and its colour panel all read and
// set this one, so a pick in any of them shows on the others at once.
import { useSyncExternalStore } from 'react';
import { standardColours, type CanvasSurface } from '@livedesign/design';
import {
  loadFillChoice,
  saveFillChoice,
  type FillChoice,
} from '@liveworkspace/workbench/lib/fill-choice';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';

// Where this browser keeps the Fill tool's colour.
export const FILL_CHOICE_KEY = 'livedesign:v2:fill';

/** Until one is picked the bucket pours the soft Blue, drawn for the canvas it pours on. */
export function defaultFill(surface: CanvasSurface): string {
  return standardColours('soft', surface).find((c) => c.name === 'blue')!.hex;
}

// Read from storage on first use; undefined until then.
let choice: FillChoice | undefined;
const listeners = new Set<() => void>();

function current(): FillChoice {
  if (choice === undefined) choice = loadFillChoice(FILL_CHOICE_KEY);
  return choice;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Keeps a new colour for this browser and tells every reader. */
export function setFillColour(next: string): void {
  saveFillChoice(FILL_CHOICE_KEY, next);
  choice = loadFillChoice(FILL_CHOICE_KEY);
  listeners.forEach((l) => l());
}

/** Forgets the colour read, so the next read goes back to storage (tests). */
export function resetFillColour(): void {
  choice = undefined;
}

/** The colour the bucket pours: the one picked, else the default for this canvas. */
export function useFillColour(): string {
  const surface = useCanvasSurface();
  const picked = useSyncExternalStore(subscribe, current, () => null);
  return picked ?? defaultFill(surface);
}
