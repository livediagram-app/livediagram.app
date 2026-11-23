'use client';

import { useCallback, useState } from 'react';

/** The ids with work under way (a rule mid take-over or mid toggle), and a wrapper that marks one for as long as its
 *  work runs, whether it settles or throws. */
export function useBusyIds(): readonly [
  ReadonlySet<string>,
  (id: string, work: () => Promise<unknown>) => Promise<void>,
] {
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const withBusy = useCallback(async (id: string, work: () => Promise<unknown>) => {
    setBusy((s) => new Set(s).add(id));
    try {
      await work();
    } finally {
      setBusy((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }, []);
  return [busy, withBusy] as const;
}
