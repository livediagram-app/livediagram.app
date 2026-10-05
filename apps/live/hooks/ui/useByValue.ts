'use client';

// A value that keeps its identity while it stays equal (docs/specs/008-canvas/canvas-performance.md):
// for a derived value rebuilt whenever its inputs change identity, so a memoised component it reaches
// renders only when it actually changed.

import { useState } from 'react';

class ByValue<T> {
  private last: { value: T } | null = null;
  resolve(value: T, equal: (a: T, b: T) => boolean): T {
    if (this.last && equal(this.last.value, value)) return this.last.value;
    this.last = { value };
    return value;
  }
}

export function useByValue<T>(value: T, equal: (a: T, b: T) => boolean): T {
  const [cache] = useState(() => new ByValue<T>());
  return cache.resolve(value, equal);
}
