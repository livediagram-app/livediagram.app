// What the knowledgebase's alarm does for its watchers (docs/specs/030-knowledgebase/watching.md; blueprint
// watching.md "The push", "The daily check"), off every request's path (the `watch` work, knowledge-work.ts):
//
//   - `inbox`: the updates of the last 14 days to the Inbox, each with the people it is for (`pushUpdates`), a minute
//     after a change or a watch moved, retried after WATCH_RETRY_MS when the index is away.
//   - `daily`: who still reaches the knowledgebase (a watcher who left loses their watches), then each watcher who
//     turned the digest on gets one email of what changed since their last one. Owed again each day while any watch
//     is left.
//
// Also the review check's part (`noteReviewsLapsed`, from knowledge-emails.ts): a page whose review came due is
// noted once a verification, as `review_due`.
import { isAccountId } from '@liveworkspace/auth-client';
import { pushFailureOf } from '@liveworkspace/index-app';
import {
  INBOX_UPDATES_MS,
  UPDATE_PEOPLE_MAX,
  UPDATES_PUSH_MAX,
  type UpdateActor,
  type UpdateKind,
  type UpdatePush,
} from '@liveworkspace/index-client';
import { pageParents, type TreePage } from '@liveknowledge/document';
import { getDocument } from '../db';
import { readStoredPages } from '../document-room/page-tree-store';
import { watchDigestEmail, type DigestPage } from '../email/watch-digest-email';
import { notifyWatchDigests } from '../email/notifications';
import { indexAppClient } from '../index-service';
import type { DocumentEnv } from '../types';
import { marksOf, putMarks, reserveEmails } from './email-marks';
import { knowledgeDb } from './knowledge-db';
import { ownersWhoReach } from './knowledge-emails';
import type { Work } from './knowledge-work';
import { allWatches, coveringWatchers, dropWatchers, type WatchRow } from './page-watch';
import { noteWatched, WATCH_PUSH_DELAY_MS } from './watch-notes';

export const DAY_MS = 86_400_000;
/** How long a failed push waits before it is tried again. */
export const WATCH_RETRY_MS = 5 * 60_000;
/** The most watchers the daily check asks about: the longest unasked first. */
export const WATCH_REACH_CHECKS_PER_DAY = 200;
/** The most digests one knowledgebase sends in a UTC day. */
export const WATCH_DIGESTS_PER_DAY = 200;
/** The most updates a knowledgebase keeps; older ones go in the daily prune. */
export const WATCH_UPDATES_KEPT = 200;

type UpdateRow = {
  id: string;
  tab: string;
  tab_name: string;
  kinds: string;
  actors: string;
  actor_ids: string;
  count: number;
  first_at: number;
  latest_at: number;
};

export type WatchUpdate = Omit<UpdatePush, 'people'> & { actorIds: string[] };

