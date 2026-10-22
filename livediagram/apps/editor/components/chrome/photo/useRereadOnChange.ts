'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { DetectedSticky } from '@livediagram/sticky-vision';

// A box that is moved, resized or drawn is read again (docs/specs/021-event-storming/event-storming.md Phase 9).
// Corrections come in runs, so it waits until this long after the LAST
// change, then hands every changed box over in one batch.
export const REREAD_DELAY_MS = 8000;

// The rectangle a box's words were read from. Its kind is not part of it:
// re-kinding a box changes nothing under it.
const rectOf = (b: DetectedSticky) => `${b.x},${b.y},${b.w},${b.h}`;

export function useRereadOnChange(opts: {
  // The boxes as they stand now.
  boxes: DetectedSticky[];
  // The detector's boxes: what the first read read. A new detection (or a
  // reopened label) starts over from its own boxes.
  initial: DetectedSticky[];
  // A box whose words the author typed: never re-read.
  skip: (id: number) => boolean;
  onReread: (boxes: DetectedSticky[]) => void;
}): void {
  const { boxes, initial } = opts;
  // The latest options, for timers and queued jobs that outlive this render.
  const live = useRef(opts);
  useLayoutEffect(() => {
    live.current = opts;
  });
  // For each box, the rectangle its current words belong to.
  const readFrom = useRef(new Map<number, string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef('');

  useEffect(() => {
    readFrom.current = new Map(initial.map((b) => [b.id, rectOf(b)]));
    pending.current = '';
  }, [initial]);

  useEffect(() => {
    const changedNow = (list: DetectedSticky[]) =>
      list.filter((b) => readFrom.current.get(b.id) !== rectOf(b) && !live.current.skip(b.id));
    const changed = changedNow(boxes);
    const signature = changed.map((b) => `${b.id}:${rectOf(b)}`).join('|');
    // Only a change to what has changed restarts the wait: ticking a box or
    // re-kinding it re-renders, and must not hold a re-read back.
    if (signature === pending.current) return;
    pending.current = signature;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (changed.length === 0) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      pending.current = '';
      const batch = changedNow(live.current.boxes);
      if (batch.length === 0) return;
      for (const b of batch) readFrom.current.set(b.id, rectOf(b));
      live.current.onReread(batch);
    }, REREAD_DELAY_MS);
  }, [boxes]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
}
