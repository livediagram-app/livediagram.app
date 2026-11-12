import { useEffect, useState } from 'react';
import type { LiveEditor } from '../../lib/live-editor-build';
import { workbench } from '../../bindings';
import { useLatest } from './useLatest';

// Waits, while `active`, until a reload would bring a newer editor (docs/specs/016-platform/new-version-prompt.md
// "When the prompt shows", in each product): checks at once, then once a minute while the page is
// visible, and settles true on a different or unknown build, or after LIVE_BUILD_MAX_CHECKS checks so the
// prompt never vanishes for good. Once true it stays true for the page's life.

/** How often it asks again while the page still serves this editor. */
export const LIVE_BUILD_POLL_MS = 60_000;
/** How many checks before it stops waiting (half an hour at one a minute; a deploy window ran 13 minutes). */
export const LIVE_BUILD_MAX_CHECKS = 30;

export function useNewerEditorLive(active: boolean, check: () => Promise<LiveEditor>): boolean {
  const [ready, setReady] = useState(false);
  const latestCheck = useLatest(check);

  useEffect(() => {
    if (!active || ready) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let checks = 0;
    let lastAt = 0;
    const hidden = () => document.visibilityState === 'hidden';
    const schedule = (ms: number) => {
      if (!hidden()) timer = setTimeout(run, ms);
    };
    function run() {
      timer = undefined;
      inFlight = true;
      checks += 1;
      lastAt = Date.now();
      void latestCheck.current().then((live) => {
        inFlight = false;
        if (cancelled) return;
        if (live !== 'same') {
          setReady(true);
        } else if (checks >= LIVE_BUILD_MAX_CHECKS) {
          console.warn(
            `[${workbench.formatLogScope}] the page still serves this editor; offering the reload anyway`,
            {
              checks,
            },
          );
          setReady(true);
        } else {
          schedule(LIVE_BUILD_POLL_MS);
        }
      });
    }
    // Hidden, the minute stops; back in view, it resumes from the last check (at once if a minute has passed).
    const onVisibility = () => {
      if (hidden()) {
        clearTimeout(timer);
        timer = undefined;
      } else if (!inFlight && timer === undefined) {
        schedule(Math.max(0, lastAt + LIVE_BUILD_POLL_MS - Date.now()));
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    run();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active, ready, latestCheck]);

  return ready;
}
