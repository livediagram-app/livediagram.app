// A plan's rules on its own SQLite (docs/specs/026-plan/automations.md "A rule"; blueprint automations.md "Files",
// "Storage"). Reads and writes `automation_rules` straight through the room's SQL (no write here is a card write), and
// keeps `kinds`: the event kinds some rule that is on hears, in memory, rebuilt on every rule write and on wake. That
// set is the whole cost a save pays when the plan has no rule that is on: one lookup, no SQL
// (db/item-history.ts appendItemHistory).
import {
  AUTOMATION_FAILURES_TO_PAUSE,
  TRIGGER_EVENT_KINDS,
  type AutomationEventKind,
  type AutomationRule,
} from '@liveplanner/items';

export type Sql = Pick<SqlStorage, 'exec'>;

type Row = { body: string; failures: number };

function parse(row: Row): AutomationRule | null {
  try {
    return JSON.parse(row.body) as AutomationRule;
  } catch {
    return null;
  }
}

export class AutomationStore {
  // The kinds some rule that is on hears; empty for a plan with none.
  readonly kinds = new Set<AutomationEventKind>();

  private readonly sql: () => Sql;
  // Whether the plan's schema exists (a plan never started holds no table to ask).
  private readonly ready: () => boolean;

  constructor(sql: () => Sql, ready: () => boolean) {
    this.sql = sql;
    this.ready = ready;
  }

  private rows(where = '', ...bindings: unknown[]): Row[] {
    return this.sql()
      .exec(
        `SELECT body, failures FROM automation_rules ${where} ORDER BY position, id`,
        ...bindings,
      )
      .toArray() as unknown as Row[];
  }

  // `kinds` from what is stored: on wake, and after every rule write.
  load(): void {
    this.kinds.clear();
    if (!this.ready()) return;
    for (const rule of this.enabled())
      for (const kind of TRIGGER_EVENT_KINDS[rule.trigger.kind]) this.kinds.add(kind);
  }

  // Every rule, in the list's order.
  list(): AutomationRule[] {
    if (!this.ready()) return [];
    return this.rows()
      .map(parse)
      .filter((r): r is AutomationRule => r !== null);
  }

  // The rules that are on, in the list's order: the ones a trigger runs.
  enabled(): AutomationRule[] {
    return this.rows('WHERE enabled = 1')
      .map(parse)
      .filter((r): r is AutomationRule => r !== null);
  }

  get(id: string): AutomationRule | null {
    const row = this.rows('WHERE id = ?', id)[0];
    return row ? parse(row) : null;
  }

  // How many runs in a row a rule has failed.
  failures(id: string): number {
    return this.rows('WHERE id = ?', id)[0]?.failures ?? 0;
  }

  count(): number {
    const row = this.sql().exec('SELECT COUNT(*) AS n FROM automation_rules').toArray()[0];
    return Number(row?.['n'] ?? 0);
  }

  // A new rule, last in the list.
  insert(rule: AutomationRule): void {
    this.sql().exec(
      `INSERT INTO automation_rules (id, body, enabled, position, failures)
       VALUES (?, ?, ?, COALESCE((SELECT MAX(position) + 1 FROM automation_rules), 0), 0)`,
      rule.id,
      JSON.stringify(rule),
      rule.enabled ? 1 : 0,
    );
    this.load();
  }

  // A rule as written now. `failures`: set it too (Resume and a matched run clear it).
  update(rule: AutomationRule, failures?: number): void {
    this.sql().exec(
      `UPDATE automation_rules SET body = ?, enabled = ?, failures = COALESCE(?, failures) WHERE id = ?`,
      JSON.stringify(rule),
      rule.enabled ? 1 : 0,
      failures ?? null,
      rule.id,
    );
    this.load();
  }

  remove(id: string): boolean {
    const gone =
      this.sql().exec('DELETE FROM automation_rules WHERE id = ? RETURNING id', id).toArray()
        .length > 0;
    this.load();
    return gone;
  }

  // The list in the order given; `ids` must name every rule once.
  order(ids: readonly string[]): boolean {
    const held = this.list().map((r) => r.id);
    if (ids.length !== held.length || new Set(ids).size !== ids.length) return false;
    if (ids.some((id) => !held.includes(id))) return false;
    ids.forEach((id, i) =>
      this.sql().exec('UPDATE automation_rules SET position = ? WHERE id = ?', i, id),
    );
    return true;
  }

  // A run's result on its rule's count: a done run clears it, a failed one adds one, and the tenth failure in a row
  // turns the rule off, Paused with the reason. Answers whether it paused.
  settle(id: string, result: 'done' | 'failed', reason: string, now: number): boolean {
    const rule = this.get(id);
    if (!rule) return false;
    if (result === 'done') {
      if (this.failures(id) > 0) this.update(rule, 0);
      return false;
    }
    const failures = this.failures(id) + 1;
    if (failures < AUTOMATION_FAILURES_TO_PAUSE || !rule.enabled) {
      this.sql().exec('UPDATE automation_rules SET failures = ? WHERE id = ?', failures, id);
      return false;
    }
    this.update({ ...rule, enabled: false, paused: { reason, at: now } }, failures);
    console.info('[automations] paused', { failures });
    return true;
  }
}
