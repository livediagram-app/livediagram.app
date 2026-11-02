// The Inbox's read of projects in This Browser (docs/specs/013-workspace/inbox.md §2.6). They never reach the
// worker, so the server's collaboration index never holds them; this finds their open actions, Plan cards and
// comment threads in the browser's offline store, with the same derivation the index uses
// (collabIndexRowsFromElements, cardPlacesOf) and the same rules the server read applies, the reader
// owning every one of them.

import {
  ACTIVITY_LIST_MAX,
  type ActivityAction,
  type ActivityCard,
  type ActivityCardThread,
  type ActivityThread,
} from '@liveplanner/api-schema';
import {
  cardPlacesOf,
  collabIndexRowsFromElements,
  threadTitle,
  type CardThread,
} from '@liveplanner/project';
import { recordThreads } from './offline-threads';
import {
  ARCHIVED_FIELD,
  itemAssignee,
  itemPersonId,
  itemStatus,
  itemTitle,
  type Item,
} from '@liveplanner/items';
import { offlineBackend } from './offline-backend';
import { offlineIdCount } from './offline-ids';
import type { OfflineProjectRecord } from './offline-store';

export type OfflineActivity = {
  actions: ActivityAction[];
  threads: ActivityThread[];
  cards: ActivityCard[];
  cardThreads: ActivityCardThread[];
};

const EMPTY: OfflineActivity = { actions: [], threads: [], cards: [], cardThreads: [] };

// Who the reader is: their ids (owner id, and the guest id this browser still holds) and the hashes of them, as an
// item's assignee carries them (docs/specs/026-plan/blueprints/item-store.md "Security and trust").
export type OfflineReader = { ids: readonly string[]; personIds: readonly string[] };

export async function offlineReader(ids: readonly (string | null)[]): Promise<OfflineReader> {
  const distinct = [...new Set(ids.filter((id): id is string => !!id))];
  return { ids: distinct, personIds: await Promise.all(distinct.map((id) => itemPersonId(id))) };
}

// Reads every live record in This Browser and lists what is waiting on the reader. A browser with no projects in This Browser
// reads no records: the id index answers first, and is cached for the page load.
export async function readOfflineActivity(
  ids: readonly (string | null)[],
): Promise<OfflineActivity> {
  if ((await offlineIdCount()) === 0) return EMPTY;
  const [records, reader] = await Promise.all([offlineBackend().all(), offlineReader(ids)]);
  const collect = collector(reader);
  // A browser holding many large projects would otherwise read them in one long task: hand the main thread
  // back between projects once a slice has run (measured: 200 projects of 1,500 elements, ~250ms in one go).
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

type Place = Pick<ActivityCard, 'projectId' | 'projectName' | 'teamId' | 'via' | 'shareCode'>;

function placeOf(rec: OfflineProjectRecord): Place {
  return { projectId: rec.id, projectName: rec.name, teamId: null, via: 'own', shareCode: null };
}

// Neither archived nor in the Trash: the cards the page may list at all.
function isLive(item: Item): boolean {
  return item.fields[ARCHIVED_FIELD] !== true && itemStatus(item) !== 'trash';
}

const newest = <T>(rows: T[], at: (row: T) => number): T[] =>
  rows.sort((a, b) => at(b) - at(a)).slice(0, ACTIVITY_LIST_MAX);

// Pure: the records in, the Inbox's four lists out, each newest first and capped like the server read.
export function offlineActivityFromRecords(
  records: readonly OfflineProjectRecord[],
  reader: OfflineReader,
): OfflineActivity {
  const collect = collector(reader);
  for (const rec of records) collect.add(rec);
  return collect.finish();
}

// One record at a time, so the read can yield between them.
function collector(reader: OfflineReader) {
  const me = new Set(reader.ids);
  const myPersonIds = new Set(reader.personIds);
  const out: OfflineActivity = { actions: [], threads: [], cards: [], cardThreads: [] };
  const add = (rec: OfflineProjectRecord): void => {
    // A project in the local Trash waits there; the server read skips trashed projects the same way.
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
          // The reader owns every project in This Browser.
          onYourProject: true,
          mentionsYou: t.mentionedIds.some((id) => me.has(id)),
        });
      }
    });
    const items = rec.items ?? [];
    if (items.length === 0) return;
    // Each card's open threads, a thread listed once, on its first card (docs/specs/026-plan/items.md "Comments").
    const threadsOf = new Map<string, CardThread[]>();
    for (const t of recordThreads(rec)) {
      const first = t.cards.find((c) => c.projectId === rec.id);
      if (t.resolved || !first) continue;
      threadsOf.set(first.itemId, [...(threadsOf.get(first.itemId) ?? []), t]);
    }
    // Where each card opens, and which statuses are done (@liveplanner/project cardPlacesOf).
    const places = cardPlacesOf(rec.tabs.map((t) => ({ ...t, elements: t.elements ?? [] })));
    for (const item of items) {
      if (!isLive(item)) continue;
      const status = itemStatus(item);
      // Placed only once listed: most cards in a project are someone else's.
      const card = () => ({
        ...place,
        board: places.boardFor(status),
        id: item.id,
        key: item.key,
        type: item.type,
        title: itemTitle(item),
      });
      const assignee = itemAssignee(item);
      if (
        assignee &&
        myPersonIds.has(assignee.id) &&
        // A linked card's action is listed already (docs/specs/026-plan/linked-boards.md "The Inbox").
        item.fields['linked'] == null &&
        !places.isDone(status)
      ) {
        out.cards.push({ ...card(), status: status ?? null, updatedAt: item.updatedAt });
      }
      for (const thread of threadsOf.get(item.id) ?? []) {
        const comments = thread.comments;
        const latest = comments[comments.length - 1]!;
        out.cardThreads.push({
          ...card(),
          threadId: thread.id,
          threadTitle: threadTitle(thread),
          commentCount: comments.length,
          latest: {
            text: latest.text ?? '',
            authorName: latest.authorName ?? '',
            authorColor: latest.authorColor ?? '',
            at: latest.createdAt ?? 0,
          },
          firstAt: comments[0]!.createdAt ?? 0,
          youCommented: comments.some((c) => !!c.authorId && me.has(c.authorId)),
          onYourProject: true,
          mentionsYou: comments.some((c) =>
            (c.mentions ?? []).some((m) => !!m.userId && me.has(m.userId)),
          ),
        });
      }
    }
  };
  const finish = (): OfflineActivity => ({
    actions: newest(out.actions, (a) => a.updatedAt),
    threads: newest(out.threads, (t) => t.latest.at),
    cards: newest(out.cards, (c) => c.updatedAt),
    cardThreads: newest(out.cardThreads, (t) => t.latest.at),
  });
  return { add, finish };
}
