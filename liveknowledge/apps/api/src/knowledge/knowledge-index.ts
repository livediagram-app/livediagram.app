// Keeping a knowledgebase's search index, link table and trust rows in step with its tabs
// (docs/specs/030-knowledgebase/search-and-ask.md "Search", links-and-embeds.md "Backlinks"; blueprint "Wiring").
//
// How a write reaches the index. The triggers of knowledge-schema.ts mark a written tab's page in `knowledge_dirty`.
// `withKnowledgeIndex` wraps the hooks the room gives its database (@liveworkspace/index-app item-db.ts): at the end
// of a batch's transaction, inside it, the marked pages are settled, so a save and its page's passages, links and
// trust land together or not at all; a single statement outside a batch (a rename) is settled straight after it, in
// the same synchronous turn, which a Durable Object commits as one. Settling reads the stored tab, so it indexes
// what was stored, whichever route, room op or import wrote it, and a compare-and-swap that lost indexes nothing.
//
// What a settle costs. The page's rows are rewritten only when what they are built from changed: `index_hash` is the
// title, the passages' text hashes and the links; `trust_hash` the verification. A save that moved a picture, a
// rename of nothing, a cursor's op: one read of the tab and one of `knowledge_pages`, no index write.
import {
  articlesOf,
  pageUnits,
  pagesOf,
  type ArticleBlock,
  type Tab,
} from '@liveknowledge/document';
import type { ItemDbHooks, ItemSql } from '@liveworkspace/index-app';
import {
  deletePageIndex,
  pageLinkTargets,
  pagePassages,
  parseKnowledgeFields,
  putPageTrust,
  replacePageIndex,
  reviewDays,
  stableHash,
  writingText,
  type KnowledgeFields,
  type SqlStatement,
} from '@liveknowledge/knowledge';

/** Pages one write settles inside its own transaction; more than this (an import, a restore of a whole
 *  knowledgebase) are left to the alarm, in batches, so no save holds a transaction for 500 pages. */
export const SETTLE_INLINE_MAX = 12;
/** Pages the alarm settles a turn. At 123 passages a page (100,000 characters) that is about 3,000 rows written. */
export const SETTLE_BATCH = 12;
/** A page whose tab cannot be read is tried this many times, then left out of the index until its next write. */
export const SETTLE_MAX_TRIES = 3;

const run = (sql: ItemSql, statement: SqlStatement) =>
  sql.exec(statement.sql, ...statement.params).toArray();

/** The writing of a page: its articles' blocks in the order their pages run. A page holds one article; a tab that
 *  holds more (an import from livedocuments) is read whole. */
export function pageBlocks(tab: Tab): ArticleBlock[] {
  const written = articlesOf(tab);
  const seen = new Set<string>();
  const blocks: ArticleBlock[] = [];
  const take = (flow: string | undefined) => {
    if (!flow || seen.has(flow) || !written[flow]) return;
    seen.add(flow);
    blocks.push(...written[flow].blocks);
  };
  for (const unit of pageUnits(pagesOf(tab))) take(unit.flow);
  // An article no page names is still the page's writing.
  for (const flow of Object.keys(written)) take(flow);
  return blocks;
}

export type PageSource = {
  tab: string;
  title: string;
  blocks: ArticleBlock[];
  fields: KnowledgeFields;
};

/** A stored tab as the index reads it; throws for a body that is not a tab. */
export function pageSourceOf(tab: string, title: string, data: string): PageSource {
  const body = JSON.parse(data) as Tab | null;
  if (!body || typeof body !== 'object') throw new Error('tab body is not an object');
  return { tab, title, blocks: pageBlocks(body), fields: parseKnowledgeFields(body.knowledge) };
}

export const trustHashOf = (fields: KnowledgeFields): string =>
  `${fields.verifiedAt ?? ''}/${reviewDays(fields) ?? ''}`;

