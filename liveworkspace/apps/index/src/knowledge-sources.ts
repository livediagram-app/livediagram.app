// Knowledge sources on the index (liveworkspace/docs/specs/004-index/knowledge-sources.md, its blueprint): a
// knowledgebase answering from other apps' items. liveknowledge's server calls these with its own app key, for one of
// its knowledgebases; the index decides what counts as a source, reads a source's text through its app's door, and
// says which sources a person can open themselves. It also tells the knowledgebases reading an item when it changes.
//
//   POST /app/items/:kb/knowledge-sources  {folderId?}                          → { sources }
//   POST /app/items/:kb/knowledge-text     {itemId, folderId?}                  → the source's text
//   POST /app/items/:kb/knowledge-reach    {personId, teams, itemIds, folderId?} → { itemIds }
//   POST /app/items/:kb/knowledge-likely   {personId, teams, words, exclude}   → { items }

import { DoorError } from '@liveworkspace/app-doors';
import {
  isKnowledgeSourceApp,
  ITEM_LOOKUP_IDS_MAX,
  KNOWLEDGE_FOLDER_DEPTH_MAX,
  KNOWLEDGE_LIKELY_MAX,
  KNOWLEDGE_LIKELY_WORDS_MAX,
  KNOWLEDGE_SOURCE_APPS,
  KNOWLEDGE_SOURCES_MAX,
  KNOWLEDGE_WATCHERS_MAX,
  type App,
  type KnowledgeLikelyItem,
  type KnowledgeSourceChange,
  type KnowledgeSourceListing,
} from '@liveworkspace/index-client';
import { callApp, eachLimited } from './app-calls';
import type { Person } from './auth';
import { isId } from './codec';
import type { Env } from './env';
import { badRequest, fail, json, notFound, readObject } from './http';
import { lookupItems } from './lookup';
import { doorsFor, SOURCE_SIGNAL_CONCURRENCY } from './sheet-sources';

// The source apps as one bound parameter.
const SOURCE_APPS = JSON.stringify(KNOWLEDGE_SOURCE_APPS);
// The teams a person names at most, as a delegate's header may.
const TEAMS_MAX = 50;
// A likely look reads at most this many titles before the person's access is checked.
const LIKELY_CANDIDATES = 20;

type Knowledgebase = { id: string; scope: string; team_id: string | null };
type SourceRow = { id: string; app: App; title: string; updated_at: number };

// The knowledgebase a call names: a live liveknowledge item, asked by liveknowledge itself. Anything else is missing.
async function knowledgebaseOf(env: Env, app: App, id: string): Promise<Knowledgebase | null> {
  if (app !== 'liveknowledge') return null;
  const row = await env.INDEX_DB.prepare(
    `SELECT id, scope, team_id FROM items WHERE id = ? AND app = 'liveknowledge' AND trashed_at IS NULL`,
  )
    .bind(id)
    .first<Knowledgebase>();
  return row ?? null;
}

// The folder a call names, when it is a folder of the knowledgebase's own team: a personal knowledgebase, or another
// scope's folder, has none.
async function teamFolderOf(
  env: Env,
  kb: Knowledgebase,
  folderId: unknown,
): Promise<string | null> {
  if (!kb.team_id || !isId(folderId)) return null;
  const row = await env.INDEX_DB.prepare('SELECT scope FROM folders WHERE id = ?')
    .bind(folderId)
    .first<{ scope: string }>();
  return row?.scope === kb.scope ? folderId : null;
}

// The folder and every folder inside it, eight levels at most, as one recursive read.
const FOLDER_TREE = `WITH RECURSIVE tree(id, depth) AS (
    SELECT ?, 0
    UNION ALL
    SELECT f.id, tree.depth + 1 FROM folders f JOIN tree ON f.parent_id = tree.id
     WHERE tree.depth < ${KNOWLEDGE_FOLDER_DEPTH_MAX}
  )`;

