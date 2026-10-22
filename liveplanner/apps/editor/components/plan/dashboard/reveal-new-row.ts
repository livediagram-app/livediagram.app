// Bring a Dashboard's newly added row into view (docs/specs/026-plan/plan-tabs.md "Dashboard Settings"): Add Row puts
// it at the foot, often below the fold, so once it has drawn the page scrolls it into view, smoothly (at once under
// reduced motion). Waits a few frames for the row to appear; gives up quietly if it never does.
import { prefersReducedMotion } from '@/lib/motion-preference';

const ROW_SELECTOR = '[data-dashboard-row]';
// Frames to wait for the new row to render (a commit, then React's paint).
const MAX_FRAMES = 30;

export function revealNewRow(before: number, root: ParentNode = document): void {
  let frames = 0;
  const look = () => {
    const rows = root.querySelectorAll<HTMLElement>(ROW_SELECTOR);
    if (rows.length > before) {
      rows[rows.length - 1]!.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'nearest',
      });
      return;
    }
    if (++frames < MAX_FRAMES) requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
}

export function dashboardRowCount(root: ParentNode = document): number {
  return root.querySelectorAll(ROW_SELECTOR).length;
}
