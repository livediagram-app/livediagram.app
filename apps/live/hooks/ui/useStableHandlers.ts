'use client';

// Identity-stable wrappers for a bag of event handlers, so memoized
// children (BoxedElementView / ArrowView) stop re-rendering just
// because a parent re-render minted fresh closures. The editor's
// orchestration hook rebuilds every handler per render by design; the
// element views are React.memo'd on the premise of stable function
// props — this hook reconciles the two at the consumption boundary:
// each key gets ONE wrapper for the component's lifetime that calls
// through a ref to the latest closure (the same latest-value-in-a-ref
// convention useEditorDrag's depsRef documents).
//
// `undefined` values pass through as `undefined` (children branch on
// handler presence, e.g. read-only mode), and the returned object's
// identity only changes when that presence pattern changes.

import { useMemo, useRef } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => unknown;

export function useStableHandlers<T extends Record<string, AnyFn | undefined>>(handlers: T): T {
  const latest = useRef(handlers);
  latest.current = handlers;
  const wrappers = useRef(new Map<string, AnyFn>());
  // Key set + presence pattern; call sites pass a literal object, so
  // the keys are constant and this only varies when a handler flips
  // between defined and undefined (e.g. entering read-only).
  const presenceKey = Object.keys(handlers)
    .filter((k) => handlers[k] !== undefined)
    .join('\0');
  return useMemo(() => {
    const out: Record<string, AnyFn | undefined> = {};
    for (const key of Object.keys(latest.current)) {
      if (latest.current[key] === undefined) {
        out[key] = undefined;
        continue;
      }
      let wrapper = wrappers.current.get(key);
      if (!wrapper) {
        wrapper = (...args: unknown[]) => (latest.current[key] as AnyFn)(...args);
        wrappers.current.set(key, wrapper);
      }
      out[key] = wrapper;
    }
    return out as T;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenceKey]);
}
