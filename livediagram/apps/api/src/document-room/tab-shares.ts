// A tab shared between documents (docs/specs/006-document/tab-document-many-to-many.md), with each document's
// content in its own Durable Object (docs/specs/015-api/api.md "Storage").
//
// Every document holding a shared tab keeps its own copy under the same tab id, and lists the other holders in
// `tab_shares` (document-schema.ts). A write to the tab here (a save, a rename, a Q&A vote, an agent's changeset)
// fills `share_outbox` from a trigger, so no write path can forget it; the room's alarm drains it, sending the
// tab's current name and body to each other holder, which keeps the latest write (by its time, then by its
// content, so every holder settles on the same one). A copy taken in from another holder pushes nothing back,
// except to holders the sender did not know of, which is how a holder that joined a moment ago hears of a write
// made by one that has not yet heard of it.
//
// Holders come and go by message too: `join` tells the others a document now holds the tab, `leave` that one no
// longer does. A holder that answers `gone` (it no longer holds the tab, or no longer exists) is dropped.

import type { Tab } from '@livediagram/document';
import type { SharedTabsSummary } from '@livediagram/api-schema';
import { imageRefIdsFromData } from '../image-refs/extract';
import { imageRefReplaceStatements } from '../db/image-refs';
import { tabStatsOfData, tabStatsStatement } from '../db/tab-stats';
import { tabWriteStatements } from '../db/tabs';
import type { DocumentEnv } from '../types';

export type ShareMessage =
  // The tab as the sender holds it, and the holders it knows (itself included).
  | {
      kind: 'body';
      tabId: string;
      name: string;
      data: string;
      updatedAt: number;
      members: string[];
    }
  | { kind: 'join'; tabId: string; member: string }
  | { kind: 'leave'; tabId: string };

// `gone`: the receiver does not hold the tab, so the sender stops sending it.
export type ShareAnswer = 'ok' | 'gone';

// What a document joining a tab's holders takes from the one it joins through.
export type SharedTabCopy = {
  name: string;
  data: string;
  updatedAt: number;
  // Every holder but the joining one, the sender first.
  members: string[];
};

type StoredTab = { name: string; data: string; updated_at: number };

async function storedTab(
  env: DocumentEnv,
  documentId: string,
  tabId: string,
): Promise<StoredTab | null> {
  return env.DOCUMENT_DB.prepare(
    `SELECT t.name, t.data, t.updated_at FROM tabs t JOIN document_tabs dt ON dt.tab_id = t.id
      WHERE dt.document_id = ? AND t.id = ?`,
  )
    .bind(documentId, tabId)
    .first<StoredTab>();
}

async function membersOf(env: DocumentEnv, tabId: string): Promise<string[]> {
  const { results } = await env.DOCUMENT_DB.prepare(
    'SELECT document_id FROM tab_shares WHERE tab_id = ? ORDER BY document_id',
  )
    .bind(tabId)
    .all<{ document_id: string }>();
  return results.map((r) => r.document_id);
}

// One share_outbox key, under a new id when it was already there (a drain in flight then keeps it).
function enqueue(
  env: DocumentEnv,
  kind: 'body' | 'join' | 'leave',
  tabId: string,
  to: string,
  member = '',
): D1PreparedStatement[] {
  return [
    env.DOCUMENT_DB.prepare(
      'DELETE FROM share_outbox WHERE kind = ? AND tab_id = ? AND to_document = ? AND member = ?',
    ).bind(kind, tabId, to, member),
    env.DOCUMENT_DB.prepare(
      'INSERT INTO share_outbox (kind, tab_id, to_document, member) VALUES (?, ?, ?, ?)',
    ).bind(kind, tabId, to, member),
  ];
}

// ---------- Joining ------------------------------------------------------------------------------------------

// The joining document's first step, on the document it joins through: the tab as held here and its holders.
// Records nothing, so a join that fails part way leaves no holder that holds nothing. Null: no such tab here.
export async function sharedTabCopy(
  env: DocumentEnv,
  documentId: string,
  tabId: string,
): Promise<SharedTabCopy | null> {
  const tab = await storedTab(env, documentId, tabId);
  if (!tab) return null;
  return {
    name: tab.name,
    data: tab.data,
    updatedAt: tab.updated_at,
    members: [documentId, ...(await membersOf(env, tabId))],
  };
}

