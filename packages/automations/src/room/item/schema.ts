// The item engine's tables and SQL triggers (liveworkspace/docs/specs/018-automations/automations.md "Where rules
// live and run"; blueprint item-engine.md "Tables"), as schema steps an app appends to its own: stage 1's, then one
// more. The triggers sit on the app's own `tabs` table and its tab link table, so a tab added, removed or edited
// reaches Automations whatever code path wrote it, with no call site to forget.
//
// Cost when no rule is on: each trigger is gated by `WHEN EXISTS (SELECT 1 FROM automation_hears)`, one probe of an
// empty table per tab write. `automation_hears` holds only the SQL-fed kinds some rule that is on hears (the store
// keeps it: engine.ts sync), so the trigger bodies run only for an item that has such a rule.
//
// `automation_writer` says who is writing while its one row stands (writer.ts): the events queued carry its `who`,
// nothing counts as an edit while `own` is set, and nothing is done at all while `silent` is. `until` ends a window
// a crash left open.
import { AUTOMATION_QUEUE_MAX } from '../../limits';
import { AUTOMATION_SCHEMA_STEPS, type AutomationSchemaStep } from '../automation-schema';

// The app's tables: its tabs, its tab link table, and the link's tab column.
export interface ItemTabTables {
  tabs?: string;
  links: string;
  tabKey?: string;
}

const NAME = /^[a-z_]+$/;

// Now, in milliseconds, as SQLite works it out (no `unixepoch('subsec')` before 3.42).
const NOW = "CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)";
const WRITER = `SELECT 1 FROM automation_writer WHERE until > ${NOW}`;
const hears = (kind: string) => `EXISTS (SELECT 1 FROM automation_hears WHERE kind = '${kind}')`;
const UNLESS_SILENT = `NOT EXISTS (${WRITER} AND silent = 1)`;

export const ITEM_AUTOMATION_TABLES = `
CREATE TABLE IF NOT EXISTS automation_hears (
  kind TEXT PRIMARY KEY
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS automation_writer (
  id     INTEGER PRIMARY KEY CHECK (id = 1),
  who    TEXT    NOT NULL,
  own    INTEGER NOT NULL,
  silent INTEGER NOT NULL,
  until  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS automation_edits (
  tab_id TEXT    PRIMARY KEY,
  at     INTEGER NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS automation_quiet (
  rule_id  TEXT    PRIMARY KEY,
  quiet_ms INTEGER NOT NULL,
  tab      TEXT    NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS automation_settles (
  rule_id TEXT    NOT NULL,
  key     TEXT    NOT NULL,
  due_at  INTEGER NOT NULL,
  data    TEXT    NOT NULL,
  PRIMARY KEY (rule_id, key)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS automation_settles_due ON automation_settles (due_at);
`;

// A tab's edit stamped, and every rule that settles after edits pushed back: on the tab (`key` its id) for a rule
// kept to that tab, on the whole item (`key` '') for any other. Not for a rule's own write.
function editSql(tab: string, stamped: string): string {
  const mine = `${hears('edit')} AND NOT EXISTS (${WRITER} AND own = 1)`;
  return `
  INSERT INTO automation_edits (tab_id, at) SELECT ${stamped}, ${NOW} WHERE ${mine}
    ON CONFLICT (tab_id) DO UPDATE SET at = excluded.at;
  INSERT INTO automation_settles (rule_id, key, due_at, data)
    SELECT rule_id, CASE tab WHEN '' THEN '' ELSE ${tab} END, ${NOW} + quiet_ms, json_object('tab', ${tab})
      FROM automation_quiet WHERE (tab = '' OR tab = ${tab}) AND ${mine}
    ON CONFLICT (rule_id, key) DO UPDATE SET due_at = excluded.due_at, data = excluded.data;`;
}

// A tab added or removed, queued while the queue has room, with the tab's name (a removed tab has none later) and
// whoever the writer's window names.
function queueSql(kind: string, tab: string, tabs: string): string {
  return `
  INSERT INTO automation_queue (event, at)
    SELECT json_patch(
        json_object(
          'id', '${kind}:' || ${tab} || ':' || ${NOW} || ':' || (SELECT COALESCE(MAX(id), 0) FROM automation_queue),
          'kind', '${kind}', 'at', ${NOW}, 'tab', ${tab},
          'data', json_object('tab.name', COALESCE((SELECT name FROM ${tabs} WHERE id = ${tab}), ''))),
        COALESCE((SELECT who FROM automation_writer WHERE until > ${NOW}), '{}')),
      ${NOW}
    WHERE ${hears(kind)} AND (SELECT COUNT(*) FROM automation_queue) < ${AUTOMATION_QUEUE_MAX};`;
}

/** The SQL triggers over the app's tables. Throws on a table name that is not a plain identifier. */
export function itemAutomationTriggers(tables: ItemTabTables): string {
  const { tabs = 'tabs', links, tabKey = 'tab_id' } = tables;
  for (const name of [tabs, links, tabKey])
    if (!NAME.test(name)) throw new Error(`not a table name: ${name}`);
  const gate = `WHEN EXISTS (SELECT 1 FROM automation_hears) AND ${UNLESS_SILENT}`;
  return `
CREATE TRIGGER IF NOT EXISTS automation_tab_added AFTER INSERT ON ${links} ${gate}
BEGIN${queueSql('tab_added', `NEW.${tabKey}`, tabs)}${editSql(`NEW.${tabKey}`, `NEW.${tabKey}`)}
END;
CREATE TRIGGER IF NOT EXISTS automation_tab_removed AFTER DELETE ON ${links} ${gate}
BEGIN${queueSql('tab_removed', `OLD.${tabKey}`, tabs)}${editSql(`OLD.${tabKey}`, "''")}
  DELETE FROM automation_edits WHERE tab_id = OLD.${tabKey};
END;
CREATE TRIGGER IF NOT EXISTS automation_tab_edited AFTER UPDATE OF data, name ON ${tabs} ${gate}
BEGIN${editSql('NEW.id', 'NEW.id')}
END;
`;
}

export type ItemAutomationSchemaStep = {
  name: AutomationSchemaStep['name'] | 'item';
  run: AutomationSchemaStep['run'];
};

/** Every step an app with no cards appends to its room's schema, in order: stage 1's tables, then the item
 *  engine's tables and its triggers over the app's own tab tables. A step, once shipped, is never edited. */
export function itemAutomationSchemaSteps(
  tables: ItemTabTables,
): readonly ItemAutomationSchemaStep[] {
  return [
    ...AUTOMATION_SCHEMA_STEPS,
    { name: 'item', run: `${ITEM_AUTOMATION_TABLES}${itemAutomationTriggers(tables)}` },
  ];
}
