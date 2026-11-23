import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PANEL_CORNER,
  defaultPanelLayout,
  dockPanel,
  freePanel,
  normalizePanelLayout,
  resetPanelPlacement,
  resolvePlacement,
  type PanelLayout,
} from './panel-layout';

// The layout's rules and the snap geometry are tested once beside the one copy
// (packages/workbench/src/lib/panel-layout.test.ts); this holds them over this editor's own panels.
describe('panel-layout', () => {
  it('default layout puts each corner panel in its home corner', () => {
    const layout = defaultPanelLayout();
    // The top-left holds the menu button, not a panel (docs/specs/007-editor/toolbar-layout.md).
    expect(layout.corners['top-left']).toEqual([]);
    // Vote and Poll open over the Session strip (docs/specs/012-collaboration/session-tools.md), not here.
    // The tool panels home bottom-right (docs/specs/007-editor/panel-docking.md "Default layout").
    expect(layout.corners['top-right']).toEqual([]);
    expect(layout.corners['bottom-left']).toEqual([]);
    expect(layout.corners['bottom-right']).toEqual(['collaborate']);
    expect(layout.free).toEqual({});
  });

  it('docks a panel to the bottom of a corner stack, removing it from its old spot', () => {
    const next = dockPanel(defaultPanelLayout(), 'collaborate', 'top-right');
    // Left its old corner...
    expect(next.corners['bottom-right']).toEqual([]);
    // ...and sits in the target corner.
    expect(next.corners['top-right']).toEqual(['collaborate']);
  });

  it('a panel lives in exactly one place (free clears its corner)', () => {
    const next = freePanel(defaultPanelLayout(), 'collaborate', { x: 200, y: 120 });
    expect(next.corners['bottom-right']).toEqual([]);
    expect(next.free.collaborate).toEqual({ x: 200, y: 120 });
    expect(resolvePlacement(next, 'collaborate')).toEqual({
      mode: 'free',
      pos: { x: 200, y: 120 },
    });
  });

  it('reset returns a panel to its default corner', () => {
    const freed = freePanel(defaultPanelLayout(), 'collaborate', { x: 10, y: 10 });
    const reset = resetPanelPlacement(freed, 'collaborate');
    expect(reset.free.collaborate).toBeUndefined();
    expect(resolvePlacement(reset, 'collaborate')).toEqual({
      mode: 'corner',
      corner: DEFAULT_PANEL_CORNER.collaborate,
    });
  });

  it('re-docking a panel to another corner empties the one it left', () => {
    const next = dockPanel(
      dockPanel(defaultPanelLayout(), 'collaborate', 'top-left'),
      'collaborate',
      'top-right',
    );
    expect(next.corners['top-left']).toEqual([]);
    expect(next.corners['top-right']).toEqual(['collaborate']);
  });

  it('resolves an unmentioned panel to its default corner', () => {
    const layout: PanelLayout = { corners: normalizePanelLayout({}).corners, free: {} };
    expect(resolvePlacement(layout, 'collaborate')).toEqual({
      mode: 'corner',
      corner: 'bottom-right',
    });
  });

  describe('normalize', () => {
    it('drops unknown ids and dedupes a panel appearing twice', () => {
      const layout = normalizePanelLayout({
        corners: {
          'top-left': ['collaborate', 'bogus', 'collaborate'],
          'top-right': ['collaborate'],
        },
        free: {},
      });
      expect(layout.corners['top-left']).toEqual(['collaborate']);
      // collaborate already seen in top-left, so top-right keeps nothing.
      expect(layout.corners['top-right']).toEqual([]);
    });

    // Panels a stored layout may still name, which are corner panels no longer.
    it('ignores retired panels in a stored layout', () => {
      const layout = normalizePanelLayout({
        corners: { 'top-right': ['vote', 'poll', 'ai', 'format', 'minimap'] },
        free: { poll: { x: 1, y: 2 }, ai: { x: 3, y: 4 }, format: { x: 5, y: 6 } },
      });
      expect(layout.corners['top-right']).toEqual([]);
      expect(layout.free).toEqual({});
    });

    // The removed Map (Work Item 662): a layout saved while it existed still reads.
    it('ignores the removed Map in a stored layout', () => {
      const layout = normalizePanelLayout({
        corners: { 'bottom-left': ['minimap'] },
        free: { minimap: { x: 5, y: 6 } },
      });
      expect(layout.corners['bottom-left']).toEqual([]);
      expect(layout.free).toEqual({});
    });

    // The retired Floating layout's corner panels (docs/specs/007-editor/toolbar-layout.md "One layout").
    it('ignores the Palette, Explorer and Layers in a stored layout', () => {
      const layout = normalizePanelLayout({
        corners: {
          'top-left': ['explorer'],
          'top-right': ['palette'],
          'bottom-right': ['layers'],
        },
        free: { palette: { x: 1, y: 2 } },
      });
      expect(layout.corners['top-left']).toEqual([]);
      expect(layout.corners['top-right']).toEqual([]);
      expect(layout.corners['bottom-right']).toEqual([]);
      expect(layout.free).toEqual({});
    });

    it('keeps a valid free position but ignores a malformed one', () => {
      const layout = normalizePanelLayout({
        corners: {},
        free: { collaborate: { x: 5, y: 6 }, minimap: { x: 'nope' } },
      });
      expect(layout.free.collaborate).toEqual({ x: 5, y: 6 });
      expect(layout.free).not.toHaveProperty('minimap');
    });

    it('falls back to the default layout for non-object input', () => {
      expect(normalizePanelLayout(null)).toEqual(defaultPanelLayout());
      expect(normalizePanelLayout(42)).toEqual(defaultPanelLayout());
    });
  });
});
