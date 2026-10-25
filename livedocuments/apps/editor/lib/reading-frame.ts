// The reading frame (docs/specs/007-editor/article-pages.md "Getting around"): livedocuments' own view
// on top of the shared viewport maths (@liveworkspace/workbench/lib/viewport.ts).
import type { Rect } from '@livedocuments/document';
import type { Offset, ViewportSize } from '@liveworkspace/workbench/lib/viewport';

// Screen px left clear above an article page for its page toolbar and title bar, and either side.
export const READING_TOP_ROOM = 104;
const READING_SIDE_ROOM = 32;

/**
 * The view that reads an article page (docs/specs/007-editor/article-pages.md "Getting around"):
 * its width filling the canvas (never past 100%), room above it for the page toolbar; a page that
 * fits sits in the middle of the room below, a taller one shows its top.
 */
export function computeReadingFrame(
  rect: ViewportSize,
  page: Rect,
  insetTop: number,
  // The page's side margin: given, the text column (the page less its margins) fills the width,
  // the margins off screen, so the text reads larger on a narrow screen.
  margin = 0,
): { zoom: number; offset: Offset } {
  const top = Math.min(rect.height / 2, insetTop + READING_TOP_ROOM);
  const zoom = Math.max(
    0.1,
    Math.min(1, (rect.width - 2 * READING_SIDE_ROOM) / Math.max(1, page.width - 2 * margin)),
  );
  const room = rect.height - top - 16;
  const screenTop = page.height * zoom <= room ? top + (room - page.height * zoom) / 2 : top;
  return {
    zoom,
    offset: {
      x: rect.width / 2 - (page.x + page.width / 2),
      y: (screenTop - rect.height / 2) / zoom + rect.height / 2 - page.y,
    },
  };
}
