'use client';

// The zoom of a Sheet covering the canvas (docs/specs/029-sheets/sheet.md "Zoom"): maximised or filling its tab, the
// canvas cannot zoom, so the bottom-right zoom controls zoom the sheet's cells instead. The person's own view, like
// maximising: a module store, never saved, sent or undone, back to 100% when no Sheet covers the canvas.
import { useSyncExternalStore } from 'react';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

export const SHEET_ZOOM_MIN = 0.5;
export const SHEET_ZOOM_MAX = 2;
// A step of the zoom controls' + and -, as the canvas's.
const SHEET_ZOOM_STEP = 0.1;

let zoom = 1;
const listeners = createListeners();

// Clamped to the range, and to whole percents so steps never drift.
export function setSheetZoom(next: number): void {
  const z = Math.round(Math.min(SHEET_ZOOM_MAX, Math.max(SHEET_ZOOM_MIN, next)) * 100) / 100;
  if (z === zoom || Number.isNaN(z)) return;
  zoom = z;
  listeners.notify();
}

export function stepSheetZoom(dir: 1 | -1): void {
  setSheetZoom(zoom + dir * SHEET_ZOOM_STEP);
}

export function getSheetZoom(): number {
  return zoom;
}

const one = () => 1;
export function useSheetZoom(): number {
  return useSyncExternalStore(listeners.subscribe, getSheetZoom, one);
}
