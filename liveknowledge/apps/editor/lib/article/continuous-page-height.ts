// How tall a continuous page must be for its writing (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The
// continuous page"): where the article engine would add a paper page, the page grows instead, and where it would
// remove one, it shrinks. Pure: the layout pass (article-measure.ts) reads the writing's foot off the screen once,
// and this turns it into the page's height.
import { PAGE_FOOT_ROOM } from '@/lib/page-surface/page-lock';

// The frame the writing sits in, as article-flow-geometry's flowFrame answers it.
type Frame = { top: number; margin: number; height: number };

/**
 * The page's height, in canvas px, from its top to the foot of its bottom margin: the top margin, the writing down
 * to `bottom` (its last line's foot, from the writing's top), the room the notes at the page's foot take, and the
 * bottom margin. `footLimit` is where the page's text must end above its footnotes (the footnote layout's limit for
 * the page), absent when it has none: the notes' room is what lies between it and the frame's foot.
 */
export function continuousHeightNeeded(
  frame: Frame,
  bottom: number,
  footLimit: number | undefined,
): number {
  const notes = footLimit === undefined ? 0 : Math.max(0, frame.height - footLimit);
  return Math.ceil(frame.top + Math.max(0, bottom) + notes + frame.margin);
}

/**
 * The room the writing's own box keeps under its last line, in canvas px (docs/specs/030-knowledgebase/page-surface.md
 * "Room under the foot"): the bottom margin and the room under the page's foot. It is the flow's `padding-bottom`, so
 * the scroll reaches that far past what this browser draws even where the stored height is shorter than the writing
 * here; where the stored height fits, the page's own room under its box (PageSurfaceSheet) ends at the same place.
 */
export function continuousFootPadding(frame: Pick<Frame, 'margin'>): number {
  return Math.max(0, frame.margin) + PAGE_FOOT_ROOM;
}
