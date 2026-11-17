// How far the Toolbar layout's top strip, and a standing palette tray under it, reaches down over the canvas: the
// shared measure (workbench's lib/top-strip-inset), which a page (usePagesMode) framed on screen centres below.
import { topStripInset as sharedTopStripInset } from '@liveworkspace/workbench/lib/top-strip-inset';

/** How far the top strip and a standing tray reach down into the canvas, in screen px. `settling`: a page settling
 *  as the view rests keeps the tray's room it was framed with. */
export function topStripInset(canvas: HTMLElement, settling = false): number {
  return sharedTopStripInset(canvas, { settling });
}
