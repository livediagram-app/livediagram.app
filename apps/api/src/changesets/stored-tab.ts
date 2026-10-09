import type { Tab } from '@livediagram/document';
import { getTab } from '../db';
import type { Runtime } from '../types';

// A tab as a changeset reads it: its body, apart from the row's fields (revision, position, link
// folder, timestamps), so the engine never copies them into what gets stored.
export type StoredTab = { tab: Tab; rev: number; orderIndex: number };

export async function readStoredTab(
  env: Runtime,
  documentId: string,
  tabId: string,
): Promise<StoredTab | null> {
  const record = await getTab(env, documentId, tabId);
  if (!record) return null;
  const { rev, orderIndex, documentId: _doc, updatedAt: _at, folder: _folder, ...tab } = record;
  return { tab, rev, orderIndex };
}

// The shape the base check reads: the tab with its revision.
export function withRev(stored: StoredTab | null): (Tab & { rev: number }) | null {
  return stored ? { ...stored.tab, rev: stored.rev } : null;
}