const list = <T>(text: string): T[] => {
  try {
    const value = JSON.parse(text) as unknown;
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
};

const updateOf = (row: UpdateRow): WatchUpdate => {
  const actors = list<UpdateActor>(row.actors);
  const actorIds = list<string>(row.actor_ids);
  return {
    id: row.id,
    tabId: row.tab,
    tabName: row.tab_name,
    kinds: list<UpdateKind>(row.kinds),
    actors,
    actorCount: Math.max(actorIds.length, actors.length),
    count: row.count,
    firstAt: row.first_at,
    latestAt: row.latest_at,
    actorIds,
  };
};

/** The updates of the last INBOX_UPDATES_MS, newest first, at most UPDATES_PUSH_MAX. */
async function recentUpdates(env: DocumentEnv, now: number): Promise<WatchUpdate[]> {
  const { results } = await knowledgeDb(env)
    .prepare(
      `SELECT id, tab, tab_name, kinds, actors, actor_ids, count, first_at, latest_at FROM watch_updates
        WHERE latest_at > ? ORDER BY latest_at DESC, id LIMIT ?`,
    )
    .bind(now - INBOX_UPDATES_MS, UPDATES_PUSH_MAX)
    .all<UpdateRow>();
  return (results ?? []).map(updateOf);
}

/** The tree with the trashed pages where they stood, so a deleted page's sections still reach its watchers. */
async function treeOf(env: DocumentEnv, documentId: string) {
  const [stored, trashed] = await Promise.all([
    readStoredPages(env, documentId),
    knowledgeDb(env)
      .prepare('SELECT tab_id AS id, parent FROM page_trash')
      .all<{ id: string; parent: string | null }>(),
  ]);
  const pages: TreePage[] = [
    ...stored,
    ...(trashed.results ?? []).map((t) => (t.parent ? { id: t.id, parent: t.parent } : { id: t.id })),
  ];
  return pageParents(pages);
}

/**
 * Whom an update is for: the watchers covering its page whose watch began by its latest change, less anyone whose
 * own changes are all it holds, accounts only, at most UPDATE_PEOPLE_MAX by the earliest watch. Pure.
 */
export function peopleOf(
  update: Pick<WatchUpdate, 'tabId' | 'latestAt' | 'actorIds'>,
  watches: readonly WatchRow[],
  parents: ReadonlyMap<string, string | undefined>,
): string[] {
  const own = update.actorIds.length === 1 ? update.actorIds[0] : undefined;
  return [...coveringWatchers(watches, parents, update.tabId)]
    .filter(([person, at]) => at <= update.latestAt && person !== own && isAccountId(person))
    .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, UPDATE_PEOPLE_MAX)
    .map(([person]) => person);
}

/** The updates as the Inbox takes them, each with its people; those for nobody left out. */
export function updatePushes(
  updates: readonly WatchUpdate[],
  watches: readonly WatchRow[],
  parents: ReadonlyMap<string, string | undefined>,
): UpdatePush[] {
  return updates.flatMap(({ actorIds, ...update }) => {
    const people = peopleOf({ ...update, actorIds }, watches, parents);
    return people.length > 0 ? [{ ...update, people }] : [];
  });
}

/** The push: answers when to try again, or null when it is done. */
export async function pushWatchUpdates(
  env: DocumentEnv,
  documentId: string,
  now: number,
): Promise<number | null> {
  const client = indexAppClient(env);
  if (!client) return null;
  const [updates, watches, parents] = await Promise.all([
    recentUpdates(env, now),
    allWatches(env),
    treeOf(env, documentId),
  ]);
  const pushes = updatePushes(updates, watches, parents);
  try {
    await client.pushUpdates(documentId, pushes);
    console.info('[watch] pushed', { documentId, updates: pushes.length });
    return null;
  } catch (error) {
    // An item the index does not hold takes no push.
    if (pushFailureOf(error) === 'gone') return null;
    console.warn('[watch] push failed', { documentId, error: String(error) });
    return now + WATCH_RETRY_MS;
  }
}

