// How many live embeds may be live at once in a page (liveworkspace/docs/specs/004-index/live-embeds.md "Loading only
// on screen"): a frame is a whole app, so at most LIVE_EMBEDS_MAX hold a place; the rest wait, in the order they came
// on screen, and take one as it is given up. Pure bookkeeping: each embed asks with a callback the manager calls once
// when it is let in.

export const LIVE_EMBEDS_MAX = 3;

export type LiveEmbedSlots = {
  /** Ask for a place: `onGranted` runs now if one is free, else when one frees up. Asking twice is one ask. */
  request: (key: string, onGranted: () => void) => void;
  /** Give the place up, or stop waiting for one. */
  release: (key: string) => void;
  /** For tests and the face: how many are live, and how many wait. */
  counts: () => { live: number; waiting: number };
};

export function createLiveEmbedSlots(max = LIVE_EMBEDS_MAX): LiveEmbedSlots {
  const live = new Set<string>();
  // Insertion order is arrival order.
  const waiting = new Map<string, () => void>();
  const admit = () => {
    for (const [key, granted] of waiting) {
      if (live.size >= max) return;
      waiting.delete(key);
      live.add(key);
      granted();
    }
  };
  return {
    request(key, onGranted) {
      if (live.has(key) || waiting.has(key)) return;
      waiting.set(key, onGranted);
      admit();
    },
    release(key) {
      waiting.delete(key);
      if (live.delete(key)) admit();
    },
    counts: () => ({ live: live.size, waiting: waiting.size }),
  };
}

/** The page's one manager: every live embed in the page shares it. */
export const liveEmbedSlots: LiveEmbedSlots = createLiveEmbedSlots();