// The joining document's own step: the tab as a new tab at the end of its order, under the same id, dated as
// the copy it took, and the holders it now shares it with. False when it already holds a tab with that id.
export async function takeSharedTab(
  env: DocumentEnv,
  documentId: string,
  tabId: string,
  copy: SharedTabCopy,
): Promise<boolean> {
  const held = await env.DOCUMENT_DB.prepare('SELECT 1 AS present FROM tabs WHERE id = ?')
    .bind(tabId)
    .first<{ present: number }>();
  if (held) return false;
  const position = await env.DOCUMENT_DB.prepare(
    'SELECT COALESCE(MAX(order_index) + 1, 0) AS next FROM document_tabs WHERE document_id = ?',
  )
    .bind(documentId)
    .first<{ next: number }>();
  const tab: Tab = {
    ...(JSON.parse(copy.data) as Omit<Tab, 'id' | 'name'>),
    id: tabId,
    name: copy.name,
  };
  const members = copy.members.filter((m) => m !== documentId);
  await env.DOCUMENT_DB.batch([
    ...tabWriteStatements(env, documentId, tab, position?.next ?? 0, { advance: true }),
    // Dated as the copy, not now: a write the holder made since is then newer, and lands here when it comes.
    env.DOCUMENT_DB.prepare('UPDATE tabs SET updated_at = ? WHERE id = ?').bind(
      copy.updatedAt,
      tabId,
    ),
    ...members.map((m) =>
      env.DOCUMENT_DB.prepare(
        'INSERT OR IGNORE INTO tab_shares (tab_id, document_id) VALUES (?, ?)',
      ).bind(tabId, m),
    ),
  ]);
  return true;
}

// The last step, back on the document joined through: it now shares the tab with `member`, tells the other
// holders so, and sends `member` the tab again if it changed since `seenUpdatedAt`. False: no such tab here.
export async function recordShareJoin(
  env: DocumentEnv,
  documentId: string,
  tabId: string,
  member: string,
  seenUpdatedAt: number,
): Promise<boolean> {
  const tab = await storedTab(env, documentId, tabId);
  if (!tab) return false;
  const others = (await membersOf(env, tabId)).filter((m) => m !== member);
  await env.DOCUMENT_DB.batch([
    env.DOCUMENT_DB.prepare(
      'INSERT OR IGNORE INTO tab_shares (tab_id, document_id) VALUES (?, ?)',
    ).bind(tabId, member),
    ...others.flatMap((m) => enqueue(env, 'join', tabId, m, member)),
    ...(tab.updated_at === seenUpdatedAt ? [] : enqueue(env, 'body', tabId, member)),
  ]);
  return true;
}

// ---------- Leaving ------------------------------------------------------------------------------------------

// A document dropping a tab tells the other holders first (db/tabs.ts deleteTabRow, its `leave` keys).

// Every (tab, holder) pair the document shares: a document purged for good says goodbye to each first.
export async function allShares(env: DocumentEnv): Promise<{ tabId: string; to: string }[]> {
  const { results } = await env.DOCUMENT_DB.prepare(
    'SELECT tab_id, document_id FROM tab_shares ORDER BY tab_id, document_id',
  ).all<{ tab_id: string; document_id: string }>();
  return results.map((r) => ({ tabId: r.tab_id, to: r.document_id }));
}

// ---------- Receiving ----------------------------------------------------------------------------------------

// Whether `incoming` is the later write: by time, then (a tie, from two holders in the same millisecond) by
// content, so every holder keeps the same one.
function isLater(
  incoming: { name: string; data: string; updatedAt: number },
  held: StoredTab,
): boolean {
  if (incoming.updatedAt !== held.updated_at) return incoming.updatedAt > held.updated_at;
  if (incoming.data !== held.data) return incoming.data > held.data;
  return incoming.name > held.name;
}

// What another holder (`from`) sent. One answer per message.
export async function receiveShares(
  env: DocumentEnv,
  documentId: string,
  from: string,
  messages: readonly ShareMessage[],
): Promise<ShareAnswer[]> {
  const answers: ShareAnswer[] = [];
  for (const message of messages) answers.push(await receiveOne(env, documentId, from, message));
  return answers;
}

async function receiveOne(
  env: DocumentEnv,
  documentId: string,
  from: string,
  message: ShareMessage,
): Promise<ShareAnswer> {
  const { tabId } = message;
  if (message.kind === 'leave') {
    await env.DOCUMENT_DB.batch([
      env.DOCUMENT_DB.prepare('DELETE FROM tab_shares WHERE tab_id = ? AND document_id = ?').bind(
        tabId,
        from,
      ),
      env.DOCUMENT_DB.prepare('DELETE FROM share_outbox WHERE tab_id = ? AND to_document = ?').bind(
        tabId,
        from,
      ),
    ]);
    return 'ok';
  }
  const held = await storedTab(env, documentId, tabId);
  if (!held) return 'gone';
  if (message.kind === 'join') {
    if (message.member !== documentId) {
      await env.DOCUMENT_DB.prepare(
        'INSERT OR IGNORE INTO tab_shares (tab_id, document_id) VALUES (?, ?)',
      )
        .bind(tabId, message.member)
        .run();
    }
    return 'ok';
  }
  // A body from a holder this document has not heard of yet (its join is still on its way) makes it one.
  const learn = env.DOCUMENT_DB.prepare(
    'INSERT OR IGNORE INTO tab_shares (tab_id, document_id) VALUES (?, ?)',
  ).bind(tabId, from);
  if (!isLater(message, held)) {
    await learn.run();
    return 'ok';
  }
  const { stats } = tabStatsOfData(message.data);
  const now = Date.now();
  // The sender sends to every holder it knows, so this document sends on only to the ones it did not know.
  const informed = JSON.stringify([from, ...message.members]);
  await env.DOCUMENT_DB.batch([
    learn,
    env.DOCUMENT_DB.prepare(
      `UPDATE tabs SET name = ?, data = ?, updated_at = ?, element_count = ?, rev = rev + 1 WHERE id = ?`,
    ).bind(message.name, message.data, message.updatedAt, stats.elementCount, tabId),
    tabStatsStatement(env, tabId, stats, now),
    ...imageRefReplaceStatements(env, tabId, imageRefIdsFromData(message.data)),
    env.DOCUMENT_DB.prepare('UPDATE document SET saved_at = ? WHERE id = ?').bind(now, documentId),
    env.DOCUMENT_DB.prepare(
      `DELETE FROM share_outbox WHERE kind = 'body' AND tab_id = ?
         AND to_document IN (SELECT value FROM json_each(?))`,
    ).bind(tabId, informed),
  ]);
  return 'ok';
}

