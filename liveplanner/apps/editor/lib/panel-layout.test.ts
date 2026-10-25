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
  it('default layout puts each corner panel in its home corner', () => {
    const layout = defaultPanelLayout();
    // The top-left holds the menu button, not a panel (docs/specs/007-editor/toolbar-layout.md).
    expect(layout.corners['top-left']).toEqual([]);
    // Vote and Poll open over the Session strip (docs/specs/012-collaboration/session-tools.md), not here.
    // The tool panels home bottom-right (docs/specs/007-editor/panel-docking.md "Default layout").
    expect(layout.corners['top-right']).toEqual([]);
    expect(layout.corners['bottom-left']).toEqual(['minimap']);
    expect(layout.corners['bottom-right']).toEqual(['collaborate']);
    expect(layout.free).toEqual({});
  });

  it('docks a panel to the bottom of a corner stack, removing it from its old spot', () => {
    const next = dockPanel(defaultPanelLayout(), 'minimap', 'top-right');
    // Left its old corner...
    expect(next.corners['bottom-left']).toEqual([]);
    // ...and joined below whatever is in the target corner.
    expect(dockPanel(next, 'collaborate', 'top-right').corners['top-right']).toEqual([
      'minimap',
      'collaborate',
    ]);
  });

  it('a panel lives in exactly one place (free clears its corner)', () => {
    const next = freePanel(defaultPanelLayout(), 'minimap', { x: 200, y: 120 });
    expect(next.corners['bottom-left']).toEqual([]);
    expect(next.free.minimap).toEqual({ x: 200, y: 120 });
    expect(resolvePlacement(next, 'minimap')).toEqual({
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
    // Stack two in the bottom-right, then move the first away; the second leads the stack.
    const stacked = dockPanel(defaultPanelLayout(), 'minimap', 'bottom-right');
    expect(stacked.corners['bottom-right']).toEqual(['collaborate', 'minimap']);
    const next = dockPanel(stacked, 'collaborate', 'top-left');
    expect(next.corners['bottom-right']).toEqual(['minimap']);
  });

  it('resolves an unmentioned panel to its default corner', () => {
    const layout: PanelLayout = { corners: normalizePanelLayout({}).corners, free: {} };
    expect(resolvePlacement(layout, 'minimap')).toEqual({
      mode: 'corner',
      corner: 'bottom-left',
    });
  });

  describe('normalize', () => {
    it('drops unknown ids and dedupes a panel appearing twice', () => {
      const layout = normalizePanelLayout({
        corners: {
          'top-left': ['minimap', 'bogus', 'minimap'],
          'top-right': ['minimap', 'collaborate'],
        },
        free: {},
      });
      expect(layout.corners['top-left']).toEqual(['minimap']);
      // minimap already seen in top-left, so top-right keeps only collaborate.
      expect(layout.corners['top-right']).toEqual(['collaborate']);
    });

    // Panels a stored layout may still name, which are corner panels no longer.
    it('ignores retired panels in a stored layout', () => {
      const layout = normalizePanelLayout({
        corners: { 'top-right': ['vote', 'poll', 'ai', 'format', 'minimap'] },
        free: { poll: { x: 1, y: 2 }, ai: { x: 3, y: 4 }, format: { x: 5, y: 6 } },
      });
      expect(layout.corners['top-right']).toEqual(['minimap']);
      expect(layout.free).toEqual({});
    });

    // The retired Floating layout's corner panels (docs/specs/007-editor/toolbar-layout.md "One layout").
    it('ignores the Palette, Explorer and Layers in a stored layout', () => {
      const layout = normalizePanelLayout({
        corners: {
          'top-left': ['explorer'],
          'top-right': ['palette', 'minimap'],
          'bottom-right': ['layers'],
        },
        free: { palette: { x: 1, y: 2 } },
      });
      expect(layout.corners['top-left']).toEqual([]);
      expect(layout.corners['top-right']).toEqual(['minimap']);
      expect(layout.corners['bottom-right']).toEqual([]);
      expect(layout.free).toEqual({});
    });

    it('keeps a valid free position but ignores a malformed one', () => {
      const layout = normalizePanelLayout({
        corners: {},
        free: { minimap: { x: 5, y: 6 }, collaborate: { x: 'nope' } },
      });
      expect(layout.free.minimap).toEqual({ x: 5, y: 6 });
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

    it('clears zoom controls drawn at a UI scale (docs/specs/007-editor/ui-scale.md)', () => {
      // The 44px cluster grows with the scale; the corner inset and the 12px
      // gap above it do not.
      expect(cornerBottomInset('bottom-right', 1)).toBe(72);
      expect(cornerBottomInset('bottom-right', 1.5)).toBe(94);
      expect(cornerBottomInset('bottom-left', 1.5)).toBe(CORNER_INSET_PX);
      // The snap anchor moves with it, so a panel landing at the raised
      // inset still snaps there.
      const tall: PanelDragGeometry = {
        x: container.parentWidth - CORNER_INSET_PX - size.width,
        y: container.parentHeight - cornerBottomInset('bottom-right', 1.5) - size.height,
        ...size,
        ...container,
      };
      expect(nearestSnapCorner(tall, {}, 1.5)).toBe('bottom-right');
    });
  });
});
