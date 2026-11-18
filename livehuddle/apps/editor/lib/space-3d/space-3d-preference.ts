// Whether this person walks in the 3D view (docs/specs/008-canvas/3d-view.md "Turning it on and off"): remembered in
// this browser alone (Browser Storage), never synced, on until turned off (DEFAULTS.md D141). One store, so the
// cluster's switch and the canvas read the same value, and the tilt the view has now, for a walking press.

import { createStateStore } from '@liveworkspace/workbench/lib/state-store';
import {
  readLocalStorageSafe,
  writeLocalStorageSafe,
} from '@liveworkspace/workbench/lib/local-storage-safe';
import { track } from '@/lib/telemetry';

export const SPACE_3D_STORAGE_KEY = 'livehuddle:v2:space-3d';

/** The remembered choice, read once from this browser: 3D unless this browser turned it off. */
export const space3DPreference = createStateStore<boolean>(
  readLocalStorageSafe(SPACE_3D_STORAGE_KEY) !== '0',
);

/** Turns the 3D view on or off, remembered. Turning it on is counted, before it is written. */
export function toggleSpace3D(): void {
  const on = !space3DPreference.get();
  if (on) track('Canvas', 'Used', 'Space3DView');
  writeLocalStorageSafe(SPACE_3D_STORAGE_KEY, on ? '1' : '0');
  space3DPreference.set(on);
}

/** How long the arrival's overview holds the flat plan of the whole tab before the view tilts in, in ms. */
export const SPACE_3D_OVERVIEW_MS = 1000;

/**
 * The arrival's overview (docs/specs/008-canvas/3d-view.md "Arriving"): true while a walk that has just arrived on a tab
 * shows the whole tab flat before the 3D view tilts in. The walking camera sets it; the view stays flat while it holds.
 */
export const space3DOverview = createStateStore<boolean>(false);

// The tilt the view has right now, in degrees: 0 while flat (or flattening). Written by the view, read when a walking
// press is traced back to the floor.
let tiltNow = 0;
export function space3DTiltNow(): number {
  return tiltNow;
}
export function setSpace3DTiltNow(deg: number): void {
  tiltNow = deg;
}
