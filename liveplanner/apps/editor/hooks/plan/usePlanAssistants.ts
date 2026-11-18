'use client';

// The plan's AI assistants for the Assignee picker (docs/specs/026-plan/items.md "Who it can be handed to"; blueprint
// item-store.md "The assistant on the card"): those its cards hold, then those the plan remembers, fetched once a plan
// with a server copy loads and again when a picker opens, at most once a minute. Handed on as the same array until
// the assistants themselves change, so a card write does not re-render every picker.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  assignedPeople,
  peopleKey,
  planAssistants,
  type Item,
  type ItemAssistant,
} from '@liveplanner/items';
import { apiPlanAssistants } from '@/lib/api/plan-assistants';
import type { ItemsScope } from '@/lib/api/items';

// The least time between two reads of the remembered list (the picker opening again and again reads it once).
export const PLAN_ASSISTANTS_REFRESH_MS = 60_000;

const NONE: readonly ItemAssistant[] = [];

export function usePlanAssistants(
  items: ReadonlyMap<string, Item>,
  scope: ItemsScope | null,
  enabled: boolean,
): { assistants: readonly ItemAssistant[]; refresh: () => void } {
  const [remembered, setRemembered] = useState<{ key: string; list: readonly ItemAssistant[] }>({
    key: '',
    list: NONE,
  });
  // When the list was last asked for, by the scope it was asked for.
  const asked = useRef<{ key: string; at: number } | null>(null);
  const scopeKey = scope ? `${scope.projectId}\u0000${scope.tabId ?? ''}` : '';

  const read = useCallback(
    (force: boolean) => {
      if (!enabled || !scope) return;
      const now = Date.now();
      const last = asked.current;
      if (!force && last?.key === scopeKey && now - last.at < PLAN_ASSISTANTS_REFRESH_MS) return;
      asked.current = { key: scopeKey, at: now };
      void apiPlanAssistants(scope).then(
        (list) => setRemembered({ key: scopeKey, list }),
        (err: unknown) =>
          // A failure keeps the list it had.
          console.warn('[plan] plan.assistants.load-failed', { error: String(err) }),
      );
    },
    [enabled, scope, scopeKey],
  );

  useEffect(() => {
    read(true);
  }, [read]);

  const list = remembered.key === scopeKey ? remembered.list : NONE;
  const fresh = useMemo(
    () => planAssistants(assignedPeople([...items.values()]), list),
    [items, list],
  );
  const key = peopleKey(fresh);
  // The list last handed on, kept until the assistants change (React's "storing information from previous renders").
  const [kept, setKept] = useState({ key, assistants: fresh });
  if (kept.key !== key) setKept({ key, assistants: fresh });
  const assistants = kept.key === key ? kept.assistants : fresh;
  const refresh = useCallback(() => read(false), [read]);
  return { assistants, refresh };
}
