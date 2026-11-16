// The skipped-keys summary (docs/specs/020-import-export/infrastructure-import.md "What is skipped"): each key once,
// with how often it appeared when more than once, in one line.

import type { InfraSkipped } from './types';

// How many keys the line names before it only counts the rest.
const SUMMARY_MAX_KEYS = 12;

/** `vars, observability (2), services.*.develop (3)`; past twelve keys, `and N more`. Empty for none. */
export function skippedLine(skipped: readonly InfraSkipped[]): string {
  const named = skipped
    .slice(0, SUMMARY_MAX_KEYS)
    .map(({ key, count }) => (count > 1 ? `${key} (${count})` : key));
  const rest = skipped.length - SUMMARY_MAX_KEYS;
  return rest > 0 ? `${named.join(', ')} and ${rest} more` : named.join(', ');
}

/** Skipped keys from several files, counts added, in first-seen order. */
export function mergeSkipped(lists: readonly (readonly InfraSkipped[])[]): InfraSkipped[] {
  const counts = new Map<string, number>();
  for (const list of lists)
    for (const { key, count } of list) counts.set(key, (counts.get(key) ?? 0) + count);
  return [...counts].map(([key, count]) => ({ key, count }));
}
