import { useLayoutEffect, useRef, type RefObject } from 'react';

// A value read at its newest from event handlers, timers and subscriptions, without writing a ref during
// render (docs/specs/003-system-architecture/react-state-and-effects.md). The ref updates after each
// commit, in a layout effect, so anything that runs after render sees this render's value. Read
// `.current` outside render only; a callback called from an effect is an effect event instead.
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
