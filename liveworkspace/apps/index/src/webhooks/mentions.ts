// Mentions for webhooks (liveworkspace/docs/specs/004-index/webhooks.md "What it sends"): read from the comment threads
// every app pushes for the Inbox, each thread's `mentionedIds` (the people its comments mention, as the apps' phone
// notifications read them). A thread that gained comments and names an account it didn't before has just mentioned
// that person. A mention is about a person, so it goes only to webhooks they, or their team, can read the item
// through:
//
//   - `p:<them>`, when they own the item, are one of its team's people (accounts, asked now), or hold a live share link
//     to it that reaches the comment's tab;
//   - `t:<team>`, when the item is that team's and they are one of its people.
//
// What it costs a push: nothing when no thread names an account; otherwise two indexed reads that ride the push's own
// read batch (which of those people, and the item's team, have a live webhook listening for `mention`; which of them
// hold a link to the item), then an accounts ask per person only where a team decides it, and one statement in the
// push's write batch.

import { isAccountId } from '@liveworkspace/auth-client';
import type { CollabThreadInput } from '@liveworkspace/index-client';
import type { PersonTeams } from './access';
import type { MentionDelivery } from './outbox';

// The most mentions one tab's push hands on: past any real save, and it bounds the accounts asks.
export const MENTIONS_PER_PUSH_MAX = 10;

/** The item a push is about, as its row holds it. */
export type MentionItem = {
  itemId: string;
  tabId: string;
  owner_id: string;
  team_id: string | null;
  created_at: number;
};

/** A thread as the index held it before the push: its comment count and who it mentioned (JSON text). */
export type HeldMentions = {
  element_id: string;
  comment_count: number;
  mentioned_ids: string | null;
};

/** The accounts a push's threads mention, the ones the probes ask about. */
export function mentionedAccounts(threads: Iterable<CollabThreadInput>): string[] {
  const ids = new Set<string>();
  for (const t of threads) for (const id of t.mentionedIds) if (isAccountId(id)) ids.add(id);
  return [...ids];
}

/** Which of these people, and the item's team, have a live webhook listening for `mention`: their scopes. */
export function listeningScopesStatement(
  db: D1Database,
  itemId: string,
  people: readonly string[],
): D1PreparedStatement {
  return db
    .prepare(
      `SELECT DISTINCT w.scope FROM webhooks w
       WHERE w.paused_at IS NULL AND instr(w.events, ',mention,') > 0
         AND w.scope IN (SELECT 'p:' || value FROM json_each(?1)
                         UNION ALL SELECT scope FROM items WHERE id = ?2 AND team_id IS NOT NULL)`,
    )
    .bind(JSON.stringify(people), itemId);
}

/** Which of these people hold a live share link to the item (not in the Trash) that reaches this tab. */
export function linkReadersStatement(
  db: D1Database,
  itemId: string,
  tabId: string,
  people: readonly string[],
  now = Date.now(),
): D1PreparedStatement {
  return db
    .prepare(
      `SELECT DISTINCT sw.person_id FROM shared_with sw
       JOIN share_links sl ON sl.code = sw.share_code AND sl.item_id = sw.item_id
       JOIN items i ON i.id = sw.item_id AND i.trashed_at IS NULL
       WHERE sw.item_id = ?1 AND sw.person_id IN (SELECT value FROM json_each(?2))
         AND (sl.tab_id IS NULL OR sl.tab_id = ?3) AND (sl.expires_at IS NULL OR sl.expires_at > ?4)`,
    )
    .bind(itemId, JSON.stringify(people), tabId, now);
}

const heldIds = (text: string | null): Set<string> => {
  try {
    const ids = JSON.parse(text ?? '[]') as unknown;
    return new Set(Array.isArray(ids) ? ids.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
};

type Mention = Omit<MentionDelivery, 'scope'> & { personId: string };

/** The people each thread has just mentioned: a thread with more comments than it held, dated no earlier than the
 *  item, naming an account it didn't, never its latest comment's own author. At most MENTIONS_PER_PUSH_MAX. */
export function freshMentions(
  item: MentionItem,
  held: readonly HeldMentions[],
  threads: Iterable<CollabThreadInput>,
  now: number,
): Mention[] {
  const was = new Map(held.map((t) => [t.element_id, t]));
  const out: Mention[] = [];
  for (const t of threads) {
    const before = was.get(t.elementId);
    if (t.commentCount <= (before?.comment_count ?? 0) || t.latestAt < item.created_at) continue;
    const earlier = heldIds(before?.mentioned_ids ?? null);
    for (const personId of t.mentionedIds) {
      if (!isAccountId(personId) || earlier.has(personId) || personId === t.latestAuthorId)
        continue;
      out.push({
        id: `mn:${item.itemId}:${item.tabId}:${t.elementId}:${t.commentCount}:${personId}`,
        personId,
        actorId: t.latestAuthorId ?? null,
        actorName: t.latestAuthorName || null,
        detail: { text: t.latestText, on: t.card?.title ?? t.elementLabel, mentionedId: personId },
        at: Math.min(t.latestAt, now),
      });
      if (out.length >= MENTIONS_PER_PUSH_MAX) return out;
    }
  }
  return out;
}

/**
 * Each mention's deliveries: to the scopes listening (`listening`, from listeningScopesStatement) that the mentioned
 * person, or the item's team, can read the item through. A person's teams are asked of accounts once a push, and only
 * where the answer decides something; when accounts can't say, nothing that needs it is sent.
 */
export async function mentionDeliveries(
  item: MentionItem,
  mentions: readonly Mention[],
  listening: ReadonlySet<string>,
  linkReaders: ReadonlySet<string>,
  personTeams: PersonTeams,
): Promise<MentionDelivery[]> {
  const team = item.team_id;
  const teamScope = team ? `t:${team}` : null;
  const asked = new Map<string, Promise<boolean>>();
  const inTeam = (personId: string) => {
    let answer = asked.get(personId);
    if (!answer) {
      answer = personTeams(personId).then((teams) => teams?.has(team!) ?? false);
      asked.set(personId, answer);
    }
    return answer;
  };
  const rows = await Promise.all(
    mentions.map(async ({ personId, ...mention }) => {
      const out: MentionDelivery[] = [];
      const own = `p:${personId}`;
      const ownListens = listening.has(own);
      const teamListens = teamScope !== null && listening.has(teamScope);
      if (!ownListens && !teamListens) return out;
      const direct = (team === null && item.owner_id === personId) || linkReaders.has(personId);
      const member =
        team !== null && (teamListens || (ownListens && !direct)) ? await inTeam(personId) : false;
      if (ownListens && (direct || member)) out.push({ ...mention, scope: own });
      if (teamListens && member) out.push({ ...mention, scope: teamScope! });
      return out;
    }),
  );
  return rows.flat();
}
