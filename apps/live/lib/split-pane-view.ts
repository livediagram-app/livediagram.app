// The side by side pane's own pan and zoom (docs/specs/007-editor/split-view.md "The right pane"):
// a translate (x, y) in pane pixels and a scale k, applied to the tab's drawing. Pure, so the
// fitting and the pointer-anchored zoom are tested without a DOM.

export type PaneView = { x: number; y: number; k: number };

// The zoom range: from a whole sprawling board down to a readable sticky.
export const PANE_MIN_ZOOM = 0.05;
export const PANE_MAX_ZOOM = 4;
// A small drawing is not blown up past this when fitted: a lone sticky at 400% reads as a bug.
export const PANE_FIT_MAX_ZOOM = 1.25;
// The breathing room around a fitted drawing, in pane pixels.
export const PANE_FIT_MARGIN_PX = 32;

export function clampZoom(k: number): number {
  return Math.min(PANE_MAX_ZOOM, Math.max(PANE_MIN_ZOOM, k));
}

// The view that shows all of `content` centred in `box`.
export function fitView(
  box: { w: number; h: number },
  content: { w: number; h: number },
): PaneView {
  const availW = Math.max(1, box.w - PANE_FIT_MARGIN_PX * 2);
  const availH = Math.max(1, box.h - PANE_FIT_MARGIN_PX * 2);
  const k = clampZoom(
    Math.min(PANE_FIT_MAX_ZOOM, availW / Math.max(1, content.w), availH / Math.max(1, content.h)),
  );
  return { k, x: (box.w - content.w * k) / 2, y: (box.h - content.h * k) / 2 };
}

export function panBy(view: PaneView, dx: number, dy: number): PaneView {
  return { ...view, x: view.x + dx, y: view.y + dy };
}

// Zoom by `factor`, keeping the drawing point under `at` (pane pixels) where it is.
export function zoomAbout(view: PaneView, factor: number, at: { x: number; y: number }): PaneView {
  const k = clampZoom(view.k * factor);
  const ratio = k / view.k;
  return { k, x: at.x - (at.x - view.x) * ratio, y: at.y - (at.y - view.y) * ratio };
}

// Handing a view between a pane and the editor (docs/specs/007-editor/split-view.md "Moving between
// the panes"), so the drawing holds still when the editor moves in or out. The common currency is
// an anchor: the zoom, and where on screen (client px) the canvas origin sits.
//
// The pane draws canvas point c at `body.left + view.x + k (c - origin.x)`, origin being where the
// tab's SVG starts in canvas space. The editor draws it at `main.left + W/2 + z (c + offset.x - W/2)`
// (its `scale(z) translate(offset)` is centred on the canvas element, lib/viewport.ts).
export type CanvasAnchor = { k: number; x0: number; y0: number };
export type ScreenBox = { left: number; top: number; width: number; height: number };
export type EditorView = { zoom: number; offset: { x: number; y: number } };

export function anchorFromPaneView(
  view: PaneView,
  body: Pick<ScreenBox, 'left' | 'top'>,
  origin: { x: number; y: number },
): CanvasAnchor {
  return {
    k: view.k,
    x0: body.left + view.x - view.k * origin.x,
    y0: body.top + view.y - view.k * origin.y,
  };
}

export function paneViewFromAnchor(
  anchor: CanvasAnchor,
  body: Pick<ScreenBox, 'left' | 'top'>,
  origin: { x: number; y: number },
): PaneView {
  return {
    k: anchor.k,
    x: anchor.x0 - body.left + anchor.k * origin.x,
    y: anchor.y0 - body.top + anchor.k * origin.y,
  };
}

export function anchorFromEditorView(view: EditorView, main: ScreenBox): CanvasAnchor {
  const z = view.zoom;
  return {
    k: z,
    x0: main.left + main.width / 2 + z * (view.offset.x - main.width / 2),
    y0: main.top + main.height / 2 + z * (view.offset.y - main.height / 2),
  };
}

export function editorViewFromAnchor(anchor: CanvasAnchor, main: ScreenBox): EditorView {
  const k = anchor.k;
  return {
    zoom: k,
    offset: {
      x: (anchor.x0 - main.left - main.width / 2) / k + main.width / 2,
      y: (anchor.y0 - main.top - main.height / 2) / k + main.height / 2,
    },
  };
}
