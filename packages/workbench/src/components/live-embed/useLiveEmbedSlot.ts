'use client';

// Whether a live embed may be live now (liveworkspace/docs/specs/004-index/live-embeds.md "Loading only on screen"): at
// least LIVE_EMBED_VISIBLE_RATIO of it in view for LIVE_EMBED_SETTLE_MS, then a place among the page's few
// (live-embed-slots.ts); out of view for LIVE_EMBED_UNLOAD_MS, the place goes back. `wanted` false (nothing to show,
// or an answer that needs no frame) gives it back at once.
import { useEffect, useId, useState, type RefObject } from 'react';
import { liveEmbedSlots, type LiveEmbedSlots } from './live-embed-slots';

export const LIVE_EMBED_VISIBLE_RATIO = 0.1;
export const LIVE_EMBED_SETTLE_MS = 400;
export const LIVE_EMBED_UNLOAD_MS = 2_000;

export function useLiveEmbedSlot(
  ref: RefObject<Element | null>,
  wanted: boolean,
  slots: LiveEmbedSlots = liveEmbedSlots,
): boolean {
  const key = useId();
  const [onScreen, setOnScreen] = useState(false);
  const [granted, setGranted] = useState(false);

  // On screen, settled: a fling past asks nothing, a small scroll back keeps the frame.
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let seen = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some(
          (e) => e.isIntersecting && e.intersectionRatio >= LIVE_EMBED_VISIBLE_RATIO,
        );
        if (visible === seen) return;
        seen = visible;
        if (timer) clearTimeout(timer);
        timer = setTimeout(
          () => setOnScreen(visible),
          visible ? LIVE_EMBED_SETTLE_MS : LIVE_EMBED_UNLOAD_MS,
        );
      },
      { threshold: [0, LIVE_EMBED_VISIBLE_RATIO] },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [ref]);

  const asking = wanted && onScreen;
  useEffect(() => {
    if (!asking) return;
    slots.request(key, () => setGranted(true));
    return () => {
      slots.release(key);
      setGranted(false);
    };
  }, [asking, key, slots]);

  return asking && granted;
}
