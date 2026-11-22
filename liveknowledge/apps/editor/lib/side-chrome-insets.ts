// How far the side chrome reaches in over the canvas from its left and right edges (the page tree,
// docs/specs/030-knowledgebase/blueprints/page-tree.md; the page rail, blueprints/knowledge-ui.md): a page
// framed on screen, and Zoom to Fit, centre in what shows between them rather than under either.
import {
  CONTENTS_SIDEBAR_SELECTOR,
  NO_SIDE_INSETS,
  restingRect,
  sideInsetsOf,
  type SideInsets,
} from '@liveworkspace/workbench/lib/contents-sidebar';

/** What stands down the canvas's right: the knowledgebase's page rail (components/knowledge/PageRail.tsx). */
const PAGE_RAIL_SELECTOR = '[data-page-rail="docked"]';

/** The screen px the side chrome covers at the canvas's left and right (the page tree down the left, the page
 *  rail down the right); none for a panel that is absent, outside the canvas, or too short to be in the way (a
 *  fifth of the canvas's height). */
export function sideChromeInsets(canvas: HTMLElement): SideInsets {
  const panels = document.querySelectorAll<HTMLElement>(
    `${CONTENTS_SIDEBAR_SELECTOR}, ${PAGE_RAIL_SELECTOR}`,
  );
  if (panels.length === 0) return NO_SIDE_INSETS;
  const box = canvas.getBoundingClientRect();
  let left = 0;
  let right = 0;
  for (const panel of panels) {
    const insets = sideInsetsOf(box, restingRect(panel));
    left = Math.max(left, insets.left);
    right = Math.max(right, insets.right);
  }
  return left === 0 && right === 0 ? NO_SIDE_INSETS : { left, right };
}
