// An item's rules on its own SQLite (liveworkspace/docs/specs/018-automations/automations.md "A rule", "Where rules
// live and run"; blueprint engine.md "The room entry"). Reads and writes `automation_rules` straight through the
// room's SQL, and keeps `kinds`: the event kinds some rule that is on hears, in memory, rebuilt on every rule write
// and on wake. That set is the whole cost a save pays when the item has no rule that is on: one lookup, no SQL.
// Every rule write also keeps the time triggers' schedule (`automation_schedule`): a time-trigger rule that is on has
// its next moment there, any other rule none.
import {
  AUTOMATION_FAILURES_TO_PAUSE,
  AUTOMATION_RULES_MAX,
  AUTOMATION_RUNS_PER_DAY,
} from '../limits';
import type { AutomationPaused } from '../types';
import { stopWaits } from './automation-waits';
import { forgetFired } from './automation-fired';
import type { Sql } from './sql';

// What the store reads of a rule, whatever kinds an app's rules hold.
export type StoredRule = {
  id: string;
  enabled: boolean;
  trigger: { kind: string };
  edited: { at: number };
  paused?: AutomationPaused<unknown>;
};

// What an app tells the store of its rules: the event kinds a rule's trigger hears, and a time rule's next moment
// after `now` (null for a rule whose trigger is no time).
export interface AutomationStoreKit<Rule extends StoredRule, EventKind extends string> {
  hears: (rule: Rule) => readonly EventKind[];
  nextAt: (rule: Rule, now: number) => number | null;
}

// What a pause names beside its reason: the connection a message's failure names, and what the item lacks.
export type PauseAbout<Rule extends StoredRule> = Omit<
  NonNullable<Rule['paused']>,
  'reason' | 'at'
>;

// The item's own two bounds (liveworkspace/docs/specs/018-automations/automations.md "Runs, limits and loops"): the
// runs it makes a day and the rules it holds, the fixed ones on every tier (Free's rules for a guest's item).
export type AutomationLimits = { runsPerDay: number; rulesMax: number };

/** What the subscription service last said when it refused a run for the owner's month: `at` when, `until` the
 *  month's end, and the numbers to say it in. */
export type RunsUsed = { at: number; until: number; used: number; max: number };

/** A refusal of the month is taken as the month's word for this long: past it the service is asked again, so an
 *  upgrade is heard within the minute. */
export const RUNS_USED_HELD_MS = 60_000;

// Pro off, and a store made without a tier: the limits as they always were.
export const LEGACY_AUTOMATION_LIMITS: AutomationLimits = {
  runsPerDay: AUTOMATION_RUNS_PER_DAY,
  rulesMax: AUTOMATION_RULES_MAX,
};

type Row = { body: string; failures: number };

function parse<Rule>(row: Row): Rule | null {
  try {
    return JSON.parse(row.body) as Rule;
  } catch {
    return null;
  }
}

export class AutomationStore<Rule extends StoredRule, EventKind extends string = string> {
  // The kinds some rule that is on hears; empty for an item with none.
  readonly kinds = new Set<EventKind>();

  private readonly sql: () => Sql;
  // Whether the item's schema exists (an item never started holds no table to ask).
  private readonly ready: () => boolean;
  private readonly kit: AutomationStoreKit<Rule, EventKind>;
  // Called after the time triggers' schedule changed (the room's wake asks again).
  onSchedule: () => void = () => {};
  // The runs claimed since the room woke, by any request: a run whose day's count was read before another claim
  // reads it again, so a wake and a Run Rule at once never pass the day's budget.
  claims = 0;
  // The AI calls asked since the room woke, a rule's or Describe a Rule's: a count read before another ask is read
  // again.
  aiAsks = 0;

  // The owner's month of runs, as the service last refused it (item/run.ts): what the Incoming Webhook and a wake
  // read before asking again. Null while nothing was refused.
  runsUsed: RunsUsed | null = null;

  // The item's limits as its tier holds them now (the room's ItemTier): a read of memory, never a wait.
  private readonly limits: () => AutomationLimits;

