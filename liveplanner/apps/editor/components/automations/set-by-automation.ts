'use client';

// Set by Automation (docs/specs/026-plan/automations.md "On cards"), and whether a GitHub-triggered rule made the
// card's last edit (the footer's "Edited by GitHub · rule"): the fields whose latest change in the card's
// history was a rule's. The history is read only while the card's last change was Automation's (its updatedBy), so a
// card no rule touched reads nothing more; a rule's change followed by a person's on another field keeps no chip
// until the history is read again. With the Activity tab open too, the card's history is read twice.

import { useMemo } from 'react';
import { AUTOMATION_PERSON_ID, type Item, type ItemHistoryEntry } from '@liveplanner/items';
import { useCardHistory } from '@/hooks/plan/useCardHistory';
import type { ItemsScope } from '@/lib/api/items';

/** The fields whose newest set or clear in `entries` (newest first) is tagged 'automation' (or 'automation_ai', or
 *  'automation_github'). */
export function fieldsSetByAutomation(entries: readonly ItemHistoryEntry[]): ReadonlySet<string> {
  const seen = new Set<string>();
  const out = new Set<string>();
  for (const entry of entries) {
    for (const change of entry.changes) {
      if (change.kind !== 'set' && change.kind !== 'cleared') continue;
      if (seen.has(change.field)) continue;
      seen.add(change.field);
      if (
        entry.tag === 'automation' ||
        entry.tag === 'automation_ai' ||
        entry.tag === 'automation_github'
      )
        out.add(change.field);
    }
  }
  return out;
}

/** Whether the newest entry in `entries` (newest first) is a GitHub-triggered rule's ('automation_github'): the card's
 *  last edit was GitHub's run, so its footer names GitHub (automations.md "On cards"). */
export const newestByGithub = (entries: readonly ItemHistoryEntry[]): boolean =>
  entries[0]?.tag === 'automation_github';

const NONE: ReadonlySet<string> = new Set();

export type AutomationHistory = {
  // The fields Set by Automation marks.
  setBy: ReadonlySet<string>;
  // Whether the card's last edit was a GitHub-triggered rule's.
  github: boolean;
};

const QUIET: AutomationHistory = { setBy: NONE, github: false };

/** What the card's history says of Automation's last edit, from one read made only while that edit was Automation's. */
export function useAutomationHistory(scope: ItemsScope | null, item: Item): AutomationHistory {
  const enabled = item.updatedBy.id === AUTOMATION_PERSON_ID;
  const history = useCardHistory({ scope, itemId: item.id, rev: item.rev, enabled });
  return useMemo(
    () =>
      enabled && history.status === 'ready'
        ? { setBy: fieldsSetByAutomation(history.entries), github: newestByGithub(history.entries) }
        : QUIET,
    [enabled, history.status, history.entries],
  );
}
