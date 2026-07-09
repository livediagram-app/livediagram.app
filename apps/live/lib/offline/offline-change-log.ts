// Offline Mode (spec/76): an offline diagram's activity / change log is
// local-only, kept inside its IndexedDB record — there is no server history,
// so the /log endpoints must never be hit for one. This is the local
// counterpart of `lib/api/change-log.ts`, which dispatches here when the
// diagram id is registered offline (see `isOfflineId`).

import { CHANGE_LOG_LIST_LIMIT, type ChangeLogEntry } from '@livediagram/api-schema';
import {
  offlineGetRecord,
  offlinePutRecord,
  serializeOfflineWrite,
  type OfflineDiagramRecord,
} from './offline-store';

// ---------------------------------------------------------------------------
// Pure transforms (unit-tested — no IndexedDB involved)
// ---------------------------------------------------------------------------

// Prepend the entry, newest first, capped at the same limit the server
// hydrates (spec/12): the Activity Panel only ever shows the most recent N,
// and unlike D1 there's no audit table behind it — retaining more would just
// bloat a record that gets rewritten whole on every save.
export function appendLog(rec: OfflineDiagramRecord, entry: ChangeLogEntry): OfflineDiagramRecord {
  return { ...rec, log: [entry, ...(rec.log ?? [])].slice(0, CHANGE_LOG_LIST_LIMIT) };
}

export function removeLogEntry(rec: OfflineDiagramRecord, entryId: string): OfflineDiagramRecord {
  return { ...rec, log: (rec.log ?? []).filter((e) => e.id !== entryId) };
}

export function removeLogForTab(rec: OfflineDiagramRecord, tabId: string): OfflineDiagramRecord {
  return { ...rec, log: (rec.log ?? []).filter((e) => e.tabId !== tabId) };
}

// ---------------------------------------------------------------------------
// Ops — the local mirror of the change-log api surface
// ---------------------------------------------------------------------------

async function mutateLog(
  id: string,
  fn: (rec: OfflineDiagramRecord) => OfflineDiagramRecord,
): Promise<void> {
  await serializeOfflineWrite(async () => {
    const rec = await offlineGetRecord(id);
    if (rec) await offlinePutRecord(fn(rec));
  });
}

export async function offlineListChangeLog(id: string): Promise<ChangeLogEntry[]> {
  return (await offlineGetRecord(id))?.log ?? [];
}

export async function offlineAppendChangeLogEntry(
  id: string,
  entry: ChangeLogEntry,
): Promise<ChangeLogEntry> {
  await mutateLog(id, (rec) => appendLog(rec, entry));
  return entry;
}

export async function offlineDeleteChangeLogEntry(id: string, entryId: string): Promise<void> {
  return mutateLog(id, (rec) => removeLogEntry(rec, entryId));
}

export async function offlineDeleteChangeLogForTab(id: string, tabId: string): Promise<void> {
  return mutateLog(id, (rec) => removeLogForTab(rec, tabId));
}
