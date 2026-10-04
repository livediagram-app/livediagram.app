'use client';

// An object prop the editor rebuilds on every render, data and actions together (the slide deck,
// the event-storming controls), made identity-stable for a memoised consumer
// (docs/specs/008-canvas/canvas-performance.md "The canvas re-renders only for what it shows"): each
// function becomes one forwarder per key calling the newest, and the object's identity changes only
// when a data field changes or a field comes or goes. Its functions are actions, never read in render.

import { useState } from 'react';
import { useLatest } from './useLatest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => unknown;

// The hook's render-time memo: the forwarders it has handed out and the object it returned last.
class StableObjectCache {
  private readonly forwarders = new Map<string, AnyFn>();
  private last: Record<string, unknown> | null = null;

  resolve(value: object, latest: { current: Record<string, unknown> }): Record<string, unknown> {
    const next: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(value)) {
      if (typeof field !== 'function') {
        next[key] = field;
        continue;
      }
      let forwarder = this.forwarders.get(key);
      if (!forwarder) {
        forwarder = (...args: unknown[]) => (latest.current[key] as AnyFn | undefined)?.(...args);
        this.forwarders.set(key, forwarder);
      }
      next[key] = forwarder;
    }
    if (this.last && sameFields(this.last, next)) return this.last;
    this.last = next;
    return next;
  }
}

export function useStableObject<T extends object>(value: T): T {
  const latest = useLatest(value as Record<string, unknown>);
  const [cache] = useState(() => new StableObjectCache());
  return cache.resolve(value, latest) as T;
}

function sameFields(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = Object.keys(b);
  if (keys.length !== Object.keys(a).length) return false;
  return keys.every((key) => key in a && Object.is(a[key], b[key]));
}
