'use client';

// An object built afresh every render, kept as the same object while each of its fields is the same value
// (Object.is), so a memoised consumer sees a change only when one field changed (each editor's
// docs/specs/008-canvas/canvas-performance.md "A drop redraws what it reached"). Unlike useStableObject, its
// functions are kept as they are, so a consumer may call them in render and sees a new one as a change.

import { useState } from 'react';

export function useShallowStable<T extends object>(value: T): T {
  const [held] = useState<{ last: T | null }>(() => ({ last: null }));
  const last = held.last;
  if (last && sameFields(last, value)) return last;
  held.last = value;
  return value;
}

function sameFields(a: object, b: object): boolean {
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const keys = Object.keys(y);
  return (
    keys.length === Object.keys(x).length && keys.every((k) => k in x && Object.is(x[k], y[k]))
  );
}