  constructor(
    sql: () => Sql,
    ready: () => boolean,
    kit: AutomationStoreKit<Rule, EventKind>,
    limits: () => AutomationLimits = () => LEGACY_AUTOMATION_LIMITS,
  ) {
    this.sql = sql;
    this.ready = ready;
    this.kit = kit;
    this.limits = limits;
  }

  // The runs the item may make a day (UTC): what a run's claim checks, with no await before it.
  get runsPerDay(): number {
    return this.limits().runsPerDay;
  }

  /** The owner's month of runs as last refused, while that is still the word: null once it is old or past. */
  monthUsed(now: number): RunsUsed | null {
    const used = this.runsUsed;
    return used && now < used.until && now - used.at < RUNS_USED_HELD_MS ? used : null;
  }

  // The rules the item may hold. One holding more keeps them all; it takes no new one until it holds fewer.
  get rulesMax(): number {
    return this.limits().rulesMax;
  }

  // The rule's row in the time triggers' schedule, from the rule as it now is: its next moment after `now` for a
  // time trigger that is on, else none; and its Incoming Webhook secret dropped once it is not one.
  private reschedule(rule: Rule | null, id: string, now = Date.now(), before?: Rule | null): void {
    const next = rule && rule.enabled ? this.kit.nextAt(rule, now) : null;
    // An Incoming Webhook secret lives only while the rule is there with that trigger (automation-incoming.ts).
    if (rule?.trigger.kind !== 'incoming_webhook')
      this.sql().exec('DELETE FROM automation_hooks WHERE rule_id = ?', id);
    // What a time rule ran on is its trigger's: gone with the rule, or once its trigger is another kind.
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

  // Each time rule whose moment is past moves on to its next one after `now` (or goes, for a rule off, gone or with
  // no next): a wake that gave up (automation-wake.ts), so no past moment wakes the room again at once.
  advanceDue(now: number): void {
    const rows = this.sql()
      .exec('SELECT rule_id FROM automation_schedule WHERE next_at <= ?', now)
      .toArray() as unknown as { rule_id: string }[];
    for (const { rule_id: id } of rows) {
      const rule = this.get(id);
      const next = rule?.enabled ? this.kit.nextAt(rule, now) : null;
      if (next === null) this.sql().exec('DELETE FROM automation_schedule WHERE rule_id = ?', id);
      else
        this.sql().exec('UPDATE automation_schedule SET next_at = ? WHERE rule_id = ?', next, id);
    }
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

  // The rule's place in a step that takes turns, past the turns runs under way have taken, so two runs at once (two
  // Run Rules) take the next two, never one twice.
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
      for (const kind of this.kit.hears(rule)) this.kinds.add(kind);
  }

  // Every rule, in the list's order.
  list(): Rule[] {
    if (!this.ready()) return [];
    return this.rows()
      .map((row) => parse<Rule>(row))
      .filter((r): r is Rule => r !== null);
  }

  // The rules that are on, in the list's order: the ones a trigger runs.
  enabled(): Rule[] {
    return this.rows('WHERE enabled = 1')
      .map((row) => parse<Rule>(row))
      .filter((r): r is Rule => r !== null);
  }

  get(id: string): Rule | null {
    const row = this.rows('WHERE id = ?', id)[0];
    return row ? parse<Rule>(row) : null;
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
  insert(rule: Rule): void {
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
  update(rule: Rule, failures?: number): void {
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
  // turns the rule off, Paused with the reason (and what the reason names, `about`). Answers whether it paused.
  settle(
    id: string,
    result: 'done' | 'failed',
    reason: string,
    now: number,
    about: PauseAbout<Rule> = {} as PauseAbout<Rule>,
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

  /** Turns the rule off now with the reason on it, whatever its failures: a step in another app whose author lost
   *  access (cross-app.ts). False when it is gone or off already. */
  pauseNow(id: string, reason: string, now: number): boolean {
    const rule = this.get(id);
    if (!rule || !rule.enabled) return false;
    this.update({ ...rule, enabled: false, paused: { reason, at: now } });
    console.info('[automations] paused', { cause: 'access' });
    return true;
  }
}
