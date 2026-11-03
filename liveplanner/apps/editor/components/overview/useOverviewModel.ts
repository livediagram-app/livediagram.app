import { useMemo } from 'react';
import type { Item, ItemTypeDef } from '@liveplanner/items';
import type { Tab } from '@liveplanner/project';
import type { Participant } from '@/lib/identity';
import { overviewModelOf, type OverviewModel } from './overview-model';
import type { PlanPerson } from './overview-people';

// The Overview's model, derived once per change of what it reads (docs/specs/026-plan/plan-overview.md
// "Performance"). Presence changes often (a cursor moving tabs), so it enters through a key of who is here, not the
// map, and a move between tabs derives nothing again.
export function useOverviewModel(input: {
  tabs: readonly Tab[];
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  statusNames: ReadonlyMap<string, string>;
  loadedTabIds: ReadonlySet<string>;
  owner: PlanPerson | null;
  participantsByTab: ReadonlyMap<string, readonly Participant[]>;
  createdAt: number;
}): OverviewModel {
  const { tabs, items, types, statusNames, loadedTabIds, owner, participantsByTab, createdAt } =
    input;
  const presentKey = useMemo(() => {
    const seen = new Map<string, PlanPerson>();
    for (const list of participantsByTab.values())
      for (const p of list)
        if (!seen.has(p.id)) seen.set(p.id, { id: p.id, name: p.name, color: p.color });
    return JSON.stringify([...seen.values()].sort((a, b) => (a.id < b.id ? -1 : 1)));
  }, [participantsByTab]);
  const ownerId = owner?.id ?? null;
  const ownerName = owner?.name ?? null;
  const ownerColor = owner?.color ?? null;
  return useMemo(
    () =>
      overviewModelOf({
        tabs,
        items,
        types,
        statusNames,
        loadedTabIds,
        owner:
          ownerId && ownerName
            ? { id: ownerId, name: ownerName, color: ownerColor ?? '#64748b' }
            : null,
        present: JSON.parse(presentKey) as PlanPerson[],
        createdAt,
      }),
    [
      tabs,
      items,
      types,
      statusNames,
      loadedTabIds,
      ownerId,
      ownerName,
      ownerColor,
      presentKey,
      createdAt,
    ],
  );
}
