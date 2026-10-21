import { describe, expect, it } from 'vitest';
import {
  PANE_FIT_MARGIN_PX,
  PANE_FIT_MAX_ZOOM,
  PANE_MAX_ZOOM,
  PANE_MIN_ZOOM,
  anchorFromEditorView,
  anchorFromPaneView,
  editorViewFromAnchor,
  fitView,
  panBy,
  paneViewFromAnchor,
  zoomAbout,
} from './split-pane-view';

// docs/specs/007-editor/split-view.md "The right pane"
describe('side by side pane view', () => {
  it('fits a large drawing inside the margin, centred', () => {
    const v = fitView({ w: 600, h: 800 }, { w: 2000, h: 1000 });
    expect(v.k).toBeCloseTo((600 - PANE_FIT_MARGIN_PX * 2) / 2000);
    expect(v.x).toBeCloseTo((600 - 2000 * v.k) / 2);
    expect(v.y).toBeCloseTo((800 - 1000 * v.k) / 2);
  });

  it('never blows a small drawing up past the fit cap', () => {
    expect(fitView({ w: 1200, h: 900 }, { w: 100, h: 80 }).k).toBe(PANE_FIT_MAX_ZOOM);
  });

  it('keeps the point under the pointer still while zooming', () => {
    const v = { x: 40, y: 20, k: 1 };
    const at = { x: 300, y: 200 };
    const z = zoomAbout(v, 2, at);
    // The drawing point under `at` before and after.
    expect((at.x - v.x) / v.k).toBeCloseTo((at.x - z.x) / z.k);
    expect((at.y - v.y) / v.k).toBeCloseTo((at.y - z.y) / z.k);
  });

  it('clamps zoom to its range', () => {
    expect(zoomAbout({ x: 0, y: 0, k: 1 }, 1000, { x: 0, y: 0 }).k).toBe(PANE_MAX_ZOOM);
    expect(zoomAbout({ x: 0, y: 0, k: 1 }, 0.0001, { x: 0, y: 0 }).k).toBe(PANE_MIN_ZOOM);
  });

  it('pans by the pointer delta', () => {
    expect(panBy({ x: 1, y: 2, k: 3 }, 10, -5)).toEqual({ x: 11, y: -3, k: 3 });
  });
});

// docs/specs/007-editor/split-view.md "Moving between the panes"
describe('handing a view between a pane and the editor', () => {
  const origin = { x: -120, y: 40 };
  const body = { left: 720, top: 56 };
  const main = { left: 720, top: 56, width: 720, height: 790 };
  // Where each side draws a canvas point.
  const paneDraws = (v: { x: number; y: number; k: number }, c: { x: number; y: number }) => ({
    x: body.left + v.x + v.k * (c.x - origin.x),
    y: body.top + v.y + v.k * (c.y - origin.y),
  });
  const editorDraws = (
    v: { zoom: number; offset: { x: number; y: number } },
    c: { x: number; y: number },
  ) => ({
    x: main.left + main.width / 2 + v.zoom * (c.x + v.offset.x - main.width / 2),
    y: main.top + main.height / 2 + v.zoom * (c.y + v.offset.y - main.height / 2),
  });

  it('puts every canvas point at the same screen spot, pane to editor and back', () => {
    const pane = { x: 33, y: -12, k: 0.62 };
    const editor = editorViewFromAnchor(anchorFromPaneView(pane, body, origin), main);
    for (const c of [
      { x: 0, y: 0 },
      { x: 400, y: -250 },
      { x: -90, y: 1200 },
    ]) {
      const a = paneDraws(pane, c);
      const b = editorDraws(editor, c);
      expect(b.x).toBeCloseTo(a.x);
      expect(b.y).toBeCloseTo(a.y);
    }
    const back = paneViewFromAnchor(anchorFromEditorView(editor, main), body, origin);
    expect(back.k).toBeCloseTo(pane.k);
    expect(back.x).toBeCloseTo(pane.x);
    expect(back.y).toBeCloseTo(pane.y);
  });
});
