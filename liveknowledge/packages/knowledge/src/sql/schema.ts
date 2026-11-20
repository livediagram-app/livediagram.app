// The tables a knowledgebase keeps beside its tabs, in its own Durable Object's SQLite
// (docs/specs/030-knowledgebase/blueprints/knowledge-package.md "The schema"). Every statement is idempotent
// (`IF NOT EXISTS`), so the room runs the list each time it wakes, as it does its own schema.

/** A page's title is indexed as a row of its own with this ordinal, before its passages (0 onward). */
export const TITLE_ORDINAL = -1;

/** The tokenizer of the search index: Unicode words, diacritics folded, English stems (FTS5's porter). */
export const SEARCH_TOKENIZER = 'porter unicode61 remove_diacritics 2';

export const KNOWLEDGE_SCHEMA: readonly string[] = [
  // A page's title row (ordinal -1, `title` set, `text` empty) and its passages (ordinal 0 onward, `title` empty,
  // `text` set). One table, so one FTS5 index ranks both and a title's words only ever match the title row.
  `CREATE TABLE IF NOT EXISTS passages (
    id TEXT PRIMARY KEY,
    tab TEXT NOT NULL,
    ordinal INTEGER NOT NULL,
    headings TEXT NOT NULL,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    text_hash TEXT NOT NULL,
    first_block TEXT NOT NULL,
    last_block TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS passages_tab ON passages (tab, ordinal)`,
  // External content: the index holds the words, the text stays once, in `passages`.
  `CREATE VIRTUAL TABLE IF NOT EXISTS passages_fts USING fts5(
    title, text, content='passages', content_rowid='rowid', tokenize='${SEARCH_TOKENIZER}'
  )`,
  // What search needs of a page without reading its tab: its title and when it was verified. When its review is due
  // is not stored: the knowledgebase's Review Period is bound to each read (verification.md "The Review Period").
  `CREATE TABLE IF NOT EXISTS page_trust (
    tab TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    verified_at INTEGER
  )`,
  // The count of pages a period makes due, and the pages due, are a range of this index.
  `CREATE INDEX IF NOT EXISTS page_trust_verified ON page_trust (verified_at)`,
  `CREATE TABLE IF NOT EXISTS page_links (
    from_tab TEXT NOT NULL,
    to_tab TEXT NOT NULL,
    PRIMARY KEY (from_tab, to_tab)
  )`,
  `CREATE INDEX IF NOT EXISTS page_links_to ON page_links (to_tab)`,
  // `agent` is '' for a person: no reader's identity is kept beyond an agent's name.
  `CREATE TABLE IF NOT EXISTS page_reads (
    day TEXT NOT NULL,
    tab TEXT NOT NULL,
    reader_kind TEXT NOT NULL,
    agent TEXT NOT NULL DEFAULT '',
    reads INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, tab, reader_kind, agent)
  )`,
  `CREATE TABLE IF NOT EXISTS questions (
    key TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    asked INTEGER NOT NULL DEFAULT 0,
    people INTEGER NOT NULL DEFAULT 0,
    first_at INTEGER NOT NULL,
    last_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS question_agents (
    key TEXT NOT NULL,
    agent TEXT NOT NULL,
    asked INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (key, agent)
  )`,
  // `state` is 'open' or 'dismissed' ("Not a Conflict": the row stays, so the pair is never raised again).
  `CREATE TABLE IF NOT EXISTS conflicts (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    a_passage TEXT NOT NULL,
    a_tab TEXT NOT NULL,
    a_hash TEXT NOT NULL,
    b_passage TEXT NOT NULL,
    b_tab TEXT NOT NULL,
    b_hash TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'open',
    found_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS conflicts_a ON conflicts (a_tab)`,
  `CREATE INDEX IF NOT EXISTS conflicts_b ON conflicts (b_tab)`,
  // Counts inside a window of time, for the rate limits the room checks (Ask, conflict checks): `scope` names who
  // or what is counted, `period` the window (an hour or a day, UTC).
  `CREATE TABLE IF NOT EXISTS usage_counters (
    scope TEXT NOT NULL,
    period TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (scope, period)
  )`,
  // When each page was last checked for conflicts (once per page per 10 minutes).
  `CREATE TABLE IF NOT EXISTS conflict_checks (
    tab TEXT PRIMARY KEY,
    checked_at INTEGER NOT NULL
  )`,
  // The knowledgebase's AI settings by name: the sealed key (key-seal.ts), its hint and the model.
  `CREATE TABLE IF NOT EXISTS knowledge_settings (
    name TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];
