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
    // The tool panels home bottom-right (docs/specs/007-editor/panel-docking.md "Default layout").
    expect(layout.corners['top-right']).toEqual([]);
    expect(layout.corners['bottom-left']).toEqual(['minimap']);
    expect(layout.corners['bottom-right']).toEqual([]);
    expect(layout.free).toEqual({});
  });

  it('docks a panel to the bottom of a corner stack, removing it from its old spot', () => {
    const next = dockPanel(defaultPanelLayout(), 'minimap', 'top-right');
    // Left its old corner...
    expect(next.corners['bottom-left']).toEqual([]);
    // ...and joined below whatever is in the target corner.
    expect(dockPanel(next, 'format', 'top-right').corners['top-right']).toEqual([
      'minimap',
      'format',
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
    const stacked = dockPanel(defaultPanelLayout(), 'format', 'bottom-left');
    expect(stacked.corners['bottom-left']).toEqual(['minimap', 'format']);
    const next = dockPanel(stacked, 'minimap', 'top-left');
    expect(next.corners['bottom-left']).toEqual(['format']);
  });

  it('resolves an unmentioned panel to its default corner', () => {
    const layout: PanelLayout = { corners: normalizePanelLayout({}).corners, free: {} };
    expect(resolvePlacement(layout, 'format')).toEqual({
      mode: 'corner',
      corner: 'bottom-right',
    });
  });

  it('homes the tool panel bottom-right', () => {
    expect(DEFAULT_PANEL_CORNER.format).toBe('bottom-right');
  });

  describe('normalize', () => {
    it('drops unknown ids and dedupes a panel appearing twice', () => {
      const layout = normalizePanelLayout({
        corners: {
          'top-left': ['format', 'bogus', 'format'],
          'top-right': ['format', 'minimap'],
        },
        free: {},
      });
      expect(layout.corners['top-left']).toEqual(['format']);
      // format already seen in top-left, so top-right keeps only minimap.
      expect(layout.corners['top-right']).toEqual(['minimap']);
    });

    // Poll and Vote moved to the Session strip, then left (docs/specs/002-project-scope/not-in-livehuddle.md).
    it('ignores the Poll and Vote panels in a stored layout', () => {
      const layout = normalizePanelLayout({
        corners: { 'top-right': ['vote', 'poll', 'format'] },
        free: { poll: { x: 1, y: 2 } },
      });
      expect(layout.corners['top-right']).toEqual(['format']);
      expect(layout.free).toEqual({});
    });

    // The retired Floating layout's corner panels (docs/specs/007-editor/toolbar-layout.md "One layout").
    it('ignores the Palette, Explorer and Layers in a stored layout', () => {
      const layout = normalizePanelLayout({
        corners: {
          'top-left': ['explorer'],
          'top-right': ['palette', 'format'],
          'bottom-right': ['layers'],
        },
        free: { palette: { x: 1, y: 2 } },
      });
      expect(layout.corners['top-left']).toEqual([]);
      expect(layout.corners['top-right']).toEqual(['format']);
      expect(layout.corners['bottom-right']).toEqual([]);
      expect(layout.free).toEqual({});
    });

    // The in-editor AI assistant is gone; its stored panel placement is ignored.
    it('ignores the retired AI panel in a stored layout', () => {
      const layout = normalizePanelLayout({
        corners: { 'bottom-right': ['format', 'ai'] },
        free: { ai: { x: 5, y: 6 } },
      });
      expect(layout.corners['bottom-right']).toEqual(['format']);
      expect(layout.free).toEqual({});
    });

    // The Eraser Panel left with the Eraser (docs/specs/002-project-scope/not-in-livehuddle.md); a stored layout
    // naming it drops it.
    it('ignores the retired Eraser panel in a stored layout', () => {
      const layout = normalizePanelLayout({
        corners: { 'bottom-right': ['minimap', 'eraser', 'format'] },
        free: { eraser: { x: 5, y: 6 } },
      });
      expect(layout.corners['bottom-right']).toEqual(['minimap', 'format']);
      expect(layout.free).toEqual({});
    });

    // The Collaborate Panel left with comments and actions (docs/specs/002-project-scope/not-in-livehuddle.md
    // "Comments, actions, links and notes"); a stored layout naming it drops it.
    it('ignores the retired Collaborate panel in a stored layout', () => {
      const layout = normalizePanelLayout({
        corners: { 'bottom-right': ['collaborate', 'format'] },
        free: { collaborate: { x: 5, y: 6 } },
      });
      expect(layout.corners['bottom-right']).toEqual(['format']);
      expect(layout.free).toEqual({});
    });

    it('keeps a valid free position but ignores a malformed one', () => {
      const layout = normalizePanelLayout({
        corners: {},
        free: { format: { x: 5, y: 6 }, minimap: { x: 'nope' } },
      });
      expect(layout.free.format).toEqual({ x: 5, y: 6 });
      expect(layout.free.minimap).toBeUndefined();
    });

    it('falls back to the default layout for non-object input', () => {
      expect(normalizePanelLayout(null)).toEqual(defaultPanelLayout());
      expect(normalizePanelLayout(42)).toEqual(defaultPanelLayout());
    });
  });
});
