// The triggers waiting for a plan's alarm (docs/specs/026-plan/automations.md "Runs, limits and loops"; blueprint
// automations.md "The event"). A landed card write's events go into `automation_queue` in the same batch as its
// history entry (db/item-history.ts), a new comment's on its own (the thread routes), and only for the kinds some rule
// that is on hears: a plan with none builds no event and runs no statement. At most AUTOMATION_QUEUE_MAX wait; a
// burst past it drops the newest, which the next wake logs once. `AutomationSchedule` is the wake the queue asks for,
// as RepeatSchedule is the repeats'; `PlanAutomations` is what the room puts on its env for the writes and routes.
import {
  AUTOMATION_QUEUE_MAX,
  eventOfWrite,
  type AutomationEvent,
  type AutomationEventKind,
  type AutomationRole,
  type Item,
  type ItemHistoryChange,
  type ItemHistoryTag,
} from '@liveplanner/items';
import type { PlanEnv } from '../../types';
import type { RunnerDeps } from './automation-runner';
import { AutomationStore, type Sql } from './automation-store';

// Who made a write and why, as the write's caller knows it. `role` may be worked out only when an event is built
// (an Editor check the caller would otherwise not make); absent, the history tag says.
export type HistorySource = {
  role?: AutomationRole | (() => Promise<AutomationRole>);
  // The rule that made the change, and the chain so far (its run's).
  rule?: string;
  chain?: number;
  // The Form tab whose response made the card.
  form?: string;
  // A run a GitHub trigger started: its card writes are tagged 'automation_github' (drawn as GitHub's).
  via?: 'github';
};

// What a plan's writes ask of its Automations: the kinds its rules hear (the hot-path check), and a wake once
// events are queued (with how many the queue had no room for).
export interface AutomationsHook {
  readonly kinds: ReadonlySet<AutomationEventKind>;
  queued(dropped: number): void;
}

// A write's role when its caller named none: from the history tag.
export function roleOfTag(tag: ItemHistoryTag | undefined): AutomationRole {
  if (tag === 'ai') return 'agent';
  if (tag === 'automation' || tag === 'automation_github') return 'automation';
  return tag === 'form' || tag === 'repeat' ? 'system' : 'editor';
}

// The events the landed writes make that some rule hears, their role settled once. Called only when `kinds` holds
// a kind.
export async function eventsOfWrites(
  kinds: ReadonlySet<AutomationEventKind>,
  writes: readonly { before: Item | null; after: Item; changes: readonly ItemHistoryChange[] }[],
  tag: ItemHistoryTag | undefined,
  source: HistorySource = {},
): Promise<AutomationEvent[]> {
  const out: AutomationEvent[] = [];
  const base = {
    role: 'editor' as AutomationRole,
    ...(source.rule !== undefined ? { rule: source.rule, chain: source.chain ?? 0 } : {}),
    ...(source.form !== undefined ? { form: source.form } : {}),
  };
  for (const w of writes) {
    const event = eventOfWrite(w.before, w.after, w.changes, base);
    if (event && kinds.has(event.kind)) out.push(event);
  }
  if (out.length === 0) return out;
  const role =
    typeof source.role === 'function' ? await source.role() : (source.role ?? roleOfTag(tag));
  for (const e of out) e.role = role;
  return out;
}

