// Relative-time formatting shared by the footer save indicator, the
// Explorer's "Your diagrams" list, and the Activity panel rows.
// Kept here so all three panels read identically — previously each
// surface had its own slightly different copy.
//
// Two flavours:
//   formatRelativeTime         — verbose ("2 minutes ago"), used wherever
//                                horizontal room is plentiful.
//   formatRelativeTimeShort    — compact ("2 min ago"), used inside the
//                                Activity panel rows where space is tight.

import { useSyncExternalStore } from 'react';

export function formatRelativeTime(deltaMs: number): string {
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds} secs ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} mins ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
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

export function formatRelativeTimeShort(deltaMs: number): string {
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

// Re-render every 30 seconds so any inline relative-time strings stay
// fresh. Returns a tick counter the caller doesn't need to read; just
// calling the hook is enough to subscribe to the re-render cadence.
//
// All subscribers share ONE module-level interval: the editor mounts
// up to ~8 surfaces calling this hook (Explorer panel, ActivityPanel,
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
const tickListeners = new Set<() => void>();
// `window.setInterval` returns a number in the DOM lib; we pin the
// type explicitly because TypeScript also resolves `setInterval` from
// the Node types via the build's @types/node, and falling back to
// `ReturnType<typeof setInterval>` picks up the NodeJS `Timeout` type.
let tickIntervalId: number | null = null;
let tickValue = 0;

function subscribeTick(listener: () => void): () => void {
  tickListeners.add(listener);
  if (tickIntervalId === null && typeof window !== 'undefined') {
    tickIntervalId = window.setInterval(() => {
      tickValue = (tickValue + 1) | 0;
      for (const fn of tickListeners) fn();
    }, 30_000);
  }
  return () => {
    tickListeners.delete(listener);
    if (tickListeners.size === 0 && tickIntervalId !== null) {
      window.clearInterval(tickIntervalId);
      tickIntervalId = null;
    }
  };
}

function getTickSnapshot(): number {
  return tickValue;
}

function getTickServerSnapshot(): number {
  return 0;
}

export function useRelativeTimeTick(): number {
  return useSyncExternalStore(subscribeTick, getTickSnapshot, getTickServerSnapshot);
}
