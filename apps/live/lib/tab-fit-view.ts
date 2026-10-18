// The view Fit to Screen lands on (docs/specs/008-canvas/canvas-and-palette.md "Zoom & pan"): every boxed element on
// the tab in view, clear of the Palette strip over the canvas's top and beside Illustrate's Contents panel. Shared by
// the Fit button (hooks/canvas/useEditorViewport) and a double-tap's fit back out to the whole tab
// (hooks/canvas/useDoubleTapZoom), so both land on the same view.

import { isBoxed, unionBoxedBounds, type Element } from '@livediagram/document';
import { sideChromeInsets } from './side-chrome-insets';
import {
  besideSideInsets,
  computeFitToScreen,
  FIT_TO_SCREEN_PADDING,
  topChromeInset,
} from './viewport';
import type { ViewPose } from './viewport-glide';

// A tab with nothing on it: back to the origin at 100%.
const EMPTY_TAB_VIEW: ViewPose = { zoom: 1, offset: { x: 0, y: 0 } };

/** Null when the canvas cannot be measured or the boxed elements have no bounds. */
export function tabFitView(canvas: HTMLElement | null, elements: Element[]): ViewPose | null {
  const box = canvas?.getBoundingClientRect();
  if (!canvas || !box) return null;
  // Plain numbers: a DOMRect's fields are prototype getters, so spreading one (computeFitBelow does) loses them
  // and the zoom comes out NaN.
  const rect = { width: box.width, height: box.height, top: box.top, bottom: box.bottom };
  const boxedIds = new Set(elements.filter(isBoxed).map((el) => el.id));
  if (boxedIds.size === 0) return EMPTY_TAB_VIEW;
  const bbox = unionBoxedBounds(elements, boxedIds);
  if (!bbox) return null;
  // Fit clear of the Palette strip laid over the canvas's top, so nothing lands under it.
  const strip = document
    .querySelector<HTMLElement>('[data-toolbar-palette]:not(.hidden) [data-tour-id="palette"]')
    ?.getBoundingClientRect();
  const inset = topChromeInset(rect, strip && strip.width > 0 ? strip : null);
  // Padded by the strip's depth on every side, not centred below it: the content stays centred (as before the
  // strip was considered) and clears both the strip and the bottom chrome of the same depth.
  // Beside Illustrate's Contents sidebar, never under it (docs/specs/007-editor/illustrate-pages.md
  // "Contents"): the fit fills what shows beside it.
  const sides = sideChromeInsets(canvas);
  return besideSideInsets(
    computeFitToScreen(
      { width: rect.width - sides.left - sides.right, height: rect.height },
      bbox,
      undefined,
      Math.max(FIT_TO_SCREEN_PADDING, inset),
    ),
    sides,
  );
}
