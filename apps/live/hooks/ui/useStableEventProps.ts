'use client';

// The canvas boundary's event props (docs/specs/008-canvas/canvas-performance.md "The canvas
// re-renders only for what it shows"): the editor rebuilds its handlers on every render, so each
// `on…` function prop is handed on as one forwarder per key, calling the newest handler. A memoised
// component below then re-renders only when its data changed. Functions not named `on…` are read in
// render and pass through untouched; an absent handler stays absent, since children branch on it.

import { useState } from 'react';
import { useLatest } from './useLatest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => unknown;

const EVENT_PROP = /^on[A-Z]/;

export function useStableEventProps<T extends object>(props: T): T {
  const latest = useLatest(props as Record<string, unknown>);
  // One forwarder per key for the hook's lifetime, created the first time the key holds a handler.
  const [forwarders] = useState(() => new Map<string, AnyFn>());
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!EVENT_PROP.test(key) || typeof value !== 'function') {
      out[key] = value;
      continue;
    }
    let forwarder = forwarders.get(key);
    if (!forwarder) {
      forwarder = (...args: unknown[]) => (latest.current[key] as AnyFn | undefined)?.(...args);
      forwarders.set(key, forwarder);
    }
    out[key] = forwarder;
  }
  return out as T;
}
