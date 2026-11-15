// The plan's daily flow counts (docs/specs/026-plan/items.md "Flow counts", blueprint item-store.md "Flow counts"):
// the plan schema's step V29 (plan-schema.ts). One row per card type and status a flow day holds, written only on a
// day something changed; a day with no row reads the last day before it (@liveplanner/items flowCountsOf).
//
// Triggers on `items` keep it, as they keep `item_repeats`, so no write path (a patch, many patches, a create, a copy,
// an import, the migration door, an undo, Empty Trash, a card deleted with its plan) can forget one. Each trigger
// first carries the last stored day's counts into today when today has none, then applies its change; a count that
// reaches 0 is not carried, so a status nobody uses any more stops costing a row. Only a create, a delete, a status
// change or a type change fires one: an edit that changes neither costs the update trigger's two `json_extract`
// reads and nothing more.
//
// The step seeds today's counts from the cards as they stand, so a plan from before starts counting the day it runs
// the step. Every statement is IF NOT EXISTS, and the seed writes only for a plan holding no counts yet, so the step
// runs again harmlessly. Days are UTC (`julianday('now')`, the same within one statement and its triggers).

// Today's flow day, in SQL: whole UTC days since 1970, as flowDayOf numbers them.
const TODAY = `CAST(julianday('now') - 2440587.5 AS INTEGER)`;
const STATUS_OF = (row: 'NEW' | 'OLD') => `COALESCE(json_extract(${row}.fields, '$.status'), '')`;

// Carry the plan's last stored day into today, when that day is before today (today holds nothing yet).
const carry = (row: 'NEW' | 'OLD') => `
  INSERT INTO flow_counts (plan_id, day, type, status, cards)
    SELECT plan_id, ${TODAY}, type, status, cards FROM flow_counts
     WHERE plan_id = ${row}.plan_id AND cards <> 0
       AND day = (SELECT MAX(day) FROM flow_counts WHERE plan_id = ${row}.plan_id)
       AND day < ${TODAY};`;

// Add `delta` cards to today's count of the row's type and status.
const add = (row: 'NEW' | 'OLD', delta: 1 | -1) => `
  INSERT INTO flow_counts (plan_id, day, type, status, cards)
    VALUES (${row}.plan_id, ${TODAY}, ${row}.type, ${STATUS_OF(row)}, ${delta})
    ON CONFLICT (plan_id, day, type, status) DO UPDATE SET cards = flow_counts.cards + excluded.cards;`;

export const FLOW_COUNTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS flow_counts (
  plan_id TEXT    NOT NULL,
  day     INTEGER NOT NULL,
  type    TEXT    NOT NULL,
  status  TEXT    NOT NULL,
  cards   INTEGER NOT NULL,
  PRIMARY KEY (plan_id, day, type, status)
) WITHOUT ROWID;

INSERT INTO flow_counts (plan_id, day, type, status, cards)
  SELECT plan_id, ${TODAY}, type, COALESCE(json_extract(fields, '$.status'), ''), COUNT(*) FROM items
   WHERE NOT EXISTS (SELECT 1 FROM flow_counts f WHERE f.plan_id = items.plan_id)
   GROUP BY plan_id, type, COALESCE(json_extract(fields, '$.status'), '');

CREATE TRIGGER IF NOT EXISTS flow_counts_insert AFTER INSERT ON items
BEGIN${carry('NEW')}${add('NEW', 1)}
END;
CREATE TRIGGER IF NOT EXISTS flow_counts_update AFTER UPDATE OF type, fields ON items
  WHEN NEW.type IS NOT OLD.type
    OR json_extract(NEW.fields, '$.status') IS NOT json_extract(OLD.fields, '$.status')
BEGIN${carry('NEW')}${add('OLD', -1)}${add('NEW', 1)}
END;
CREATE TRIGGER IF NOT EXISTS flow_counts_delete AFTER DELETE ON items
BEGIN${carry('OLD')}${add('OLD', -1)}
END;
`;
