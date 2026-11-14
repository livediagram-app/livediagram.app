// The lock every whole-tab write runs before it stores the tab (docs/specs/013-workspace/share-roles.md "The collab
// key": "Whole-tab writes keep other people's entries"; blueprint docs/specs/013-workspace/blueprints/share-roles.md
// "Whole-tab lock"). The tab save and its delta save, every changeset and revert (the REST, MCP and CLI writes) and a
// document's re-commit (an offline sync) call it with the tab as they would store it and the tab as stored: the
// writer's own reactions, responses and dots stand, everyone else's follow the room's ledger, else the stored tab.
//
// The ledger is read only when the write differs from the stored tab on someone else's entry, and then only for the
// elements it differs on (`wholeTabLockNeeds`): most saves change nobody else and cost no room call. A room that
// cannot answer is an empty ledger, so the stored entries stand (the lock fails closed) and the person whose live
// entry it was puts it back with their own next save.

import { lockWholeTab, wholeTabLockNeeds, type Tab, type TabLedger } from '@livediagram/document';
import { collabKeyFor } from '@liveworkspace/api-kit/collab-key';
import { isCollabKey } from '@liveworkspace/api-schema/collab-key';
import { getTab } from './db';
import { fetchLedgerEntries } from './room-client';
import type { DocumentEnv, Env } from './types';

/** Which write is locking, for its log line. */
export type WholeTabWrite = 'save' | 'changeset' | 'recommit';

/**
 * The tab a whole-tab write stores. `person` is the writer's account or guest id, or null for an agent's token, which
 * may change nobody's entry. The SAME tab when nothing was locked.
 */
export async function lockTabWrite<T extends Tab>(
  env: Env,
  documentId: string,
  tabId: string,
  written: T,
  stored: Tab | null,
  person: string | null,
  write: WholeTabWrite,
): Promise<T> {
  const key = person === null ? null : await collabKeyFor(person);
  const needs = wholeTabLockNeeds(written, stored, key);
  let ledger: TabLedger = { elements: {} };
  if (needs.elementIds.length > 0 || needs.vote) {
    const fetched = await fetchLedgerEntries(env, documentId, tabId, needs);
    if (fetched) ledger = fetched;
    else {
      console.warn('[whole-tab-lock] ledger-unavailable', {
        documentId,
        tabId,
        write,
        elements: needs.elementIds.length,
      });
    }
  }
  const writer = { key, isDerivedKey: isCollabKey };
  const locked = lockWholeTab(written, stored, ledger, writer, needs) as T;
  if (locked !== written) {
    console.info('[whole-tab-lock] locked', {
      documentId,
      tabId,
      write,
      elements: needs.elementIds.length,
      vote: needs.vote,
    });
  }
  return locked;
}

/** A re-commit's tabs, each locked against the tab it writes over (none for a tab new to the document). */
export function lockRecommittedTabs(
  env: DocumentEnv,
  documentId: string,
  tabs: Tab[],
  person: string | null,
): Promise<Tab[]> {
  return Promise.all(
    tabs.map(async (tab) =>
      lockTabWrite(
        env,
        documentId,
        tab.id,
        tab,
        await getTab(env, documentId, tab.id),
        person,
        'recommit',
      ),
    ),
  );
}
