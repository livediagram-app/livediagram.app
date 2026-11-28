// The view Fit to Screen lands on (docs/specs/008-canvas/canvas-and-palette.md "Zoom & pan"; in 3D,
// docs/specs/008-canvas/3d-view.md "Fit frames the Space as it stands"): every boxed element on the tab in view, clear of the Palette strip over the canvas's top, over the whole canvas (nothing sits in a corner:
// docs/specs/002-project-scope/not-in-livehuddle.md "The Map"). Shared by
// the Fit button (hooks/canvas/useEditorViewport) and a double-tap's fit back out to the whole tab
// (hooks/canvas/useDoubleTapZoom), so both land on the same view.

import { isBoxed, unionBoxedBounds, type Element } from '@livehuddle/document';
import { FIT_TO_SCREEN_PADDING, topChromeInset } from '@liveworkspace/workbench/lib/viewport';
import type { ViewPose } from '@liveworkspace/workbench/lib/viewport-glide';
import { FIT_3D_NARROW_PAD, FIT_3D_NARROW_WIDTH, fit3DView } from '@/lib/space-3d/space-3d-fit';
import { space3DTilt, space3DTurn } from '@/lib/space-3d/space-3d-turn';

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
  const padding = Math.max(FIT_TO_SCREEN_PADDING, inset);
  // On a phone the strip's depth on the sides too left the Space a postage stamp in a 390 px wide canvas: the sides
  // keep only a narrow margin there (3d-view.md "Fit frames the Space as it stands").
  const side = rect.width < FIT_3D_NARROW_WIDTH ? FIT_3D_NARROW_PAD : padding;
  // The view is always 3D: framed as the tilted, turned camera shows the Space, walls and all.
  return fit3DView(
    { width: rect.width, height: rect.height },
    bbox,
    { x: side, y: padding },
    space3DTilt.get(),
    space3DTurn.get(),
  );
}