// The knowledgebase's sources now: its confirmed connections' live targets in a source app, then the live source-app
// items in its team folder's tree, newest change first, at most KNOWLEDGE_SOURCES_MAX.
export async function knowledgeSources(
  env: Env,
  kb: Knowledgebase,
  folderId: string | null,
): Promise<KnowledgeSourceListing[]> {
  const db = env.INDEX_DB;
  const { results: connected } = await db
    .prepare(
      `SELECT DISTINCT i.id, i.app, i.title, i.updated_at FROM connections c
         JOIN items i ON i.id = c.target_item_id
        WHERE c.host_item_id = ? AND c.confirmed_at IS NOT NULL AND i.trashed_at IS NULL
          AND i.app IN (SELECT value FROM json_each(?))
        ORDER BY i.updated_at DESC LIMIT ?`,
    )
    .bind(kb.id, SOURCE_APPS, KNOWLEDGE_SOURCES_MAX)
    .all<SourceRow>();
  const sources: KnowledgeSourceListing[] = connected.map((row) => listing(row, 'connected'));
  if (folderId && sources.length < KNOWLEDGE_SOURCES_MAX) {
    const { results: filed } = await db
      .prepare(
        `${FOLDER_TREE}
         SELECT i.id, i.app, i.title, i.updated_at FROM items i
          WHERE i.folder_id IN (SELECT id FROM tree) AND i.scope = ? AND i.trashed_at IS NULL
            AND i.app IN (SELECT value FROM json_each(?))
          ORDER BY i.updated_at DESC LIMIT ?`,
      )
      .bind(folderId, kb.scope, SOURCE_APPS, KNOWLEDGE_SOURCES_MAX)
      .all<SourceRow>();
    const seen = new Set(sources.map((s) => s.itemId));
    for (const row of filed) {
      if (sources.length >= KNOWLEDGE_SOURCES_MAX) break;
      if (!seen.has(row.id)) sources.push(listing(row, 'folder'));
    }
  }
  return sources;
}

const listing = (row: SourceRow, origin: 'connected' | 'folder'): KnowledgeSourceListing => ({
  itemId: row.id,
  app: row.app as KnowledgeSourceListing['app'],
  title: row.title,
  updatedAt: row.updated_at,
  origin,
});

// Whether one item is a source of the knowledgebase now (the rule above), with its app; null when it is not.
async function sourceOf(
  env: Env,
  kb: Knowledgebase,
  itemId: string,
  folderId: string | null,
): Promise<App | null> {
  const row = await env.INDEX_DB.prepare(
    `SELECT i.app AS app, i.scope AS scope,
       EXISTS (SELECT 1 FROM connections c WHERE c.host_item_id = ?1 AND c.target_item_id = i.id
                AND c.confirmed_at IS NOT NULL) AS connected,
       ${folderId ? `i.folder_id IN (${FOLDER_TREE.replace('SELECT ?, 0', 'SELECT ?3, 0')} SELECT id FROM tree)` : '0'} AS filed
       FROM items i WHERE i.id = ?2 AND i.trashed_at IS NULL`,
  )
    .bind(kb.id, itemId, ...(folderId ? [folderId] : []))
    .first<{ app: App; scope: string; connected: number; filed: number }>();
  if (!row || !isKnowledgeSourceApp(row.app)) return null;
  if (row.connected) return row.app;
  return row.filed && row.scope === kb.scope ? row.app : null;
}

// The person a reach or likely look is for: an account named by liveknowledge (which checked their token), never a
// guest, with the teams their token named. No app restriction: the routes below confine what they answer to the
// knowledgebase's sources and scope.
function personOf(body: Record<string, unknown>): Person | null {
  const id = body.personId;
  if (!isId(id) || id.startsWith('guest_')) return null;
  const teams = Array.isArray(body.teams) ? body.teams.filter(isId).slice(0, TEAMS_MAX) : [];
  return { id, kind: 'account', teams };
}

const idsOf = (value: unknown, max: number): string[] | null =>
  Array.isArray(value) && value.length <= max && value.every(isId) ? [...new Set(value)] : null;