// ---------- Sending ------------------------------------------------------------------------------------------

type ShareRow = {
  id: number;
  kind: 'body' | 'join' | 'leave';
  tab_id: string;
  to_document: string;
  member: string;
};

// Messages one drain sends. Each is one call to another document; a body is up to a tab's size.
export const DRAIN_SHARES = 50;

export type ShareDrain = { sent: number; failed: number; more: boolean };

// Send what share_outbox holds, one message per call, each to the document it is for (`send`). A message sent is
// deleted by the id read, so one written again meanwhile stays; one that failed stays for the next drain; a
// holder that answered `gone` is dropped, with whatever else was waiting for it about that tab.
export async function drainShares(
  env: DocumentEnv,
  documentId: string,
  send: (to: string, messages: ShareMessage[]) => Promise<ShareAnswer[]>,
): Promise<ShareDrain> {
  const rows = (
    await env.DOCUMENT_DB.prepare(
      'SELECT id, kind, tab_id, to_document, member FROM share_outbox ORDER BY id LIMIT ?',
    )
      .bind(DRAIN_SHARES + 1)
      .all<ShareRow>()
  ).results;
  const more = rows.length > DRAIN_SHARES;
  let sent = 0;
  let failed = 0;
  // A tab sent to several holders is read once per drain.
  const bodies = new Map<string, Promise<ShareMessage | null>>();
  for (const row of rows.slice(0, DRAIN_SHARES)) {
    let message: ShareMessage | null;
    if (row.kind === 'body') {
      if (!bodies.has(row.tab_id)) bodies.set(row.tab_id, messageOf(env, documentId, row));
      message = await bodies.get(row.tab_id)!;
    } else {
      message = await messageOf(env, documentId, row);
    }
    if (message) {
      let answer: ShareAnswer;
      try {
        [answer = 'ok'] = await send(row.to_document, [message]);
      } catch (error) {
        console.warn('[tab-shares] send failed', {
          documentId,
          to: row.to_document,
          kind: row.kind,
          error: String(error),
        });
        failed += 1;
        continue;
      }
      sent += 1;
      if (answer === 'gone') {
        await env.DOCUMENT_DB.batch([
          env.DOCUMENT_DB.prepare(
            'DELETE FROM tab_shares WHERE tab_id = ? AND document_id = ?',
          ).bind(row.tab_id, row.to_document),
          env.DOCUMENT_DB.prepare(
            'DELETE FROM share_outbox WHERE tab_id = ? AND to_document = ?',
          ).bind(row.tab_id, row.to_document),
        ]);
        continue;
      }
    }
    await env.DOCUMENT_DB.prepare('DELETE FROM share_outbox WHERE id = ?').bind(row.id).run();
  }
  return { sent, failed, more };
}

// The message a row stands for, read now; null when there is nothing left to say (the tab went since).
async function messageOf(
  env: DocumentEnv,
  documentId: string,
  row: ShareRow,
): Promise<ShareMessage | null> {
  if (row.kind === 'leave') return { kind: 'leave', tabId: row.tab_id };
  if (row.kind === 'join') return { kind: 'join', tabId: row.tab_id, member: row.member };
  const tab = await storedTab(env, documentId, row.tab_id);
  if (!tab) return null;
  return {
    kind: 'body',
    tabId: row.tab_id,
    name: tab.name,
    data: tab.data,
    updatedAt: tab.updated_at,
    members: [documentId, ...(await membersOf(env, row.tab_id))],
  };
}

// ---------- The notice ---------------------------------------------------------------------------------------

// How many of the document's tabs are shared with other documents, and with how many documents: what deleting
// it or taking it offline leaves in those (the "Shared-tab notice").
export async function sharedTabsSummary(
  env: DocumentEnv,
  documentId: string,
): Promise<SharedTabsSummary> {
  const row = await env.DOCUMENT_DB.prepare(
    `SELECT COUNT(DISTINCT s.tab_id) AS tabs, COUNT(DISTINCT s.document_id) AS documents
       FROM tab_shares s JOIN document_tabs dt ON dt.tab_id = s.tab_id
      WHERE dt.document_id = ? AND s.document_id <> dt.document_id`,
  )
    .bind(documentId)
    .first<SharedTabsSummary>();
  return { tabs: row?.tabs ?? 0, documents: row?.documents ?? 0 };
}