/** The daily check: who still reaches it, then the digests. Answers the next day's check, or null with no watch. */
export async function runWatchDaily(
  env: DocumentEnv,
  documentId: string,
  now: number,
): Promise<number | null> {
  let watches = await allWatches(env);
  if (watches.length === 0) return null;
  const document = await getDocument(env, documentId);
  if (!document) return null;
  // (1) Reach: the longest unasked first, a bounded number a day.
  const asked = await marksOf(env, 'watch-reach');
  const people = [...new Set(watches.map((w) => w.person))]
    .sort((a, b) => (asked.get(a) ?? 0) - (asked.get(b) ?? 0))
    .slice(0, WATCH_REACH_CHECKS_PER_DAY);
  const reach = new Set(await ownersWhoReach(env, document, people));
  const lost = people.filter((p) => !reach.has(p));
  if (lost.length > 0) {
    await dropWatchers(env, lost);
    watches = watches.filter((w) => !lost.includes(w.person));
    env.WATCH_OWED?.('inbox', now + WATCH_PUSH_DELAY_MS);
    console.info('[watch] watchers who left', { documentId, removed: lost.length });
  }
  await putMarks(
    env,
    'watch-reach',
    people.filter((p) => reach.has(p)).map((key) => ({ key, at: now })),
  );
  // (2) Digests: each reaching watcher's updates since their last one (the last day, for a first).
  const [updates, parents, lastSent] = await Promise.all([
    recentUpdates(env, now),
    treeOf(env, documentId),
    marksOf(env, 'watch-digest'),
  ]);
  const owed = new Map<string, DigestPage[]>();
  for (const update of updates) {
    for (const person of peopleOf(update, watches, parents)) {
      if (!reach.has(person)) continue;
      if (update.latestAt <= (lastSent.get(person) ?? now - DAY_MS)) continue;
      const pages = owed.get(person) ?? [];
      // Newest first already; one line a page, its newest update's.
      if (!pages.some((p) => p.tab === update.tabId))
        pages.push({
          tab: update.tabId,
          title: update.tabName,
          kinds: update.kinds,
          actors: update.actors.filter((a) => a.id !== person),
          actorCount: Math.max(0, update.actorCount - (update.actorIds.includes(person) ? 1 : 0)),
        });
      owed.set(person, pages);
    }
  }
  if (owed.size > 0) {
    const allowed = await reserveEmails(env, owed.size, now, {
      scope: 'watch-emails',
      cap: WATCH_DIGESTS_PER_DAY,
    });
    const tried = [...owed].slice(0, allowed);
    const sent = await notifyWatchDigests(
      env,
      new Map(tried.map(([person, pages]) => [person, watchDigestEmail(env, document, pages)])),
    );
    await putMarks(
      env,
      'watch-digest',
      sent.map((key) => ({ key, at: now })),
    );
    console.info('[watch] digests', {
      documentId,
      owed: owed.size,
      tried: tried.length,
      sent: sent.length,
    });
  }
  return now + DAY_MS;
}

/** The alarm's `watch` work. */
export function runWatchWork(
  env: DocumentEnv,
  documentId: string,
  work: Work,
  now: number,
): Promise<number | null> {
  return work.key === 'daily'
    ? runWatchDaily(env, documentId, now)
    : pushWatchUpdates(env, documentId, now);
}

const REVIEW_BASELINE = '';

/**
 * The review check's part: each page newly due is noted for its watchers once a verification (`watch-review`
 * marks); the first check marks the backlog without telling anyone. Answers the next review's time, so the check
 * wakes for it with email off too; null when nobody watches here.
 */
export async function noteReviewsLapsed(
  env: DocumentEnv,
  pages: readonly { tab: string; state: string; verifiedAt?: number | undefined; reviewAt?: number | undefined }[],
  now: number,
): Promise<number | null> {
  const watches = await allWatches(env);
  if (watches.length === 0) return null;
  const told = await marksOf(env, 'watch-review');
  const baseline = !told.has(REVIEW_BASELINE);
  const fresh = pages.filter(
    (p) => p.state === 'review-due' && p.verifiedAt !== undefined && told.get(p.tab) !== p.verifiedAt,
  );
  if (!baseline && fresh.length > 0)
    await noteWatched(env, { tabs: fresh.map((p) => p.tab), kind: 'review_due', actor: () => null, now });
  await putMarks(env, 'watch-review', [
    ...(baseline ? [{ key: REVIEW_BASELINE, at: now }] : []),
    ...fresh.map((p) => ({ key: p.tab, at: p.verifiedAt ?? 0 })),
  ]);
  const upcoming = pages.flatMap((p) => (p.state === 'verified' && p.reviewAt ? [p.reviewAt] : []));
  return upcoming.length > 0 ? Math.min(...upcoming) : null;
}

/** The daily prune: updates past INBOX_UPDATES_MS, and past the newest WATCH_UPDATES_KEPT. */
export const pruneWatchUpdates = (now: number) => [
  { sql: 'DELETE FROM watch_updates WHERE latest_at <= ?', params: [now - INBOX_UPDATES_MS] },
  {
    sql: `DELETE FROM watch_updates WHERE id NOT IN (
            SELECT id FROM watch_updates ORDER BY latest_at DESC LIMIT ${WATCH_UPDATES_KEPT})`,
    params: [],
  },
];
