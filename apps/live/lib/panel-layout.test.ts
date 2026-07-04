import { describe, expect, it } from 'vitest';
import {
  CORNER_INSET_PX,
  cornerBottomInset,
  DEFAULT_PANEL_CORNER,
  defaultPanelLayout,
  dockPanel,
  freePanel,
  nearestSnapCorner,
  normalizePanelLayout,
  resetPanelPlacement,
  resolvePlacement,
  type PanelDragGeometry,
  type PanelLayout,
} from './panel-layout';

describe('panel-layout', () => {
  it('default layout preserves the historical fixed arrangement', () => {
    const layout = defaultPanelLayout();
    expect(layout.corners['top-left']).toEqual(['explorer']);
    expect(layout.corners['top-right']).toEqual(['palette', 'collaborate', 'ai']);
    expect(layout.corners['bottom-left']).toEqual(['activity', 'minimap']);
    expect(layout.corners['bottom-right']).toEqual([]);
    expect(layout.free).toEqual({});
  });

  it('docks a panel to the bottom of a corner stack, removing it from its old spot', () => {
    const next = dockPanel(defaultPanelLayout(), 'palette', 'bottom-right');
    // Left its old corner...
    expect(next.corners['top-right']).toEqual(['collaborate', 'ai']);
    // ...and joined below whatever is in the target corner.
    expect(next.corners['bottom-right']).toEqual(['palette']);
  });

  it('a panel lives in exactly one place (free clears its corner)', () => {
    const next = freePanel(defaultPanelLayout(), 'explorer', { x: 200, y: 120 });
    expect(next.corners['top-left']).toEqual([]);
    expect(next.free.explorer).toEqual({ x: 200, y: 120 });
    expect(resolvePlacement(next, 'explorer')).toEqual({
      mode: 'free',
      pos: { x: 200, y: 120 },
    });
  });

  it('reset returns a panel to its default corner', () => {
    const freed = freePanel(defaultPanelLayout(), 'minimap', { x: 10, y: 10 });
    const reset = resetPanelPlacement(freed, 'minimap');
    expect(reset.free.minimap).toBeUndefined();
    expect(resolvePlacement(reset, 'minimap')).toEqual({
      mode: 'corner',
      corner: DEFAULT_PANEL_CORNER.minimap,
    });
  });

  it('reflow: removing a stacked panel shifts the rest up', () => {
    // Move the top-right Palette away; collaborate should now lead the stack.
    const next = dockPanel(defaultPanelLayout(), 'palette', 'top-left');
    expect(next.corners['top-right']).toEqual(['collaborate', 'ai']);
  });

  it('resolves an unmentioned panel to its default corner', () => {
    const layout: PanelLayout = { corners: normalizePanelLayout({}).corners, free: {} };
    expect(resolvePlacement(layout, 'palette')).toEqual({
      mode: 'corner',
      corner: 'top-right',
    });
  });

  describe('normalize', () => {
    it('drops unknown ids and dedupes a panel appearing twice', () => {
      const layout = normalizePanelLayout({
        corners: {
          'top-left': ['explorer', 'bogus', 'explorer'],
          'top-right': ['explorer', 'palette'],
        },
        free: {},
      });
      expect(layout.corners['top-left']).toEqual(['explorer']);
      // explorer already seen in top-left, so top-right keeps only palette.
      expect(layout.corners['top-right']).toEqual(['palette']);
    });

    it('keeps a valid free position but ignores a malformed one', () => {
      const layout = normalizePanelLayout({
        corners: {},
        free: { ai: { x: 5, y: 6 }, collaborate: { x: 'nope' } },
      });
      expect(layout.free.ai).toEqual({ x: 5, y: 6 });
      expect(layout.free.collaborate).toBeUndefined();
    });

    it('falls back to the default layout for non-object input', () => {
      expect(normalizePanelLayout(null)).toEqual(defaultPanelLayout());
      expect(normalizePanelLayout(42)).toEqual(defaultPanelLayout());
    });
  });

  describe('nearestSnapCorner', () => {
    const container = { parentWidth: 1000, parentHeight: 800 };
    const size = { width: 200, height: 150 };

    it('snaps a panel sitting flush in a corner to that corner', () => {
      // Panel resting at the top-left inset.
      const geom: PanelDragGeometry = {
        x: CORNER_INSET_PX,
        y: CORNER_INSET_PX,
        ...size,
        ...container,
      };
      expect(nearestSnapCorner(geom)).toBe('top-left');
    });

    it('watches the panel top-right corner for a top-right snap', () => {
      const geom: PanelDragGeometry = {
        x: container.parentWidth - CORNER_INSET_PX - size.width,
        y: CORNER_INSET_PX,
        ...size,
        ...container,
      };
      expect(nearestSnapCorner(geom)).toBe('top-right');
    });

    it('returns null in the dead centre (a free drop)', () => {
      const geom: PanelDragGeometry = {
        x: container.parentWidth / 2 - size.width / 2,
        y: container.parentHeight / 2 - size.height / 2,
        ...size,
        ...container,
      };
      expect(nearestSnapCorner(geom)).toBeNull();
    });

    it('an occupied corner snaps at the landing position, below the existing stack', () => {
      const stack = 300; // an existing panel ~300px tall in the top-left
      // A dragged panel whose top-left sits at the bare corner is NOT a
      // top-left snap anymore (it would overlap the existing panel)...
      const atCorner: PanelDragGeometry = {
        x: CORNER_INSET_PX,
        y: CORNER_INSET_PX,
        ...size,
        ...container,
      };
      expect(nearestSnapCorner(atCorner, { 'top-left': stack })).not.toBe('top-left');
      // ...but one sitting just below the stack (where it would land) IS.
      const belowStack: PanelDragGeometry = {
        x: CORNER_INSET_PX,
        y: CORNER_INSET_PX + stack + 16,
        ...size,
        ...container,
      };
      expect(nearestSnapCorner(belowStack, { 'top-left': stack })).toBe('top-left');
    });

    it('bottom-right anchor is raised to clear the zoom controls', () => {
      // The bottom-right corner sits higher than the others by the zoom
      // clearance, so a panel docked there clears the zoom bar.
      expect(cornerBottomInset('bottom-right')).toBeGreaterThan(cornerBottomInset('bottom-left'));
      // A panel flush in the bottom-right at the RAISED inset snaps there.
      const raised: PanelDragGeometry = {
        x: container.parentWidth - CORNER_INSET_PX - size.width,
        y: container.parentHeight - cornerBottomInset('bottom-right') - size.height,
        ...size,
        ...container,
      };
      expect(nearestSnapCorner(raised)).toBe('bottom-right');
    });
  });
});
