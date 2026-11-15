// The plan fields budget's running total (docs/specs/026-plan/items.md "Limits", blueprint item-store.md "Performance
// and limits"): the plan schema's step V31 (plan-schema.ts). `plan.items_bytes` holds every card's stored fields bytes
// together, so a write can ask whether the plan has room without reading every card.
//
// Triggers on `items` keep it, as they keep the flow counts, so no write path (a create, many patches, an import, a
// form response, an automation, a repeat's copy, a copy, the migration door, Anonymise, Empty Trash, a card deleted
// with its plan) can forget it. An update that leaves the fields' size alone (a move's rank, most status changes of
// the same length) costs the guard's two lengths and nothing more.
//
// SQLite has no ADD COLUMN IF NOT EXISTS, so the step asks first; the seed sums the cards as they stand, and the
// triggers are IF NOT EXISTS, so it runs again harmlessly.

type Exec = (query: string) => { toArray(): Record<string, unknown>[] };

const BYTES_OF = (row: 'NEW' | 'OLD') => `length(CAST(${row}.fields AS BLOB))`;

export const ITEMS_BYTES_TRIGGERS = `
CREATE TRIGGER IF NOT EXISTS items_bytes_insert AFTER INSERT ON items
BEGIN
  UPDATE plan SET items_bytes = items_bytes + ${BYTES_OF('NEW')} WHERE id = NEW.plan_id;
END;
CREATE TRIGGER IF NOT EXISTS items_bytes_update AFTER UPDATE OF fields ON items
  WHEN ${BYTES_OF('NEW')} <> ${BYTES_OF('OLD')}
BEGIN
  UPDATE plan SET items_bytes = items_bytes + ${BYTES_OF('NEW')} - ${BYTES_OF('OLD')} WHERE id = NEW.plan_id;
END;
CREATE TRIGGER IF NOT EXISTS items_bytes_delete AFTER DELETE ON items
BEGIN
  UPDATE plan SET items_bytes = items_bytes - ${BYTES_OF('OLD')} WHERE id = OLD.plan_id;
END;
`;

export function itemsBytesStep(exec: Exec): void {
  const columns = exec('PRAGMA table_info(plan)').toArray();
  if (!columns.some((c) => c.name === 'items_bytes')) {
    exec('ALTER TABLE plan ADD COLUMN items_bytes INTEGER NOT NULL DEFAULT 0');
    exec(
      `UPDATE plan SET items_bytes =
         (SELECT COALESCE(SUM(length(CAST(fields AS BLOB))), 0) FROM items WHERE items.plan_id = plan.id)`,
    );
  }
  exec(ITEMS_BYTES_TRIGGERS);
}