// `indexed-trust`: the writing was indexed anew and the page's verification changed with it.
export type SettledPage =
  'indexed' | 'indexed-trust' | 'trust' | 'unchanged' | 'removed' | 'unreadable';

/** A page whose writing was indexed anew, with its passages' hashes as they stood before (for the conflict check's
 *  probes, read only when the knowledgebase has a key: conflicts.ts `conflictProbes`). */
export type IndexedPage = { tab: string; before: { id: string; textHash: string }[] | null };

const hasAiKey = (sql: ItemSql): boolean =>
  sql.exec("SELECT 1 AS held FROM knowledge_settings WHERE name = 'ai_key'").toArray().length > 0;

/** Bring one page's index up to its stored tab. Runs inside the caller's transaction. */
export function settlePage(sql: ItemSql, tab: string, indexed?: IndexedPage[]): SettledPage {
  const row = sql.exec('SELECT name, data FROM tabs WHERE id = ?', tab).toArray()[0] as
    { name: string; data: string } | undefined;
  if (!row) {
    for (const statement of deletePageIndex(tab)) run(sql, statement);
    sql.exec('DELETE FROM knowledge_pages WHERE tab = ?', tab);
    sql.exec("DELETE FROM knowledge_work WHERE kind = 'conflict' AND key = ?", tab);
    return 'removed';
  }
  let source: PageSource;
  try {
    source = pageSourceOf(tab, row.name, row.data);
  } catch {
    return 'unreadable';
  }
  const { title, blocks, fields } = source;
  const passages = pagePassages(tab, { blocks });
  const links = pageLinkTargets({ blocks });
  let chars = 0;
  for (const passage of passages) chars += passage.text.length;
  const indexHash = stableHash(
    title,
    passages.map((p) => p.id + p.textHash).join(''),
    links.join(' '),
  );
  const trustHash = trustHashOf(fields);
  const was = sql
    .exec('SELECT index_hash AS i, trust_hash AS t FROM knowledge_pages WHERE tab = ?', tab)
    .toArray()[0] as { i: string; t: string } | undefined;
  if (was?.i === indexHash && was.t === trustHash) return 'unchanged';
  const trust = { verifiedAt: fields.verifiedAt, reviewDays: reviewDays(fields) };
  const writingChanged = was?.i !== indexHash;
  if (writingChanged && indexed)
    indexed.push({
      tab,
      before: hasAiKey(sql)
        ? (sql
            .exec(
              'SELECT id, text_hash AS textHash FROM passages WHERE tab = ? AND ordinal >= 0',
              tab,
            )
            .toArray() as { id: string; textHash: string }[])
        : null,
    });
  const statements = writingChanged
    ? replacePageIndex({ tab, title, passages, links, trust })
    : [putPageTrust(tab, title, trust)];
  for (const statement of statements) run(sql, statement);
  sql.exec(
    `INSERT INTO knowledge_pages (tab, index_hash, trust_hash, chars) VALUES (?, ?, ?, ?)
       ON CONFLICT (tab) DO UPDATE SET index_hash = excluded.index_hash, trust_hash = excluded.trust_hash,
         chars = excluded.chars`,
    tab,
    indexHash,
    trustHash,
    chars,
  );
  // A page first indexed with no verification has no review to wait for.
  const trustChanged =
    was?.t !== trustHash && (was !== undefined || fields.verifiedAt !== undefined);
  return writingChanged ? (trustChanged ? 'indexed-trust' : 'indexed') : 'trust';
}

/** The writing of a stored page as text (no Markdown syntax), for the print Verify keeps and its comparison. */
export function storedWritingText(sql: ItemSql, tab: string): string | null {
  const row = sql.exec('SELECT name, data FROM tabs WHERE id = ?', tab).toArray()[0] as
    { name: string; data: string } | undefined;
  if (!row) return null;
  try {
    return writingText({ blocks: pageSourceOf(tab, row.name, row.data).blocks });
  } catch {
    return null;
  }
}

