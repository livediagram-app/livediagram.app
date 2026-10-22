'use client';

import { useState } from 'react';

// True from the first render `value` is true, and true from then on: mounts a lazily loaded piece the
// first time it is wanted and keeps it mounted, so whatever it does on its way out still runs.
export function useEverTrue(value: boolean): boolean {
  const [ever, setEver] = useState(value);
  if (value && !ever) setEver(true);
  return ever || value;
}