export async function handleKnowledgeSources(
  request: Request,
  env: Env,
  app: App,
  kbId: string,
  route: string,
): Promise<Response> {
  if (request.method !== 'POST') return notFound();
  const kb = await knowledgebaseOf(env, app, kbId);
  if (!kb) return notFound();
  const body = (await readObject(request)) ?? {};
  const folderId = await teamFolderOf(env, kb, body.folderId);
  if (route === 'knowledge-sources') {
    return json({ sources: await knowledgeSources(env, kb, folderId) });
  }
  if (route === 'knowledge-text') {
    if (!isId(body.itemId)) return badRequest();
    const sourceApp = await sourceOf(env, kb, body.itemId, folderId);
    if (!sourceApp) return notFound();
    try {
      const text = await doorsFor(env).readKnowledgeText(sourceApp, body.itemId);
      return text ? json(text) : notFound();
    } catch (err) {
      console.warn('[index] knowledge-text door failed', {
        app: sourceApp,
        status: err instanceof DoorError ? err.status : 0,
      });
      return fail(503, 'source_unavailable');
    }
  }
  if (route === 'knowledge-reach') return reach(env, kb, body, folderId);
  if (route === 'knowledge-likely') return likely(env, kb, body);
  return notFound();
}

// Which of these items the person can open themselves (/items/lookup's rule), among the knowledgebase's sources and
// the items of its own scope (an Unanswered note's), never one in the Trash.
async function reach(
  env: Env,
  kb: Knowledgebase,
  body: Record<string, unknown>,
  folderId: string | null,
): Promise<Response> {
  const itemIds = idsOf(body.itemIds, ITEM_LOOKUP_IDS_MAX);
  if (!itemIds) return badRequest();
  const person = personOf(body);
  if (!person || itemIds.length === 0) return json({ itemIds: [] });
  const { results } = await env.INDEX_DB.prepare(
    `SELECT i.id FROM items i
      WHERE i.id IN (SELECT value FROM json_each(?1)) AND i.trashed_at IS NULL
        AND i.app IN (SELECT value FROM json_each(?2))
        AND (i.scope = ?3 OR EXISTS (SELECT 1 FROM connections c WHERE c.host_item_id = ?4
              AND c.target_item_id = i.id AND c.confirmed_at IS NOT NULL)
             ${folderId ? `OR i.folder_id IN (${FOLDER_TREE.replace('SELECT ?, 0', 'SELECT ?5, 0')} SELECT id FROM tree)` : ''})`,
  )
    .bind(JSON.stringify(itemIds), SOURCE_APPS, kb.scope, kb.id, ...(folderId ? [folderId] : []))
    .all<{ id: string }>();
  const candidates = results.map((r) => r.id);
  if (candidates.length === 0) return json({ itemIds: [] });
  const reached = await lookupItems(env, person, candidates);
  return json({ itemIds: reached.map((item) => item.id) });
}

// Up to three items of the knowledgebase's scope the person can open, of a source app and not excluded, whose title
// holds any of the words: what an Unanswered question was likely answered in.
async function likely(
  env: Env,
  kb: Knowledgebase,
  body: Record<string, unknown>,
): Promise<Response> {
  const person = personOf(body);
  const words = Array.isArray(body.words)
    ? body.words
        .filter((w): w is string => typeof w === 'string' && w.length >= 3 && w.length <= 40)
        .slice(0, KNOWLEDGE_LIKELY_WORDS_MAX)
    : [];
  const exclude = idsOf(body.exclude, KNOWLEDGE_SOURCES_MAX) ?? [];
  if (!person || words.length === 0) return json({ items: [] });
  // `instr`, never a bound LIKE: D1 refuses a LIKE pattern over 50 bytes, and a word of 40 letters in Chinese or
  // Japanese (a question with no spaces is one word) is 120. `lower` folds ASCII alone, as LIKE did.
  const titleMatch = words.map(() => 'instr(lower(i.title), lower(?)) > 0').join(' OR ');
  const { results } = await env.INDEX_DB.prepare(
    `SELECT i.id, i.app, i.title FROM items i
      WHERE i.scope = ? AND i.trashed_at IS NULL AND i.app IN (SELECT value FROM json_each(?))
        AND i.id NOT IN (SELECT value FROM json_each(?)) AND (${titleMatch})
      ORDER BY i.updated_at DESC LIMIT ?`,
  )
    .bind(kb.scope, SOURCE_APPS, JSON.stringify(exclude), ...words, LIKELY_CANDIDATES)
    .all<{ id: string; app: App; title: string }>();
  if (results.length === 0) return json({ items: [] });
  const reached = new Set(
    (
      await lookupItems(
        env,
        person,
        results.map((r) => r.id),
      )
    ).map((item) => item.id),
  );
  const items: KnowledgeLikelyItem[] = results
    .filter((r) => reached.has(r.id) && isKnowledgeSourceApp(r.app))
    .slice(0, KNOWLEDGE_LIKELY_MAX)
    .map((r) => ({ itemId: r.id, app: r.app as KnowledgeLikelyItem['app'], title: r.title }));
  return json({ items });
}