/** `trust` counts the pages whose verification or review interval changed. */
export type Settled = { pages: number; indexed: IndexedPage[]; queued: number; trust: number };

// Settle the marked pages of one kind (`queued` 0: this write's; 1: the alarm's), at most `limit`.
function settleMarked(sql: ItemSql, queued: 0 | 1, limit: number): Settled {
  const marked = sql
    .exec('SELECT tab, tries FROM knowledge_dirty WHERE queued = ? LIMIT ?', queued, limit)
    .toArray() as { tab: string; tries: number }[];
  const indexed: IndexedPage[] = [];
  let trust = 0;
  for (const { tab, tries } of marked) {
    const outcome = settlePage(sql, tab, indexed);
    if (outcome === 'trust' || outcome === 'indexed-trust') trust++;
    if (outcome === 'unreadable' && tries + 1 < SETTLE_MAX_TRIES) {
      sql.exec('UPDATE knowledge_dirty SET tries = tries + 1, queued = 1 WHERE tab = ?', tab);
      continue;
    }
    if (outcome === 'unreadable') console.warn('[knowledge] page left out of the index', { tab });
    sql.exec('DELETE FROM knowledge_dirty WHERE tab = ?', tab);
  }
  return { pages: marked.length, indexed, queued: 0, trust };
}

/** Settle what this write marked; pages past SETTLE_INLINE_MAX are queued for the alarm. */
export function settleWrite(sql: ItemSql): Settled {
  const settled = settleMarked(sql, 0, SETTLE_INLINE_MAX);
  if (settled.pages < SETTLE_INLINE_MAX) return settled;
  sql.exec('UPDATE knowledge_dirty SET queued = 1 WHERE queued = 0');
  const left = sql.exec('SELECT COUNT(*) AS n FROM knowledge_dirty WHERE queued = 1').toArray()[0];
  return { ...settled, queued: Number(left?.n ?? 0) };
}

/** The alarm's turn: one batch of queued pages. Answers how many are still queued. */
export function settleQueued(sql: ItemSql, limit = SETTLE_BATCH): Settled {
  const settled = settleMarked(sql, 1, limit);
  const left = sql.exec('SELECT COUNT(*) AS n FROM knowledge_dirty WHERE queued = 1').toArray()[0];
  return { ...settled, queued: Number(left?.n ?? 0) };
}

/** Whether any page waits for the alarm. */
export const hasQueuedPages = (sql: ItemSql): boolean =>
  sql.exec('SELECT 1 AS queued FROM knowledge_dirty WHERE queued = 1 LIMIT 1').toArray().length > 0;

export type KnowledgeIndexEvents = {
  /** Pages were left for the alarm. */
  onQueued?: () => void;
  /** These pages' writing was indexed anew (a conflict check may follow). */
  onIndexed?: (pages: readonly IndexedPage[]) => void;
  /** A page's verification or review interval changed (the review check may have a new date to wait for). */
  onTrust?: () => void;
};

/** The database hooks with the index kept in step (see the head of this file). */
export function withKnowledgeIndex(
  sql: ItemSql,
  hooks: ItemDbHooks,
  events: KnowledgeIndexEvents = {},
): ItemDbHooks {
  const tell = (settled: Settled) => {
    if (settled.queued > 0) events.onQueued?.();
    if (settled.indexed.length > 0) events.onIndexed?.(settled.indexed);
    if (settled.trust > 0) events.onTrust?.();
  };
  return {
    ensureSchema: hooks.ensureSchema,
    transaction: (fn) => {
      let settled: Settled | undefined;
      const result = hooks.transaction(() => {
        const out = fn();
        settled = settleWrite(sql);
        return out;
      });
      if (settled) tell(settled);
      return result;
    },
    // A write outside a batch (a rename, a parent change). After a batch nothing is marked: one read of an empty
    // table.
    onWrite: () => {
      tell(settleWrite(sql));
      hooks.onWrite();
    },
  };
}
