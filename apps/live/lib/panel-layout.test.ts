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
    // Vote (docs/specs/012-collaboration/session-tools.md) and Poll (docs/specs/012-collaboration/live-poll.md)
    // exist only while their session runs, so most of the time this corner is just ai.
    expect(layout.corners['top-right']).toEqual(['vote', 'poll', 'ai']);
    expect(layout.corners['bottom-left']).toEqual(['minimap']);
    expect(layout.corners['bottom-right']).toEqual(['collaborate']);
    expect(layout.free).toEqual({});
  });

  it('docks a panel to the bottom of a corner stack, removing it from its old spot', () => {
    const next = dockPanel(defaultPanelLayout(), 'vote', 'bottom-right');
    // Left its old corner...
    expect(next.corners['top-right']).toEqual(['poll', 'ai']);
    // ...and joined below whatever is in the target corner.
    expect(next.corners['bottom-right']).toEqual(['collaborate', 'vote']);
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
    // Move the top-right Vote panel away; poll should now lead the stack.
    const next = dockPanel(defaultPanelLayout(), 'vote', 'top-left');
    expect(next.corners['top-right']).toEqual(['poll', 'ai']);
  });

  it('resolves an unmentioned panel to its default corner', () => {
    const layout: PanelLayout = { corners: normalizePanelLayout({}).corners, free: {} };
    expect(resolvePlacement(layout, 'ai')).toEqual({
      mode: 'corner',
      corner: 'top-right',
    });
  });

  describe('normalize', () => {
    it('drops unknown ids and dedupes a panel appearing twice', () => {
      const layout = normalizePanelLayout({
        corners: {
          'top-left': ['ai', 'bogus', 'ai'],
          'top-right': ['ai', 'poll'],
        },
        free: {},
      });
      expect(layout.corners['top-left']).toEqual(['ai']);
      // ai already seen in top-left, so top-right keeps only poll.
      expect(layout.corners['top-right']).toEqual(['poll']);
    });

    // The retired Floating layout's corner panels (docs/specs/007-editor/toolbar-layout.md "One layout").
    it('ignores the Palette, Explorer and Layers in a stored layout', () => {
      const layout = normalizePanelLayout({
        corners: {
          'top-left': ['explorer'],
          'top-right': ['palette', 'ai'],
          'bottom-right': ['layers'],
        },
        free: { palette: { x: 1, y: 2 } },
      });
      expect(layout.corners['top-left']).toEqual([]);
      expect(layout.corners['top-right']).toEqual(['ai']);
      expect(layout.corners['bottom-right']).toEqual([]);
      expect(layout.free).toEqual({});
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
