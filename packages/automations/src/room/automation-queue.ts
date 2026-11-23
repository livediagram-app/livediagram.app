// The triggers waiting for an item's alarm (liveworkspace/docs/specs/018-automations/automations.md "Where rules live
// and run", "Runs, limits and loops"; blueprint engine.md "The room entry"). An app's writes put their events into
// `automation_queue` in the same transaction as the write, and only for the kinds some rule that is on hears: an
// item with none builds no event and runs no statement. At most AUTOMATION_QUEUE_MAX wait; a burst past it drops
// the newest, which the next wake logs once. `AutomationSchedule` is the wake the queue asks for; `ItemAutomations`
// is what the room puts on its env for the writes and routes.
import {
  AutomationStore,
  type AutomationLimits,
  type AutomationStoreKit,
  type StoredRule,
} from './automation-store';
import type { Sql } from './sql';

// What an item's writes ask of its Automations: the kinds its rules hear (the hot-path check), and a wake once
// events are queued (with how many the queue had no room for).
export interface AutomationsHook<EventKind extends string = string> {
  readonly kinds: ReadonlySet<EventKind>;
  queued(dropped: number): void;
}

// The wake the queue asks for (now while a trigger waits, else none), and the time triggers' (their earliest
// `next_at`, one indexed MIN read, none when no time rule is on).
export class AutomationSchedule<Event = unknown> {
  at: number | null = null;
  timeAt: number | null = null;
  // Triggers the queue had no room for since the last wake (one Skipped line says so).
  dropped = 0;
  // A failed wake's hold-off (automation-wake.ts): nothing is due before it; 0 for none. Read back on a restart.
  retryAt = 0;
  // Wakes failed in a row as `automation_wake` holds them; null until read (a success then clears the row once).
  failures: number | null = null;

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

  // After a wake (the object restarted): now when a trigger waits (held off while wakes keep failing), and the time
  // triggers' next moment.
  restore(now: number): void {
    this.restoreRetry();
    this.at = this.waiting() ? now : null;
    this.restoreTimes();
  }

  // The failed wakes' row: how many in a row and the hold-off, so a restart neither retries at once nor counts
  // afresh. One read of a table with at most one row.
  private restoreRetry(): void {
    if (!this.ready()) return;
    const row = this.sql().exec('SELECT failures, retry_at FROM automation_wake').toArray()[0];
    this.failures = Number(row?.['failures'] ?? 0);
    this.retryAt = Number(row?.['retry_at'] ?? 0);
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

  // The room's wake: the earlier of the two, never before a failed wake's hold-off.
  get wakeAt(): number | null {
    const at =
      this.at === null
        ? this.timeAt
        : this.timeAt === null
          ? this.at
          : Math.min(this.at, this.timeAt);
    return at === null ? null : Math.max(at, this.retryAt);
  }

  timeDue(now: number): boolean {
    return this.timeAt !== null && Math.max(this.timeAt, this.retryAt) <= now;
  }

  queueDue(now: number): boolean {
    return this.at !== null && Math.max(this.at, this.retryAt) <= now;
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
  next(n: number): { id: number; event: Event | null }[] {
    return this.sql()
      .exec('SELECT id, event FROM automation_queue ORDER BY id LIMIT ?', n)
      .toArray()
      .map((row) => {
        const r = row as unknown as { id: number; event: string };
        let event: Event | null = null;
        try {
          event = JSON.parse(r.event) as Event;
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

// An item's Automations as its room holds them: the rules, the queue's wake, the hook its writes call, and what a
// run needs from the room (`deps`, the app's own; null while the room holds no item), for the wake and the routes
// alike.
export class ItemAutomations<
  Rule extends StoredRule,
  EventKind extends string = string,
  Event = unknown,
  Deps = unknown,
> implements AutomationsHook<EventKind> {
  readonly store: AutomationStore<Rule, EventKind>;
  readonly schedule: AutomationSchedule<Event>;
  readonly sql: () => Sql;
  readonly deps: () => Deps | null;
  private readonly arm: () => void;
  // Whether the item is archived or in the Trash: its schedule reads as empty and it hears nothing.
  private readonly putAway: () => boolean;
  private readonly noneHeard: ReadonlySet<EventKind> = new Set();

  constructor(input: {
    sql: () => Sql;
    // Whether the item's schema exists.
    ready: () => boolean;
    // Arms the room's alarm for the schedule's wake.
    arm: () => void;
    deps: () => Deps | null;
    putAway?: () => boolean;
    kit: AutomationStoreKit<Rule, EventKind>;
    // The item's tier's limits (the room's ItemTier); absent, the legacy ones.
    limits?: () => AutomationLimits;
    // A holder with a wake of its own (the item engine's also reads its settles); absent, the queue's.
    schedule?: (sql: () => Sql, ready: () => boolean) => AutomationSchedule<Event>;
  }) {
    const putAway = input.putAway ?? (() => false);
    this.sql = input.sql;
    this.putAway = putAway;
    this.store = new AutomationStore(input.sql, input.ready, input.kit, input.limits);
    const awake = () => input.ready() && !putAway();
    this.schedule = input.schedule?.(input.sql, awake) ?? new AutomationSchedule(input.sql, awake);
    this.arm = input.arm;
    this.deps = input.deps;
    // A rule write changed when a time rule next runs: the room's alarm asks again.
    this.store.onSchedule = () => {
      this.schedule.restoreTimes();
      this.arm();
    };
  }

  // Put away, none: no write, comment or delivery builds an event.
  get kinds(): ReadonlySet<EventKind> {
    return this.putAway() ? this.noneHeard : this.store.kinds;
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
