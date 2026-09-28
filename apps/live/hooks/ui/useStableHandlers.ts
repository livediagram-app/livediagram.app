'use client';

// Identity-stable wrappers for a bag of event handlers, so memoized
// children (BoxedElementView / ArrowView) stop re-rendering just
// because a parent re-render minted fresh closures. The editor's
// orchestration hook rebuilds every handler per render by design; the
// element views are React.memo'd on the premise of stable function
// props — this hook reconciles the two at the consumption boundary:
// each key gets ONE wrapper for the component's lifetime that calls
// through useLatest to the newest closure.
//
// `undefined` values pass through as `undefined` (children branch on
// handler presence, e.g. read-only mode), and the returned object's
// identity only changes when that presence pattern changes. Call sites
// pass a literal object, so the key set is constant for the lifetime.

import { useMemo, useState } from 'react';
import { useLatest } from './useLatest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => unknown;

export function useStableHandlers<T extends Record<string, AnyFn | undefined>>(handlers: T): T {
  const latest = useLatest(handlers);
  const [wrappers] = useState(() =>
    Object.fromEntries(
      Object.keys(handlers).map((key) => [
        key,
        (...args: unknown[]) => (latest.current[key] as AnyFn)(...args),
      ]),
    ),
  );
  // Presence pattern: only varies when a handler flips between defined and
  // undefined (e.g. entering read-only).
  const presenceKey = Object.keys(handlers)
    .filter((k) => handlers[k] !== undefined)
    .join('\0');
  return useMemo(() => {
    const present = new Set(presenceKey === '' ? [] : presenceKey.split('\0'));
    const out: Record<string, AnyFn | undefined> = {};
    for (const key of Object.keys(wrappers))
      out[key] = present.has(key) ? wrappers[key] : undefined;
    return out as T;
  }, [presenceKey, wrappers]);
}
