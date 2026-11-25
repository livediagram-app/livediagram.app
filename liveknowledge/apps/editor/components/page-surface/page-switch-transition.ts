// Switching pages (docs/specs/030-knowledgebase/page-surface.md "Switching pages"): the open page changes as a React
// View Transition typed `page-switch`, so the browser takes a picture of the page's scroll container before and
// after and animates the two (canvas-motion.css): the page in view lifts away as the next one rises into its place,
// never a blank frame between them. Only the scroll container is named for this type, so the page tree, the top
// row and the right rail are never pictures: they stay live, and the tree keeps where it was scrolled to. Under
// reduced motion no View Transition starts and the page changes at once (startTypedTransition).
import { startTypedTransition } from '@liveworkspace/workbench/lib/view-transition';

export const PAGE_SWITCH_TRANSITION = 'page-switch' as const;

/** The page scroll container's View Transition classes, by type: a page switch animates it, nothing else does. */
export const PAGE_SWITCH_VIEW_TRANSITION_UPDATE: Record<
  typeof PAGE_SWITCH_TRANSITION | 'default',
  string
> = {
  [PAGE_SWITCH_TRANSITION]: PAGE_SWITCH_TRANSITION,
  default: 'none',
};

/** Runs `change` (the open page changing) as a page switch. */
export function startPageSwitch(change: () => void): void {
  startTypedTransition(PAGE_SWITCH_TRANSITION, change);
}
