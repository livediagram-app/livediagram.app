// The name chips' measured widths (docs/specs/008-canvas/avatar-mode.md "Seated neighbours' chips never cover each
// other", Work Tracker 706): AvatarWalker measures each chip once per name and status, in CSS px before any zoom
// (offsetWidth ignores the canvas's scale), and the chip spread reads them here, so neighbours stand exactly
// NAME_CHIP_GAP apart instead of the character-count estimate's wider gaps (132 px estimated against 108 measured),
// and a name of wide glyphs never overlaps. A chip not measured yet (the first frame, a test without layout) takes the
// estimate. Held outside React: the spread reads it as it runs, and the layer re-renders once per new width.

import { useSyncExternalStore } from 'react';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';
import { nameChipWidth } from './chair-sitters';

// At most this many widths are kept (a room of 1,000 people, each with a few statuses), oldest dropped first.
const CHIP_WIDTHS_MAX = 4096;

const widths = new Map<string, number>();
const listeners = createListeners();
// The width reader the chip spread is handed: a new one each time a width is measured, so a memo that spreads chips
// depends on it and spreads again with the new width.
type ChipWidthReader = (
  name: string | null | undefined,
  status: string | null | undefined,
) => number;
const newReader = (): ChipWidthReader => (n, st) => chipWidthOf(n, st);
let reader = newReader();
const currentReader = () => reader;

/** The key a chip's width is kept under: its name (none for your own status chip) and its status label. */
export function chipWidthKey(
  name: string | null | undefined,
  status: string | null | undefined,
): string {
  return `${name ?? ''}\u0000${status ?? ''}`;
}

/** Whether this chip still needs measuring. */
export function chipNeedsMeasure(key: string): boolean {
  return !widths.has(key);
}

/** Keep a chip's measured width (a zero one, from a layout-free screen, is not a measure). */
export function reportChipWidth(key: string, width: number): void {
  if (!(width > 0) || !Number.isFinite(width)) return;
  const rounded = Math.round(width * 10) / 10;
  if (widths.get(key) === rounded) return;
  widths.delete(key);
  widths.set(key, rounded);
  if (widths.size > CHIP_WIDTHS_MAX) widths.delete(widths.keys().next().value!);
  reader = newReader();
  listeners.notify();
}

/** How wide a chip draws: its measure, or the estimate until it has one. */
export function chipWidthOf(
  name: string | null | undefined,
  status: string | null | undefined,
): number {
  if (!name && !status) return 0;
  return widths.get(chipWidthKey(name, status)) ?? nameChipWidth(name, status);
}

/** How wide each chip draws (chipWidthOf), as a function that changes whenever a width is measured. */
export function useChipWidthOf(): ChipWidthReader {
  return useSyncExternalStore(listeners.subscribe, currentReader, currentReader);
}

/** Forget every measure (tests). */
export function resetChipWidths(): void {
  widths.clear();
  reader = newReader();
  listeners.notify();
}
