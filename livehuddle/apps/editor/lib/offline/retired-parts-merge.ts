// Writing the answer's `keep` tabs back into a document in This Browser (docs/specs/006-document/offline-mode.md
// "Moving retired parts to the other apps", "Writing `keep` back"), without undoing anything done since the
// set-aside. Pure.

import { migrateStoredTab, stampTabKind, type Tab } from '@livehuddle/document';
import type { OfflineDocumentRecord } from './offline-store';
import type { RetiredPartsRecord } from './retired-parts';
import { RETIRED_RECORD_FIELDS } from './retired-parts-upgrade';

function tabId(tab: unknown): string | null {
  const id = (tab as { id?: unknown } | null)?.id;
  return typeof id === 'string' ? id : null;
}

function byId(tabs: readonly unknown[]): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const tab of tabs) {
    const id = tabId(tab);
    if (id !== null) map.set(id, tab);
  }
  return map;
}

// JSON with every object's keys in order, so two tabs holding the same content compare equal however they were
// built.
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : v,
  );
}

// Whether a tab is as it was set aside: the same stored content, or what this editor's own read of it saves when
// nobody changed anything (its retired content dropped, its kind stamped). A record holds a few tabs, compared once
// when its parts move.
function unchangedSince(tab: Tab, before: unknown): boolean {
  const now = canonical(tab);
  if (now === canonical(before)) return true;
  try {
    return now === canonical(stampTabKind(migrateStoredTab(before as Tab)));
  } catch {
    return false;
  }
}

export function mergeKeptTabs(
  current: OfflineDocumentRecord,
  setAside: RetiredPartsRecord,
  keep: readonly unknown[],
): OfflineDocumentRecord {
  const aside = byId(setAside.tabs);
  const kept = byId(keep);
  const tabs: unknown[] = [];
  const present = new Set<string>();
  for (const tab of current.tabs) {
    present.add(tab.id);
    const before = aside.get(tab.id);
    // Added since the set-aside, or edited here since: it stays as it is. What a read dropped from an edited tab is
    // already in the moved parts.
    if (before === undefined || !unchangedSince(tab, before)) {
      tabs.push(tab);
      continue;
    }
    // Unchanged: its kept version, or nothing when all of it moved.
    if (kept.has(tab.id)) tabs.push(kept.get(tab.id));
  }
  // A kept tab the set-aside never had is added; one deleted here since the set-aside is not brought back.
  for (const [id, tab] of kept) {
    if (!aside.has(id) && !present.has(id)) tabs.push(tab);
  }
  // The Plan cards and sheets on the record moved with its liveplanner part.
  const rest: Record<string, unknown> = { ...current };
  for (const field of RETIRED_RECORD_FIELDS) delete rest[field];
  // Raw stored tabs, read through migrateStoredTab like every other stored tab.
  return { ...(rest as OfflineDocumentRecord), tabs: tabs as Tab[] };
}
