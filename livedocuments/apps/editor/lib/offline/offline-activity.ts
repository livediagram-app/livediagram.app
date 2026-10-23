// The Inbox's read of documents in This Browser (docs/specs/013-workspace/inbox.md §2.6). They never reach the
// worker, so the server's collaboration index never holds them; this finds their open actions and comment threads
// in the browser's offline store, with the same derivation the index uses (collabIndexRowsFromElements) and the
// same rules the server read applies, the reader owning every one of them.

import { ACTIVITY_LIST_MAX, type ActivityAction, type ActivityThread } from '@livedocuments/api-schema';
import { collabIndexRowsFromElements } from '@livedocuments/document';
import { offlineBackend } from './offline-backend';
import { offlineIdCount } from './offline-ids';
import type { OfflineDocumentRecord } from './offline-store';

export type OfflineActivity = {
  actions: ActivityAction[];
  threads: ActivityThread[];
};

const EMPTY: OfflineActivity = { actions: [], threads: [] };

// Who the reader is: their ids (owner id, and the guest id this browser still holds).
export type OfflineReader = { ids: readonly string[] };

export function offlineReader(ids: readonly (string | null)[]): OfflineReader {
  return { ids: [...new Set(ids.filter((id): id is string => !!id))] };
}

// Reads every live record in This Browser and lists what is waiting on the reader. A browser with no documents in This Browser
// reads no records: the id index answers first, and is cached for the page load.
export async function readOfflineActivity(
  ids: readonly (string | null)[],
): Promise<OfflineActivity> {
  if ((await offlineIdCount()) === 0) return EMPTY;
  const records = await offlineBackend().all();
  const reader = offlineReader(ids);
  const collect = collector(reader);
  // A browser holding many large documents would otherwise read them in one long task: hand the main thread
  // back between documents once a slice has run (measured: 200 documents of 1,500 elements, ~250ms in one go).
  let sliceStart = performance.now();
  for (const rec of records) {
    if (performance.now() - sliceStart > OFFLINE_ACTIVITY_SLICE_MS) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      sliceStart = performance.now();
    }
    collect.add(rec);
  }
  return collect.finish();
}

// How long the read runs before yielding: half a 60fps frame, so a click during it still answers promptly.
const OFFLINE_ACTIVITY_SLICE_MS = 8;

type Place = Pick<ActivityThread, 'documentId' | 'documentName' | 'teamId' | 'via' | 'shareCode'>;

function placeOf(rec: OfflineDocumentRecord): Place {
  return { documentId: rec.id, documentName: rec.name, teamId: null, via: 'own', shareCode: null };
}

const newest = <T>(rows: T[], at: (row: T) => number): T[] =>
  rows.sort((a, b) => at(b) - at(a)).slice(0, ACTIVITY_LIST_MAX);

// Pure: the records in, the Inbox's two lists out, each newest first and capped like the server read.
export function offlineActivityFromRecords(
  records: readonly OfflineDocumentRecord[],
  reader: OfflineReader,
): OfflineActivity {
  const collect = collector(reader);
  for (const rec of records) collect.add(rec);
  return collect.finish();
}

// One record at a time, so the read can yield between them.
function collector(reader: OfflineReader) {
  const me = new Set(reader.ids);
  const out: OfflineActivity = { actions: [], threads: [] };
  const add = (rec: OfflineDocumentRecord): void => {
    // A document in the local Trash waits there; the server read skips trashed documents the same way.
    if (rec.trashedAt !== undefined) return;
    const place = placeOf(rec);
    rec.tabs.forEach((tab) => {
      const elements = tab.elements ?? [];
      const rows = collabIndexRowsFromElements(elements);
      const tabPlace = { ...place, tabId: tab.id, tabName: tab.name };
      for (const a of rows.actions) {
        if (a.status !== 'open') continue;
        const assignedToMe = !!a.assigneeUserId && me.has(a.assigneeUserId);
        const createdByMe = me.has(a.assignerId);
        if (!assignedToMe && !createdByMe) continue;
        out.actions.push({
          ...tabPlace,
          elementId: a.elementId,
          elementLabel: a.elementLabel,
          id: a.actionId,
          name: a.name,
          description: a.description,
          assignee: { userId: a.assigneeUserId, name: a.assigneeName },
          assigner: { id: a.assignerId, name: a.assignerName },
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
          assignedToMe,
          createdByMe,
        });
      }
      for (const t of rows.threads) {
        if (t.resolved) continue;
        out.threads.push({
          ...tabPlace,
          elementId: t.elementId,
          elementLabel: t.elementLabel,
          commentCount: t.commentCount,
          latest: {
            text: t.latestText,
            authorName: t.latestAuthorName,
            authorColor: t.latestAuthorColor,
            at: t.latestAt,
          },
          firstAt: t.firstAt,
          youCommented: t.participantIds.some((id) => me.has(id)),
          // The reader owns every document in This Browser.
          onYourDocument: true,
          mentionsYou: t.mentionedIds.some((id) => me.has(id)),
        });
      }
    });
  };
  const finish = (): OfflineActivity => ({
    actions: newest(out.actions, (a) => a.updatedAt),
    threads: newest(out.threads, (t) => t.latest.at),
  });
  return { add, finish };
}