// ---------- The change signal ------------------------------------------------------------------------------------

type WatchedItem = {
  id: string;
  app: App;
  scope: string;
  team_id: string | null;
  folder_id: string | null;
};

// The knowledgebases reading an item: the live liveknowledge hosts of its confirmed connections, and, for a team's
// item in a folder, the team's live knowledgebases whose source folder is that folder or one above it. At most
// KNOWLEDGE_WATCHERS_MAX. Nothing for an item of an app no knowledgebase reads.
export async function knowledgeWatchers(env: Env, item: WatchedItem): Promise<string[]> {
  if (!isKnowledgeSourceApp(item.app)) return [];
  const db = env.INDEX_DB;
  const { results: hosts } = await db
    .prepare(
      `SELECT DISTINCT c.host_item_id AS id FROM connections c JOIN items h ON h.id = c.host_item_id
        WHERE c.target_item_id = ? AND c.confirmed_at IS NOT NULL AND h.app = 'liveknowledge'
          AND h.trashed_at IS NULL
        LIMIT ?`,
    )
    .bind(item.id, KNOWLEDGE_WATCHERS_MAX)
    .all<{ id: string }>();
  const watchers = new Set(hosts.map((h) => h.id));
  if (item.team_id && item.folder_id && watchers.size < KNOWLEDGE_WATCHERS_MAX) {
    const { results: readers } = await db
      .prepare(
        `WITH RECURSIVE up(id, depth) AS (
           SELECT ?, 0
           UNION ALL
           SELECT f.parent_id, up.depth + 1 FROM folders f JOIN up ON f.id = up.id
            WHERE f.parent_id IS NOT NULL AND up.depth < ${KNOWLEDGE_FOLDER_DEPTH_MAX}
         )
         SELECT i.id FROM items i
          WHERE i.scope = ? AND i.app = 'liveknowledge' AND i.trashed_at IS NULL
            AND json_extract(i.summary, '$.knowledgeFolder') IN (SELECT id FROM up)
          LIMIT ?`,
      )
      .bind(item.folder_id, item.scope, KNOWLEDGE_WATCHERS_MAX)
      .all<{ id: string }>();
    for (const reader of readers) watchers.add(reader.id);
  }
  return [...watchers].slice(0, KNOWLEDGE_WATCHERS_MAX);
}

// Tell each knowledgebase reading the item, ten at a time. A failure costs only freshness: its daily look catches up.
export async function tellKnowledgeWatchers(
  env: Env,
  watchers: readonly string[],
  change: KnowledgeSourceChange,
): Promise<void> {
  await eachLimited([...watchers], SOURCE_SIGNAL_CONCURRENCY, async (kb) => {
    const sent = await callApp(
      env,
      'liveknowledge',
      'POST',
      `/items/${encodeURIComponent(kb)}/knowledge-source-changed`,
      change,
    );
    if (!sent.ok) console.warn('[index] knowledge source signal failed', { error: sent.error });
  });
}

// An item changed (its summary push moved updatedAt on) or went to the Trash: tell the knowledgebases reading it.
export async function signalKnowledgeSources(
  env: Env,
  itemId: string,
  gone = false,
): Promise<void> {
  const item = await env.INDEX_DB.prepare(
    'SELECT id, app, scope, team_id, folder_id FROM items WHERE id = ?',
  )
    .bind(itemId)
    .first<WatchedItem>();
  if (!item || !isKnowledgeSourceApp(item.app)) return;
  const watchers = await knowledgeWatchers(env, item);
  if (watchers.length === 0) return;
  await tellKnowledgeWatchers(env, watchers, {
    app: item.app,
    itemId,
    ...(gone ? { gone: true } : {}),
  });
}
