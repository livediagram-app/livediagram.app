// How wide an editor's left sidebar is (liveworkspace/docs/specs/011-workbench/sidebar-width.md): its own base width up
// to a 1,439 px window, stepping up on wider windows, or the width the person dragged it to, kept in this browser.
// Pure: the steps, the bounds and the stored value. The hook every reader shares is hooks/ui/useSidebarWidth.ts.
import {
  readLocalStorageSafe,
  removeLocalStorageSafe,
  writeLocalStorageSafe,
} from './local-storage-safe';

/** From `minWindow` px of window, the sidebar is at least `width` px (at the panels' UI scale). Widest first. Chosen
 *  so liveknowledge's page rail still docks beside the tree where it did: 272 + 312 + 856 fits 1,440. */
export const SIDEBAR_WIDTH_STEPS = [
  { minWindow: 1600, width: 320 },
  { minWindow: 1520, width: 296 },
  { minWindow: 1440, width: 272 },
] as const;

/** The narrowest and widest a person can drag a sidebar. */
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 480;
/** An arrow key's step on the handle, and with Shift. */
export const SIDEBAR_WIDTH_KEY_STEP = 8;
export const SIDEBAR_WIDTH_KEY_STEP_LARGE = 32;

/** The default width beside a window `windowWidth` px wide: the base, or the widest step the window reaches. */
export function sidebarDefaultWidth(base: number, windowWidth: number): number {
  const step = SIDEBAR_WIDTH_STEPS.find((s) => windowWidth >= s.minWindow);
  return Math.max(base, step?.width ?? 0);
}

/** A width within the bounds, in whole px. */
export function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
}

/** The width kept under `key` in this browser, clamped; null for none or for anything that is not a number. */
export function readSidebarWidth(key: string): number | null {
  const raw = readLocalStorageSafe(key);
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? clampSidebarWidth(n) : null;
}

/** Keeps `width` under `key`, or forgets it (null): back to the default. */
export function writeSidebarWidth(key: string, width: number | null): void {
  if (width === null) removeLocalStorageSafe(key);
  else writeLocalStorageSafe(key, String(clampSidebarWidth(width)));
}