// The insert of `events`, as many as the queue has room for: its `meta.changes` says how many went in.
export function enqueueStatement(
  db: D1Database,
  events: readonly AutomationEvent[],
  now: number,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO automation_queue (event, at) SELECT value, ? FROM json_each(?)
        LIMIT MAX(0, ? - (SELECT COUNT(*) FROM automation_queue))`,
    )
    .bind(now, JSON.stringify(events.map((e) => JSON.stringify(e))), AUTOMATION_QUEUE_MAX);
}

// A comment's event (or a resolve's that left a card no open thread), when some rule hears it: queued on its own,
// and the room asked for a wake.
export async function enqueueComment(
  env: Pick<PlanEnv, 'PLAN_DB' | 'AUTOMATIONS'>,
  event: Omit<AutomationEvent, 'kind' | 'at'>,
  kind: 'comment' | 'resolved' = 'comment',
): Promise<void> {
  const hook = env.AUTOMATIONS;
  if (!hook?.kinds.has(kind)) return;
  const now = Date.now();
  try {
    const res = await enqueueStatement(env.PLAN_DB, [{ ...event, kind, at: now }], now).run();
    hook.queued(1 - (res.meta.changes ?? 0));
  } catch (error) {
    console.warn('[automations] enqueue.failed', { error: String(error) });
  }
}

// The wake the queue asks for (now while a trigger waits, else none), and the time triggers' (their earliest
// `next_at`, one indexed MIN read, none when no time rule is on).
export class AutomationSchedule {
  at: number | null = null;
  timeAt: number | null = null;
  // Triggers the queue had no room for since the last wake (one Skipped line says so).
  dropped = 0;

  private readonly sql: () => Sql;
  private readonly ready: () => boolean;

  constructor(sql: () => Sql, ready: () => boolean) {
    this.sql = sql;
    this.ready = ready;
  }

  waiting(): boolean {
    return (
      this.ready() && this.sql().exec('SELECT 1 FROM automation_queue LIMIT 1').toArray().length > 0
    );
  }

  // After a wake (the object restarted): now when a trigger waits, and the time triggers' next moment.
  restore(now: number): void {
    this.at = this.waiting() ? now : null;
    this.restoreTimes();
  }

  // The earliest time-trigger moment stored, or a waiting run's.
  restoreTimes(): void {
    if (!this.ready()) {
      this.timeAt = null;
      return;
    }
    // With the waiting runs' (a Wait's) earliest moment: one indexed MIN read each.
    const row = this.sql()
      .exec(
        `SELECT MIN(at) AS at FROM (SELECT MIN(next_at) AS at FROM automation_schedule
           UNION ALL SELECT MIN(at) FROM automation_waiting)`,
      )
      .toArray()[0];
    this.timeAt = typeof row?.['at'] === 'number' ? row['at'] : null;
  }

  // The room's wake: the earlier of the two.
  get wakeAt(): number | null {
    if (this.at === null) return this.timeAt;
    return this.timeAt === null ? this.at : Math.min(this.at, this.timeAt);
  }

  timeDue(now: number): boolean {
    return this.timeAt !== null && this.timeAt <= now;
  }

  queueDue(now: number): boolean {
    return this.at !== null && this.at <= now;
  }

  // Events were queued: a wake now. Whether the alarm needs arming.
  queued(now: number): boolean {
    if (this.at !== null && this.at <= now) return false;
    this.at = now;
    return true;
  }

  due(now: number): boolean {
    return this.queueDue(now) || this.timeDue(now);
  }

  clear(): void {
    this.at = null;
    this.timeAt = null;
    this.dropped = 0;
  }

  // The oldest waiting triggers, up to `n`.
  next(n: number): { id: number; event: AutomationEvent | null }[] {
    return this.sql()
      .exec('SELECT id, event FROM automation_queue ORDER BY id LIMIT ?', n)
      .toArray()
      .map((row) => {
        const r = row as unknown as { id: number; event: string };
        let event: AutomationEvent | null = null;
        try {
          event = JSON.parse(r.event) as AutomationEvent;
        } catch {
          // A row from a later release, or a damaged one: dropped like a done one.
        }
        return { id: Number(r.id), event };
      });
  }

  done(id: number): void {
    this.sql().exec('DELETE FROM automation_queue WHERE id = ?', id);
  }
}

// A plan's Automations as its room holds them: the rules, the queue's wake, the hook its writes call, and what a
// run needs from the room (null while it holds no plan), for the wake and the routes alike.
export class PlanAutomations implements AutomationsHook {
  readonly store: AutomationStore;
  readonly schedule: AutomationSchedule;
  readonly sql: () => Sql;
  readonly deps: () => RunnerDeps | null;
  private readonly arm: () => void;

  constructor(
    sql: () => Sql,
    ready: () => boolean,
    arm: () => void,
    deps: () => RunnerDeps | null,
  ) {
    this.sql = sql;
    this.store = new AutomationStore(sql, ready);
    this.schedule = new AutomationSchedule(sql, ready);
    this.arm = arm;
    this.deps = deps;
    // A rule write changed when a time rule next runs: the room's alarm asks again.
    this.store.onSchedule = () => {
      this.schedule.restoreTimes();
      this.arm();
    };
  }

  get kinds(): ReadonlySet<AutomationEventKind> {
    return this.store.kinds;
  }

  queued(dropped: number): void {
    if (dropped > 0) {
      this.schedule.dropped += dropped;
      console.warn('[automations] queue.full', { dropped });
    }
    if (this.schedule.queued(Date.now())) this.arm();
  }

  restore(now: number): void {
    this.store.load();
    this.schedule.restore(now);
  }

  clear(): void {
    this.store.kinds.clear();
    this.schedule.clear();
  }
}
