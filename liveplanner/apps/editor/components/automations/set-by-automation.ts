'use client';

// Set by Automation (docs/specs/026-plan/automations.md "On cards"): the fields whose latest change in the card's
// history was a rule's. The history is read only while the card's last change was Automation's (its updatedBy), so a
// card no rule touched reads nothing more; a rule's change followed by a person's on another field keeps no chip
// until the history is read again. With the Activity tab open too, the card's history is read twice.

import { useMemo } from 'react';
import { AUTOMATION_PERSON_ID, type Item, type ItemHistoryEntry } from '@liveplanner/items';
import { useCardHistory } from '@/hooks/plan/useCardHistory';
import type { ItemsScope } from '@/lib/api/items';

/** The fields whose newest set or clear in `entries` (newest first) is tagged 'automation'. */
export function fieldsSetByAutomation(entries: readonly ItemHistoryEntry[]): ReadonlySet<string> {
  const seen = new Set<string>();
  const out = new Set<string>();
  for (const entry of entries) {
    for (const change of entry.changes) {
      if (change.kind !== 'set' && change.kind !== 'cleared') continue;
      if (seen.has(change.field)) continue;
      seen.add(change.field);
      if (entry.tag === 'automation') out.add(change.field);
    }
  }
  return out;
}

const NONE: ReadonlySet<string> = new Set();

export function useSetByAutomation(scope: ItemsScope | null, item: Item): ReadonlySet<string> {
  const enabled = item.updatedBy.id === AUTOMATION_PERSON_ID;
  const history = useCardHistory({ scope, itemId: item.id, rev: item.rev, enabled });
  return useMemo(
    () => (enabled && history.status === 'ready' ? fieldsSetByAutomation(history.entries) : NONE),
    [enabled, history.status, history.entries],
  );
}
