// Relative-time formatting shared by the footer save indicator, the
// Explorer's "Your documents" list, and the Explorer's Activity page rows.
// Kept here so every surface reads identically — previously each
// surface had its own slightly different copy.
//
// Four formatters, coarsening as the space they have to fit shrinks:
//   formatRelativeTime         — verbose ("2 mins ago"), reached through
//                                relativeSince by every list row.
//   formatRelativeTimeShort    — compact ("2 min ago"), Activity page rows.
//   formatRelativeTimeCompact  — ultra-compact ("2m ago"), comment threads.
//   formatTimeLeftCompact      — the forward-looking countdown ("6d left")
//                                for expiring share links (docs/specs/013-workspace/share-link-expiry.md).
// The first two share their ladder, in @livediagram/ui (relative-time.ts).

import { useSyncExternalStore } from 'react';

// The verbose and short ladders (and relativeSince) live in @livediagram/ui, so the landing page's
// Welcome back tiles (docs/specs/019-marketing/returning-visitor.md) read exactly as the app's rows do.
export { formatRelativeTime, formatRelativeTimeShort, relativeSince } from '@livediagram/ui';

// Forward-looking compact countdown ("6d left" / "3h left"), used by
// the Share dialog's expiring-link rows (docs/specs/013-workspace/share-link-expiry.md). Zero or negative
// deltas read as 'expired' so a row that lapses while the dialog is
// open degrades to the truth without a refetch.
export function formatTimeLeftCompact(deltaMs: number): string {
  if (deltaMs <= 0) return 'expired';
  const minutes = Math.ceil(deltaMs / 60_000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.ceil(hours / 24);
  return `${days}d left`;
}

// Ultra-compact ("2m ago" / "3h ago" / "5d ago"), used in the comment
// thread where each row is tiny. Coarser than the others on purpose: no
// seconds and no "yesterday", since comment timestamps are usually
// minutes-to-days old and the row has no room to spare.
export function formatRelativeTimeCompact(deltaMs: number): string {
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// The clock relative-time strings read: the instant of the latest shared tick, every 30 seconds
// (docs/specs/003-system-architecture/react-state-and-effects.md). Render never reads Date.now(); it
// reads this, so every row on a page agrees and refreshes on the same tick.
//
// All subscribers share ONE module-level interval: the editor mounts
// up to ~8 surfaces calling this hook (Explorer panel,
// every ParticipantAvatar, the explorer route's three views), and the
// prior per-hook setInterval spun up 8 timers that fired at slightly
// different offsets, so rows refreshed in a stagger over a 30s window
// instead of together. Centralising means one timer + all subscribers
// re-render on the same tick, which is the natural visual behaviour
// and uses one timer instead of N.
//
// `useSyncExternalStore` is the matching React primitive: it handles
// SSR (`getServerSnapshot` returns 0 deterministically so the SSR
// HTML and the first client render agree) and lets every consumer
// subscribe + unsubscribe without each hook owning its own state.
export const RELATIVE_TICK_MS = 30_000;

const tickListeners = new Set<() => void>();
// `window.setInterval` returns a number in the DOM lib; pinned because the build's @types/node would
// otherwise resolve `setInterval` to NodeJS's `Timeout`.
let tickIntervalId: number | null = null;
let tickNow = Date.now();

function subscribeTick(listener: () => void): () => void {
  tickListeners.add(listener);
  if (tickIntervalId === null && typeof window !== 'undefined') {
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
// Prerendered HTML carries no relative times (they render from data loaded on the client), so the
// server snapshot only has to be stable.
const getTickServerSnapshot = () => 0;

export function useRelativeNow(): number {
  return useSyncExternalStore(subscribeTick, getTickSnapshot, getTickServerSnapshot);
}
