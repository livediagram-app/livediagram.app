// A card's comment threads in the plan's SQLite (docs/specs/026-plan/items.md "Comments", blueprint item-store.md
// "Comments"): the plan schema's step V7 (plan-schema.ts), its own module so the SQL that moves a card's old single
// thread is written once and used twice.
//
// A thread is stored once, in its home plan (`card_threads`, plan_id the home); each card it is on, in this plan or
// another, names it by a link in the card's own plan (`card_thread_links`, `home` the plan storing it).
// `open_comments` keeps the thread's comment count while it is open (0 resolved), so a face drawn without the
// thread (a thumbnail, an agent's listing) counts it. A card's old single thread (`fields.comments`) becomes its
// first thread: here, for what the plan holds, and by `items_legacy_thread` for one that lands later in that shape
// (a copy, an import, the migration door, an old restore). Either way its title is '' (worked out on read,
// @liveplanner/project threadTitle) and its id `c-<card id>`, so moving it twice is a no-op.

// The thread and the link made from rows of `src` (an alias with plan_id, id, item_key, fields, updated_at).
const legacyThreadRows = (src: string, from: string) => `
INSERT OR IGNORE INTO card_threads
  (plan_id, id, title, resolved, resolved_at, comments, created_at, created_by, updated_at, rev, cards)
SELECT ${src}.plan_id, 'c-' || ${src}.id, '',
       CASE WHEN ${src}.fields ->> '$.comments.resolved' THEN 1 ELSE 0 END,
       CASE WHEN ${src}.fields ->> '$.comments.resolved'
            THEN ${src}.fields ->> '$.comments.comments[#-1].createdAt' END,
       ${src}.fields -> '$.comments.comments',
       COALESCE(${src}.fields ->> '$.comments.comments[0].createdAt', ${src}.updated_at),
       json_object('name', COALESCE(${src}.fields ->> '$.comments.comments[0].authorName', 'Someone'),
                   'color', COALESCE(${src}.fields ->> '$.comments.comments[0].authorColor', '#94a3b8'),
                   'authorId', ${src}.fields ->> '$.comments.comments[0].authorId'),
       MAX(COALESCE(${src}.fields ->> '$.comments.comments[#-1].createdAt', 0),
           COALESCE(${src}.fields ->> '$.comments.comments[0].createdAt', 0)),
       1,
       json_array(json_object('projectId', ${src}.plan_id, 'itemId', ${src}.id, 'key', ${src}.item_key))
  ${from} AND ${hasLegacyThread(src)};
INSERT OR IGNORE INTO card_thread_links (plan_id, item_id, thread_id, home, added_at, open_comments)
SELECT ${src}.plan_id, ${src}.id, 'c-' || ${src}.id, ${src}.plan_id, ${src}.updated_at,
       CASE WHEN ${src}.fields ->> '$.comments.resolved' THEN 0
            ELSE json_array_length(${src}.fields, '$.comments.comments') END
  ${from} AND ${hasLegacyThread(src)};`;

const hasLegacyThread = (src: string) =>
  `json_type(${src}.fields, '$.comments.comments') = 'array' AND json_array_length(${src}.fields, '$.comments.comments') > 0`;

// The new row of an insert, as a one-row table the shared statements read.
const NEW_ROW = `FROM (SELECT NEW.plan_id AS plan_id, NEW.id AS id, NEW.item_key AS item_key, NEW.fields AS fields,
                              NEW.updated_at AS updated_at) n WHERE 1`;

const linkOutbox = (row: 'NEW' | 'OLD', event: 'INSERT' | 'UPDATE' | 'DELETE') => `
CREATE TRIGGER IF NOT EXISTS outbox_cards_thread_link_${event.toLowerCase()} AFTER ${event} ON card_thread_links
BEGIN
  DELETE FROM outbox WHERE plan_id = ${row}.plan_id AND kind = 'tab' AND key = '~cards';
  INSERT INTO outbox (plan_id, kind, key) VALUES (${row}.plan_id, 'tab', '~cards');
END;`;

export const CARD_THREADS_SCHEMA = `
CREATE TABLE IF NOT EXISTS card_threads (
  plan_id     TEXT    NOT NULL REFERENCES plan (id) ON DELETE CASCADE,
  id          TEXT    NOT NULL,
  title       TEXT    NOT NULL DEFAULT '',
  resolved    INTEGER NOT NULL DEFAULT 0,
  resolved_by TEXT    NULL,
  resolved_at INTEGER NULL,
  comments    TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  created_by  TEXT    NOT NULL,
  updated_at  INTEGER NOT NULL,
  rev         INTEGER NOT NULL DEFAULT 1,
  cards       TEXT    NOT NULL,
  PRIMARY KEY (plan_id, id)
);

CREATE TABLE IF NOT EXISTS card_thread_links (
  plan_id       TEXT    NOT NULL REFERENCES plan (id) ON DELETE CASCADE,
  item_id       TEXT    NOT NULL,
  thread_id     TEXT    NOT NULL,
  home          TEXT    NOT NULL,
  added_at      INTEGER NOT NULL,
  open_comments INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (plan_id, item_id, thread_id)
);
CREATE INDEX IF NOT EXISTS card_thread_links_thread ON card_thread_links (plan_id, thread_id);
${linkOutbox('NEW', 'INSERT')}
${linkOutbox('NEW', 'UPDATE')}
${linkOutbox('OLD', 'DELETE')}

${legacyThreadRows('i', 'FROM items i WHERE 1')}
UPDATE items SET fields = json_remove(fields, '$.comments') WHERE json_type(fields, '$.comments') IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS items_legacy_thread AFTER INSERT ON items
  WHEN json_type(NEW.fields, '$.comments') IS NOT NULL
BEGIN
  ${legacyThreadRows('n', NEW_ROW)}
  UPDATE items SET fields = json_remove(fields, '$.comments') WHERE plan_id = NEW.plan_id AND id = NEW.id;
END;

-- A card gone for good takes its links with it (the route tells each thread's home first).
CREATE TRIGGER IF NOT EXISTS items_threads_gone AFTER DELETE ON items
BEGIN
  DELETE FROM card_thread_links WHERE plan_id = OLD.plan_id AND item_id = OLD.id;
END;
`;
