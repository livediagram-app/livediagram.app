// The clock relative-time strings read: the instant of the latest shared tick, every 30 seconds
// (docs/specs/003-system-architecture/react-state-and-effects.md in each product). Render never reads Date.now(); it
// reads this, so every row on a page agrees and refreshes on the same tick. One copy for every editor (each product's
// lib/relative-time.ts re-exports it), so the editors' own rows and the shared surfaces (a linked chart's "updated
// 2 min ago", components/sheet-links/) tick together.
//
// All subscribers share ONE module-level interval: an editor mounts many surfaces calling this hook (the Explorer
// panel, every participant avatar, the Explorer's views), and per-hook intervals fired at slightly different offsets,
// so rows refreshed in a stagger over a 30 s window instead of together. One timer, and every subscriber re-renders on
// the same tick.
//
// `useSyncExternalStore` is the matching React primitive: it handles prerendering (`getServerSnapshot` returns 0, so
// the prerendered HTML and the first client render agree) and lets every consumer subscribe and unsubscribe without
// each hook owning its own state.
import { useSyncExternalStore } from 'react';

export const RELATIVE_TICK_MS = 30_000;

const tickListeners = new Set<() => void>();
// `window.setInterval` returns a number in the DOM lib; pinned because @types/node would otherwise resolve
// `setInterval` to NodeJS's `Timeout`.
let tickIntervalId: number | null = null;
let tickNow = Date.now();

function subscribeTick(listener: () => void): () => void {
  tickListeners.add(listener);
  // Only a client subscribes (a prerender reads the server snapshot), so `window` is there.
  if (tickIntervalId === null) {
    // Idle since the last subscriber left (or never started): catch the clock up before ticking again.
    // The new subscriber is the only listener, and useSyncExternalStore re-reads after subscribing.
    tickNow = Date.now();
    tickIntervalId = window.setInterval(() => {
      tickNow = Date.now();
      for (const fn of tickListeners) fn();
    }, RELATIVE_TICK_MS);
  }
  return () => {
    tickListeners.delete(listener);
    if (tickListeners.size === 0 && tickIntervalId !== null) {
      window.clearInterval(tickIntervalId);
      tickIntervalId = null;
    }
  };
}

const getTickSnapshot = () => tickNow;
// Prerendered HTML carries no relative times (they render from data loaded on the client), so the server snapshot
// only has to be stable.
const getTickServerSnapshot = () => 0;

export function useRelativeNow(): number {
  return useSyncExternalStore(subscribeTick, getTickSnapshot, getTickServerSnapshot);
}
