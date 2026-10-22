// An in-memory ReadCopies for the verb suites.

import type { ReadCopies, ReadCopy } from '../copies';

export function memoryCopies(): ReadCopies & { all: Map<string, ReadCopy[]> } {
  const all = new Map<string, ReadCopy[]>();
  const key = (d: string, t: string) => `${d}|${t}`;
  return {
    all,
    latest: async (d, t) => all.get(key(d, t))?.at(-1) ?? null,
    at: async (d, t, rev) => all.get(key(d, t))?.find((c) => c.rev === rev) ?? null,
    revisions: async (d, t) => (all.get(key(d, t)) ?? []).map((c) => c.rev),
    record: async (d, t, copy) => void all.set(key(d, t), [...(all.get(key(d, t)) ?? []), copy]),
  };
}
