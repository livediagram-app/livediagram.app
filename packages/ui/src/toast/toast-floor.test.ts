import { describe, expect, it } from 'vitest';
import {
  TOAST_EDGE_PX,
  TOAST_FLOOR_GAP_PX,
  TOAST_FLOOR_SELECTOR,
  toastFloor,
  toastPlacement,
  TOAST_PHONE_FLOOR_SELECTOR,
  TOAST_SIDE_SELECTOR,
  type FloorRect,
} from './toast-floor';

// liveworkspace/docs/specs/016-notifications/toasts.md "Placement".
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

  it('stands above a popover risen from the bottom chrome, however high it reaches', () => {
    // A phone's Timer popover off the Session strip: its top above the middle, its foot on the cluster.
    const popover = { ...rect(94, 137, 288, 386), rises: true };
    expect(toastFloor({ viewportWidth: 390, viewportHeight: 664, obstacles: [popover] })).toBe(
      664 - 137 + TOAST_FLOOR_GAP_PX,
    );
  });

  it('names the editor and Explorer bottom chrome', () => {
    for (const hook of [
      'data-toast-floor',
      'data-start-footer',
      'data-editor-tabbar',
      'data-zoom-cluster',
      'data-whiteboard-dock',
      'data-toast-side',
    ]) {
      expect(TOAST_FLOOR_SELECTOR).toContain(`[${hook}]`);
    }
    // A product's own bottom-right controls opt into the cluster's line.
    expect(TOAST_SIDE_SELECTOR).toBe('[data-zoom-cluster], [data-toast-side]');
    expect(TOAST_PHONE_FLOOR_SELECTOR).toBe('[data-start-footer]');
  });
});

describe('toastPlacement', () => {
  const tabBar = rect(0, 852, 1440, 48);
  const cluster = rect(895, 790, 530, 46);

  it('from 640px, stands level with the cluster and just left of it, not above it', () => {
    expect(
      toastPlacement({
        viewportWidth: 1440,
        viewportHeight: 900,
        floors: [tabBar],
        sides: [cluster],
      }),
    ).toEqual({ bottom: 900 - 836, right: 1440 - 895 + TOAST_FLOOR_GAP_PX });
  });

  it("ignores a template start's foot row from 640px (a centred dialog), and stands on it on a phone (a sheet)", () => {
    expect(
      toastPlacement({
        viewportWidth: 1440,
        viewportHeight: 900,
        floors: [tabBar, { ...rect(300, 700, 840, 66), phoneOnly: true }],
        sides: [cluster],
      }),
    ).toEqual({ bottom: 900 - 836, right: 1440 - 895 + TOAST_FLOOR_GAP_PX });
    const sheetFoot = { ...rect(0, 600, 390, 64), phoneOnly: true };
    expect(
      toastPlacement({ viewportWidth: 390, viewportHeight: 664, floors: [sheetFoot], sides: [] }),
    ).toEqual({ bottom: 664 - 600 + TOAST_FLOOR_GAP_PX, right: null });
  });

  it("stays centred where the cluster leaves the centre clear, still on the cluster's line", () => {
    const wide = rect(1500, 790, 380, 46);
    expect(
      toastPlacement({ viewportWidth: 1920, viewportHeight: 900, floors: [tabBar], sides: [wide] }),
    ).toEqual({ bottom: 900 - 836, right: null });
  });

  it('never stands lower than a floor taller than the cluster, and ignores a hidden one', () => {
    const banner = rect(300, 700, 800, 120);
    expect(
      toastPlacement({
        viewportWidth: 1440,
        viewportHeight: 900,
        floors: [tabBar, banner],
        sides: [cluster, rect(0, 0, 0, 0), rect(895, 100, 530, 46)],
      }).bottom,
    ).toBe(200 + TOAST_FLOOR_GAP_PX);
  });

  it('on a phone, the cluster is one more floor', () => {
    expect(
      toastPlacement({
        viewportWidth: 390,
        viewportHeight: 844,
        floors: [rect(0, 796, 390, 48)],
        sides: [rect(200, 740, 180, 44)],
      }),
    ).toEqual({ bottom: 104 + TOAST_FLOOR_GAP_PX, right: null });
  });
});
