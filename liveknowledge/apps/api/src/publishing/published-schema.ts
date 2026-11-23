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

// A page's pictures and cover (blueprint P31 to P34, Work Tracker 1346): the pictures each published page places,
// the only ones the public site serves; the cover band as drawn; a restyle redrawing every page, as their figures
// and gradient covers are drawn in the style. A page published before this step is marked to be drawn again, so its
// pictures show at the site's next read.
const MEDIA = [
  `CREATE TABLE IF NOT EXISTS published_media (
    image TEXT NOT NULL, tab TEXT NOT NULL, PRIMARY KEY (image, tab)
  )`,
  'CREATE INDEX IF NOT EXISTS published_media_tab ON published_media (tab)',
  // Only a real change: a room's start rewrites the style it already holds.
  `CREATE TRIGGER IF NOT EXISTS published_pages_restyled AFTER UPDATE OF knowledge_style ON document
    WHEN OLD.knowledge_style IS NOT NEW.knowledge_style
    BEGIN INSERT INTO published_dirty (tab)
      SELECT tab FROM published_pages WHERE tab NOT IN (SELECT tab FROM published_dirty); END`,
  'INSERT OR IGNORE INTO published_dirty (tab) SELECT tab FROM published_pages',
];

/** The schema step for a page's pictures (document-schema.ts V42), after V36. Asks before the ALTER, as V16 does, so
 *  it runs again harmlessly. */
export function publishedMediaSchemaStep(exec: Exec): void {
  const columns = (exec('PRAGMA table_info(published_pages)') as { toArray(): { name: unknown }[] })
    .toArray()
    .map((c) => String(c.name));
  if (!columns.includes('cover'))
    exec("ALTER TABLE published_pages ADD COLUMN cover TEXT NOT NULL DEFAULT ''");
  for (const statement of MEDIA) exec(statement);
}
