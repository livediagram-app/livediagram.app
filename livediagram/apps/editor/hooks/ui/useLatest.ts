import { useInsertionEffect, useRef, type RefObject } from 'react';

// A value read at its newest from event handlers, timers, subscriptions and effects, without writing a ref
// during render (docs/specs/003-system-architecture/react-state-and-effects.md). The ref updates in an
// insertion effect, which runs before every layout and passive effect of the commit, so a child's layout
// effect (which runs before its parent's) already sees this render's value. Read `.current` outside
// render only; a callback called from an effect is an effect event instead.
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useAssignRef(ref, value);
  return ref;
}

// The same, into a ref declared earlier: one that has to exist before the value does, to break a cycle
// between hooks (the consumer takes the ref, the value comes from a hook declared after it).
export function useAssignRef<T>(ref: RefObject<T>, value: T): void {
  useInsertionEffect(() => {
    ref.current = value;
  });
}
