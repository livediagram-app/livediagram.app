// Debounced `Canvas·Changed` telemetry for the tab's appearance sliders
// (docs/specs/017-telemetry/telemetry.md Canvas: BackgroundColor / BackgroundOpacity / PatternColor and the
// other slider-driven background settings).
//
// A slider drag emits one event, ~800ms after the last tick, rather than one
// per tick. The catch with a trailing debounce is the tail: a user who drags
// the background colour and then closes the tab or leaves the diagram within
// the window never sent it, and the pending timer simply died with the page.
// So pending emits are flushed on unmount and on page hide, the latter through
// the shared `onPageHide`, which runs ahead of the engine's own final flush so
// the event is in the batch that flush sends.

import { useEffect, useRef } from 'react';
import { onPageHide } from '@livediagram/telemetry-client';
import { track } from '@/lib/telemetry';

// Slider-edit debounce window. docs/specs/017-telemetry/telemetry.md's noise rule excludes "raw colour
// tweaks", and emitting on every slider tick would absolutely qualify;
// debouncing at ~800ms means one user dragging a slider end-to-end produces
// one event instead of dozens, while still capturing "did they actually
// change the canvas appearance" as a discrete signal. Matches the
// activity-log debounce in spirit (`scheduleTabMetaLog`).
export const CANVAS_TELEMETRY_DEBOUNCE_MS = 800;

type Pending = { timer: ReturnType<typeof setTimeout>; type: string };

/**
 * Returns `schedule(key, type)`: (re)start the debounce for one setter. Keyed
 * so a colour drag and an opacity drag debounce independently and one never
 * cancels the other.
 */
export function useDebouncedCanvasTelemetry(): (key: string, type: string) => void {
  // A ref, not state: scheduling mustn't re-render.
  const pendingRef = useRef<Map<string, Pending>>(new Map());

  useEffect(() => {
    const pending = pendingRef.current;
    const flushAll = () => {
      for (const { timer, type } of pending.values()) {
        clearTimeout(timer);
        track('Canvas', 'Changed', type);
      }
      pending.clear();
    };
    const off = onPageHide(flushAll);
    return () => {
      off();
      flushAll();
    };
  }, []);

  return (key, type) => {
    const pending = pendingRef.current;
    const existing = pending.get(key);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      pending.delete(key);
      track('Canvas', 'Changed', type);
    }, CANVAS_TELEMETRY_DEBOUNCE_MS);
    pending.set(key, { timer, type });
  };
}
