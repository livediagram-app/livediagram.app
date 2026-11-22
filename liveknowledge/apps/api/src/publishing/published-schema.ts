// The published snapshot's tables in a knowledgebase's Durable Object (docs/specs/030-knowledgebase/blueprints/
// publishing.md "Data and persistence"). The public site reads these and nothing else, so nothing unpublished can
// reach it. Triggers mark what a change makes stale, only while a site exists: a page written or removed
// (`published_dirty`), and the name, the style or the order of pages (`published_site.stale`). The next public read
// refreshes what they mark (published-snapshot.ts).
import { SEARCH_TOKENIZER } from '@liveknowledge/knowledge';

type Exec = (query: string) => unknown;

// A trigger's own OR IGNORE gives way to the policy of the statement that fired it (SQLite, "ON CONFLICT"), so the
// mark selects nothing when the page is already marked, or when nothing is published.
const markTab = (row: 'NEW' | 'OLD') =>
  `INSERT INTO published_dirty (tab)
     SELECT ${row}.id WHERE EXISTS (SELECT 1 FROM published_site)
       AND NOT EXISTS (SELECT 1 FROM published_dirty WHERE tab = ${row}.id)`;
const markSite = 'UPDATE published_site SET stale = 1 WHERE stale = 0';

const TABLES = [
  `CREATE TABLE IF NOT EXISTS published_site (
    id INTEGER PRIMARY KEY CHECK (id = 1), address TEXT NOT NULL, root TEXT NULL,
    noindex INTEGER NOT NULL DEFAULT 0, show_writers INTEGER NOT NULL DEFAULT 0,
    published_by TEXT NOT NULL, published_at INTEGER NOT NULL, stale INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS published_pages (
    tab TEXT PRIMARY KEY, address TEXT NOT NULL UNIQUE, parent TEXT NULL, position INTEGER NOT NULL,
    title TEXT NOT NULL, icon TEXT NULL, description TEXT NOT NULL, html TEXT NOT NULL, text TEXT NOT NULL,
    writers TEXT NOT NULL DEFAULT '[]', saved_at INTEGER NOT NULL, links TEXT NOT NULL DEFAULT '{}'
  )`,
  'CREATE INDEX IF NOT EXISTS published_pages_position ON published_pages (position)',
  'CREATE TABLE IF NOT EXISTS published_addresses (address TEXT PRIMARY KEY, tab TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS published_site_addresses (address TEXT PRIMARY KEY, held_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS published_dirty (tab TEXT PRIMARY KEY)',
  // The pages in scope found to hold no saved writing: left out, and not read again until written.
  'CREATE TABLE IF NOT EXISTS published_empty (tab TEXT PRIMARY KEY)',
  `CREATE VIRTUAL TABLE IF NOT EXISTS published_fts USING fts5(
    tab UNINDEXED, title, text, tokenize='${SEARCH_TOKENIZER}'
  )`,
  `CREATE TRIGGER IF NOT EXISTS published_tab_added AFTER INSERT ON tabs BEGIN ${markTab('NEW')}; END`,
  `CREATE TRIGGER IF NOT EXISTS published_tab_changed AFTER UPDATE OF data, name ON tabs
    BEGIN ${markTab('NEW')}; END`,
  `CREATE TRIGGER IF NOT EXISTS published_tab_removed AFTER DELETE ON tabs BEGIN ${markTab('OLD')}; END`,
  `CREATE TRIGGER IF NOT EXISTS published_site_renamed AFTER UPDATE OF name, knowledge_style ON document
    BEGIN ${markSite}; END`,
  `CREATE TRIGGER IF NOT EXISTS published_link_added AFTER INSERT ON document_tabs BEGIN ${markSite}; END`,
  `CREATE TRIGGER IF NOT EXISTS published_link_removed AFTER DELETE ON document_tabs BEGIN ${markSite}; END`,
  `CREATE TRIGGER IF NOT EXISTS published_link_moved AFTER UPDATE OF order_index ON document_tabs
    BEGIN ${markSite}; END`,
];

/** The schema step (document-schema.ts V36). Additive, IF NOT EXISTS. */
export function publishedSchemaStep(exec: Exec): void {
  for (const statement of TABLES) exec(statement);
}
