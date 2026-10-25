import { describe, expect, it } from 'vitest';
import {
  TOAST_EDGE_PX,
  TOAST_FLOOR_GAP_PX,
  TOAST_FLOOR_SELECTOR,
  toastFloor,
  type FloorRect,
} from './toast-floor';

// docs/specs/004-interface-design/toasts.md "Placement".
const rect = (left: number, top: number, width: number, height: number): FloorRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
});

describe('toastFloor', () => {
  it('sits 16px off the bottom edge with nothing beneath it', () => {
    expect(toastFloor({ viewportWidth: 1280, viewportHeight: 800, obstacles: [] })).toBe(
      TOAST_EDGE_PX,
    );
  });

  it('stands 8px above the highest bottom chrome under its column', () => {
    const tabBar = rect(0, 752, 1280, 48);
    const banner = rect(256, 636, 768, 100);
    expect(toastFloor({ viewportWidth: 1280, viewportHeight: 800, obstacles: [tabBar] })).toBe(
      48 + TOAST_FLOOR_GAP_PX,
    );
    expect(
      toastFloor({ viewportWidth: 1280, viewportHeight: 800, obstacles: [tabBar, banner] }),
    ).toBe(164 + TOAST_FLOOR_GAP_PX);
  });

  it('ignores chrome beside its column (the cluster on a wide desktop), but not on a laptop', () => {
    const tabBar = rect(0, 852, 1600, 48);
    const wideCluster = rect(1200, 800, 380, 44);
    expect(
      toastFloor({ viewportWidth: 1600, viewportHeight: 900, obstacles: [tabBar, wideCluster] }),
    ).toBe(56);
    // At 1280 the cluster (878 to 1264) reaches into the 352 to 928 column.
    const laptopCluster = rect(878, 690, 386, 46);
    expect(
      toastFloor({ viewportWidth: 1280, viewportHeight: 800, obstacles: [laptopCluster] }),
    ).toBe(118);
  });

  it('spans the phone between its gutters, so any bottom chrome counts', () => {
    const cluster = rect(110, 744, 263, 44);
    expect(toastFloor({ viewportWidth: 390, viewportHeight: 844, obstacles: [cluster] })).toBe(108);
  });

  it('skips chrome with no size, off screen, or in the top half (a dock moved to the top)', () => {
    const obstacles = [rect(0, 700, 0, 0), rect(0, 900, 1280, 40), rect(300, 80, 600, 60)];
    expect(toastFloor({ viewportWidth: 1280, viewportHeight: 800, obstacles })).toBe(TOAST_EDGE_PX);
  });

  it('names the editor and Explorer bottom chrome', () => {
    for (const hook of [
      'data-toast-floor',
      'data-editor-tabbar',
      'data-zoom-cluster',
      'data-whiteboard-dock',
    ]) {
      expect(TOAST_FLOOR_SELECTOR).toContain(`[${hook}]`);
    }
  });

  // The sign-in banner stands on the editor's bottom chrome too (docs/specs/014-identity/sign-in-encouragement.md),
  // with its own wider column: the Undo / Timer / Vote / Poll cluster beside a toast's column is under the banner's.
  it('measures a wider column when asked, so the sign-in banner clears the session cluster', () => {
    const cluster = { top: 790, left: 1060, right: 1424, width: 364, height: 46 };
    const at = { viewportWidth: 1440, viewportHeight: 900, obstacles: [cluster] };
    expect(toastFloor(at)).toBe(TOAST_EDGE_PX);
    expect(toastFloor({ ...at, columnWidth: 768 })).toBe(900 - 790 + 8);
  });
});
