// The knowledge tables of a knowledgebase's Durable Object (docs/specs/030-knowledgebase/blueprints/
// knowledge-package.md "The schema" and "Wiring"): the package's own (`KNOWLEDGE_SCHEMA`: passages and their search
// index, trust, links, reads, questions, conflicts, counters, settings) and the three the room adds to run them.
//
//   - `knowledge_dirty`: the pages whose index is behind their tab. Three triggers on `tabs` fill it, so every write
//     of a tab (a save, a seed, an import, a rename, a swap that won, a delete) marks its page in the write's own
//     transaction, and one that changed nothing marks nothing. `queued` 1 is a page left for the room's alarm (the
//     backfill of tabs that predate the index, a write of more pages than a save settles at once).
//   - `knowledge_pages`: what the index was last built from (`index_hash`, `trust_hash`), so a save whose writing did
//     not change rewrites nothing, and the writing's print at Verify (`verified_print`, changed-since.ts) for
//     "Changed since verified".
//   - `knowledge_work`: what the alarm owes (a conflict check, an email), keyed so asking twice is one row.
import { KNOWLEDGE_SCHEMA } from '@liveknowledge/knowledge';

type Exec = (query: string) => unknown;

// A trigger's own OR IGNORE gives way to the conflict policy of the statement that fired it (SQLite, "ON CONFLICT"),
// and a tab's write is an upsert: so the mark is an insert that selects nothing when the page is already marked.
const mark = (row: 'NEW' | 'OLD') =>
  `INSERT INTO knowledge_dirty (tab)
     SELECT ${row}.id WHERE NOT EXISTS (SELECT 1 FROM knowledge_dirty WHERE tab = ${row}.id)`;

const ROOM_TABLES = [
  `CREATE TABLE IF NOT EXISTS knowledge_dirty (
    tab TEXT PRIMARY KEY, queued INTEGER NOT NULL DEFAULT 0, tries INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS knowledge_pages (
    tab TEXT PRIMARY KEY, index_hash TEXT NOT NULL, trust_hash TEXT NOT NULL,
    chars INTEGER NOT NULL DEFAULT 0, verified_print TEXT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS knowledge_work (
    kind TEXT NOT NULL, key TEXT NOT NULL, due_at INTEGER NOT NULL, payload TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (kind, key)
  )`,
  'CREATE INDEX IF NOT EXISTS knowledge_work_due ON knowledge_work (due_at)',
  `CREATE TRIGGER IF NOT EXISTS knowledge_tab_added AFTER INSERT ON tabs
    BEGIN ${mark('NEW')}; END`,
  `CREATE TRIGGER IF NOT EXISTS knowledge_tab_changed AFTER UPDATE OF data, name ON tabs
    BEGIN ${mark('NEW')}; END`,
  `CREATE TRIGGER IF NOT EXISTS knowledge_tab_removed AFTER DELETE ON tabs
    BEGIN ${mark('OLD')}; END`,
];

/** The schema step (document-schema.ts STEPS). Tabs stored before it are queued for the alarm's backfill: one row
 *  a page here (at most 500), their passages in batches later, never one transaction for a whole knowledgebase. */
export function knowledgeSchemaStep(exec: Exec): void {
  for (const statement of KNOWLEDGE_SCHEMA) exec(statement);
  for (const statement of ROOM_TABLES) exec(statement);
  exec('INSERT OR IGNORE INTO knowledge_dirty (tab, queued) SELECT id, 1 FROM tabs');
}
