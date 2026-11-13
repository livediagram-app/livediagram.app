// A plan's rules on its own SQLite (docs/specs/026-plan/automations.md "A rule"; blueprint automations.md "Files",
// "Storage"). Reads and writes `automation_rules` straight through the room's SQL (no write here is a card write), and
// keeps `kinds`: the event kinds some rule that is on hears, in memory, rebuilt on every rule write and on wake. That
// set is the whole cost a save pays when the plan has no rule that is on: one lookup, no SQL
// (db/item-history.ts appendItemHistory). Every rule write also keeps the time triggers' schedule
// (`automation_schedule`): a time-trigger rule that is on has its next moment there, any other rule none.
import {
  AUTOMATION_FAILURES_TO_PAUSE,
  TRIGGER_EVENT_KINDS,
  isTimeTrigger,
  nextMoment,
  type AutomationEventKind,
  type AutomationGone,
  type AutomationRule,
} from '@liveplanner/items';
import { stopWaits } from './automation-waits';
import { forgetFired } from './automation-fired';

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
  // Called after the time triggers' schedule changed (the room's wake asks again).
  onSchedule: () => void = () => {};
  // The runs claimed since the room woke, by any request: a run whose day's count was read before another claim
  // reads it again (automation-runner.ts runRule), so a wake and a Run Rule at once never pass the day's budget.
  claims = 0;
  // The AI calls asked since the room woke, a rule's or Describe a Rule's: a count read before another ask is read
  // again (automation-ai.ts runAiSteps).
  aiAsks = 0;

  constructor(sql: () => Sql, ready: () => boolean) {
    this.sql = sql;
    this.ready = ready;
  }

  // The rule's row in the time triggers' schedule, from the rule as it now is: its next moment after `now` for a
  // time trigger that is on, else none; and its Incoming Webhook secret dropped once it is not one.
  private reschedule(
    rule: AutomationRule | null,
    id: string,
    now = Date.now(),
    before?: AutomationRule | null,
  ): void {
    const next =
      rule && rule.enabled && isTimeTrigger(rule.trigger)
        ? nextMoment(rule.trigger, rule.timeZone, now)
        : null;
    // An Incoming Webhook secret lives only while the rule is there with that trigger (automation-incoming.ts).
    if (rule?.trigger.kind !== 'incoming_webhook')
      this.sql().exec('DELETE FROM automation_hooks WHERE rule_id = ?', id);
    // The cards a time rule ran on are its trigger's: gone with the rule, or once its trigger is another kind.
    if (!rule || (before && before.trigger.kind !== rule.trigger.kind)) forgetFired(this.sql(), id);
    if (next === null) this.sql().exec('DELETE FROM automation_schedule WHERE rule_id = ?', id);
    else
      this.sql().exec(
        `INSERT INTO automation_schedule (rule_id, next_at) VALUES (?, ?)
         ON CONFLICT (rule_id) DO UPDATE SET next_at = excluded.next_at`,
        id,
        next,
      );
    this.onSchedule();
  }

  // Each time rule's next moment, by rule id, for the Rules list's "Next: Mon 9:00".
  nextAts(): Map<string, number> {
    if (!this.ready()) return new Map();
    const rows = this.sql()
      .exec('SELECT rule_id, next_at FROM automation_schedule')
      .toArray() as unknown as { rule_id: string; next_at: number }[];
    return new Map(rows.map((r) => [r.rule_id, Number(r.next_at)]));
  }

  // Turns runs under way have taken, by rule (in memory: a run settles before the room sleeps).
  private readonly taken = new Map<string, number>();

  // The rule's place in Assign in Turn's list, past the turns runs under way have taken, so two runs at once (two
  // Run Rules) assign the next two people, never one twice.
  turn(id: string): number {
    const row = this.sql().exec('SELECT turn FROM automation_rules WHERE id = ?', id).toArray()[0];
    return Number(row?.['turn'] ?? 0) + (this.taken.get(id) ?? 0);
  }

  // A run under way takes `turns`, read and planned with no await between; it gives them back as it settles.
  take(id: string, turns: number): void {
    if (turns > 0) this.taken.set(id, (this.taken.get(id) ?? 0) + turns);
  }

  giveBack(id: string, turns: number): void {
    if (turns <= 0) return;
    const left = (this.taken.get(id) ?? 0) - turns;
    if (left > 0) this.taken.set(id, left);
    else this.taken.delete(id);
  }

  // A done run took `turns` turns: the next run starts that far on.
  advanceTurn(id: string, turns: number): void {
    if (turns > 0)
      this.sql().exec('UPDATE automation_rules SET turn = turn + ? WHERE id = ?', turns, id);
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
    this.reschedule(rule, rule.id);
  }

  // A rule as written now. `failures`: set it too (Resume and a matched run clear it).
  update(rule: AutomationRule, failures?: number): void {
    const before = this.get(rule.id);
    this.sql().exec(
      `UPDATE automation_rules SET body = ?, enabled = ?, failures = COALESCE(?, failures) WHERE id = ?`,
      JSON.stringify(rule),
      rule.enabled ? 1 : 0,
      failures ?? null,
      rule.id,
    );
    // A Wait's held runs go on only for the rule as it was when they waited, and only while it stays on.
    if (!rule.enabled || before?.edited.at !== rule.edited.at) stopWaits(this.sql(), rule.id);
    this.load();
    this.reschedule(rule, rule.id, Date.now(), before);
  }

  remove(id: string): boolean {
    const gone =
      this.sql().exec('DELETE FROM automation_rules WHERE id = ? RETURNING id', id).toArray()
        .length > 0;
    stopWaits(this.sql(), id);
    this.load();
    this.reschedule(null, id);
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
  // turns the rule off, Paused with the reason (and the webhook, when a message's failure paused it, for Fix
  // Webhook). Answers whether it paused.
  settle(
    id: string,
    result: 'done' | 'failed',
    reason: string,
    now: number,
    // The webhook a message's failure names (for Fix Webhook), and what a reason names that the plan lacks.
    about: { webhook?: string; gone?: AutomationGone } = {},
  ): boolean {
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
    this.update({ ...rule, enabled: false, paused: { reason, at: now, ...about } }, failures);
    console.info('[automations] paused', { failures });
    return true;
  }
}
