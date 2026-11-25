// The stored height after writing done in the narrow view (docs/specs/030-knowledgebase/blueprints/continuous-page.md
// "Who settles it, and when"): the narrow view's own measure is never stored, so once this person's typing there
// pauses, the page's stored height becomes the estimator's at full width (withFullWidthHeightEstimated), folded into
// the change it follows. Its PDF and thumbnail then follow writing done on a phone or a mid-size window, until a
// full-width layout settles the measured height.
import { useCallback, useEffect, useRef } from 'react';
import type { Tab } from '@liveknowledge/document';
import { articleLocked } from '@/lib/article/article-lock';
import { withFullWidthHeightEstimated } from '@/lib/page-surface/page-view-lens';

/** How long the writing rests before the estimate is written: one estimate per pause, never one per keystroke. */
export const NARROW_ESTIMATE_DELAY_MS = 800;

/** The tabs with `tabId`'s narrow lens asking for its full-width estimated height; the same array when nothing
 *  changes (no lens, locked, or the height is already that). */
export function withNarrowHeightEstimated(ts: Tab[], tabId: string, flow: string): Tab[] {
  const out = ts.map((t) =>
    t.id === tabId && t.locked !== true && !articleLocked(t, flow)
      ? withFullWidthHeightEstimated(t)
      : t,
  );
  return out.every((t, i) => t === ts[i]) ? ts : out;
}

/** A schedule for the estimate: each call restarts the wait, and the wait ends with the tab or the window. */
export function useNarrowHeightEstimate(
  tabId: string,
  tickTabs: (map: (ts: Tab[]) => Tab[]) => void,
): (flow: string) => void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tick = useRef(tickTabs);
  useEffect(() => {
    tick.current = tickTabs;
  });
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    },
    [tabId],
  );
  return useCallback(
    (flow: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        tick.current((ts) => withNarrowHeightEstimated(ts, tabId, flow));
      }, NARROW_ESTIMATE_DELAY_MS);
    },
    [tabId],
  );
}
