'use client';

// A new status joins only the card types its board takes (docs/specs/026-plan/item-types.md "The statuses a type
// uses"): when a board gains a column, a new board appears, or a board starts taking a type, the statuses it gives
// each type it takes join that type's ordered list, at the end. A status joins a type once a session (`seen`), so a
// column put back by an undo does not turn a status the type had turned off on again. What a tab held when it was
// first read, and what a type could use when it first appeared, are where things started: they never join.
//
// Types stored before the list (legacy) are written in the new shape once every tab is read: every status the
// boards name, in tab order (no tab first), less what they left out (withTypeStatuses).
//
// Both are one quiet catalogue change (useItemTypes.quietChange): no undo step, made again over anyone's later
// change. Done by someone who may change card types, as the boards that cause it are theirs to change.
import { useEffect, useRef } from 'react';
import type { Tab } from '@liveplanner/project';
import {
  boardTypeStatuses,
  planStatusOrder,
  typesOf,
  withTypeStatuses,
  type ItemTypeCatalogue,
} from '@liveplanner/items';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { boardSetupsIn } from './usePlanStatusNames';

type Remake = (stored: ItemTypeCatalogue | null) => ItemTypeCatalogue | null;

// What the session has seen: per type, every status its boards have given it; the tabs read so far; and the tabs
// the project held when it started (a tab made later counts from empty, so its boards' statuses join).
// `scanned` holds each tab's elements as last read, for the type ids `scannedFor`, so an edit re-reads only the
// tab it changed; `legacyTried` the legacy types already written (or tried), once each.
export type JoinMemory = {
  seen: Map<string, Set<string>>;
  readTabs: Set<string>;
  startTabs: Set<string> | null;
  scanned: Map<string, Tab['elements']>;
  scannedFor: string;
  legacyTried: Set<string>;
};

export const newJoinMemory = (): JoinMemory => ({
  seen: new Map(),
  readTabs: new Set(),
  startTabs: null,
  scanned: new Map(),
  scannedFor: '',
  legacyTried: new Set(),
});

// The statuses each type gains now, per type, updating `memory`. `loaded` names the tabs whose content is read.
export function statusJoinsNow(
  memory: JoinMemory,
  tabs: readonly Tab[],
  loaded: ReadonlySet<string>,
  typeIds: readonly string[],
): Map<string, string[]> {
  memory.startTabs ??= new Set(tabs.map((t) => t.id));
  const joins = new Map<string, string[]>();
  // A new set of types reads every tab again, so a type first seen starts from all it can use.
  const key = typeIds.join(',');
  if (key !== memory.scannedFor) {
    memory.scanned.clear();
    memory.scannedFor = key;
  }
  // A type first seen starts from what it can use now; only later gains join it.
  const fresh = new Set(typeIds.filter((id) => !memory.seen.has(id)));
  for (const id of fresh) memory.seen.set(id, new Set());
  for (const tab of tabs) {
    if (!loaded.has(tab.id) || memory.scanned.get(tab.id) === tab.elements) continue;
    memory.scanned.set(tab.id, tab.elements);
    const firstRead = !memory.readTabs.has(tab.id);
    memory.readTabs.add(tab.id);
    // A tab the project started with, read for the first time, is where things were.
    const seeding = firstRead && memory.startTabs.has(tab.id);
    for (const [id, statuses] of boardTypeStatuses(boardSetupsIn(tab.elements), typeIds, true)) {
      const seen = memory.seen.get(id)!;
      for (const s of statuses) {
        if (seen.has(s)) continue;
        seen.add(s);
        if (seeding || fresh.has(id)) continue;
        joins.set(id, [...(joins.get(id) ?? []), s]);
      }
    }
  }
  return joins;
}

export function useTypeStatusJoins(opts: {
  tabs: readonly Tab[];
  loadedTabIds: ReadonlySet<string>;
  // Someone who may change card types, with the project's types read.
  enabled: boolean;
  catalogue: ItemTypeCatalogue | null;
  quietChange: (remake: Remake) => void;
}): void {
  const { tabs, loadedTabIds, enabled, catalogue } = opts;
  const latest = useLatest(opts);
  const memory = useRef<JoinMemory>(newJoinMemory());
  const typeIds = typesOf(catalogue).map((t) => t.id);
  const typeKey = typeIds.join(',');
  useEffect(() => {
    if (!enabled || !catalogue) return;
    const m = memory.current;
    const joins = statusJoinsNow(m, tabs, loadedTabIds, typeIds);
    // Legacy types are written once every tab is read, so no status is lost; each is tried once a session.
    const allRead = tabs.every((t) => loadedTabIds.has(t.id));
    const untried = allRead
      ? typesOf(catalogue).filter((t) => !t.statuses && !m.legacyTried.has(t.id))
      : [];
    for (const t of untried) m.legacyTried.add(t.id);
    const legacy = untried.length > 0;
    if (joins.size === 0 && !legacy) return;
    const planStatuses = legacy
      ? planStatusOrder(tabs.flatMap((t) => boardSetupsIn(t.elements)))
      : undefined;
    debugLog('[item-types] statuses.joined', { types: joins.size, legacy });
    latest.current.quietChange((stored) =>
      withTypeStatuses(stored, { joins, ...(planStatuses ? { planStatuses } : {}) }),
    );
    // The catalogue is read through typeKey and the legacy check; a change to a type's statuses alone never joins.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [tabs, loadedTabIds, enabled, typeKey, catalogue === null]);
}
