// A plan room's Automations (docs/specs/026-plan/automations.md "Runs, limits and loops"; blueprint automations.md
// "The event", "Phase 2"): what the room makes of them on its alarm (the time triggers' moments, then the queue),
// and the runner's surface its routes use. A wake never throws: a run's failure is logged on the run, and a wake
// that fails as a whole tries again later, backing off, and gives up after 12 in a row
// (@liveworkspace/automations/room automation-wake.ts).
import { withoutLegacyThread } from '@liveplanner/project';
import type { Item } from '@liveplanner/items';
import {
  WAKE_FAILURES_MAX,
  WAKE_RETRY_MAX_MS,
  giveUpWake,
  wakeDone,
  wakeFailed,
} from '@liveworkspace/automations/room';
import type { PlanRoom } from '../plan-room';
import { runAutomationWake, type RunnerDeps } from './automation-runner';
import { AutomationTally, flushTally } from './automation-telemetry';
import { runTimeTriggers } from './automation-time';
import { runWaits } from './automation-waits';

// What a run needs from the room: its env, its SQL, the rules, the relay and its background work. Null when the
// room holds no plan yet.
export function automationDeps(room: PlanRoom): RunnerDeps | null {
  const env = room.roomEnv;
  const planId = room.planId;
  if (!env || !planId || !room.schemaReady) return null;
  return {
    env,
    planId,
    sql: () => room.state.storage.sql,
    store: room.automations.store,
    tier: room.tier,
    relay: (items: Item[], rev: number) =>
      room.broadcastOrderedSystemOp({
        kind: 'items',
        upserts: items.map(withoutLegacyThread),
        removed: [],
        rev,
      }),
    defer: (p: Promise<unknown>) => room.state.waitUntil(p),
  };
}

export async function runAutomations(room: PlanRoom, now: number): Promise<void> {
  const schedule = room.automations.schedule;
  const deps = room.automations.deps();
  if (!deps) {
    schedule.clear();
    return;
  }
  // Held off after a failed wake: nothing runs (and nothing counts as a success) before the next try.
  if (now < schedule.retryAt) return;
  // The wake's counts, posted once when it ends, a failed wake's too.
  const tally = new AutomationTally();
  try {
    // The plan's tier's limits, read again when they are over a minute old: once a wake at most, before any run, so
    // a run's claim reads its day's limit from memory. With Pro off (and while fresh) nothing is awaited.
    if (!room.tier.fresh()) await room.tier.refresh();
    // A time rule's moment queues its cards first, so this wake starts running them.
    if (schedule.timeDue(now)) {
      // Runs a Wait held whose time is up go on in this wake too.
      runWaits(deps, schedule, now);
      await runTimeTriggers(deps, schedule, now, tally);
    }
    if (schedule.queueDue(now)) {
      const ran = await runAutomationWake(deps, schedule, now, tally);
      if (ran > 0) console.info('[automations] wake', { ran });
    }
    wakeDone(deps.sql(), schedule);
  } catch (error) {
    console.warn('[automations] wake.failed', { error: String(error) });
    tally.track('Plan', 'Ran', 'AutomationWakeFailed');
    try {
      const sql = deps.sql();
      if (wakeFailed(sql, schedule, now) >= WAKE_FAILURES_MAX) {
        giveUpWake(sql, schedule, now, {
          store: deps.store,
          settles: false,
          line: { ruleName: '', card: null },
        });
        tally.track('Plan', 'Ran', 'AutomationWakeGaveUp');
      }
    } catch (again) {
      // Not even the count could be kept: the longest hold-off, in memory, so the room never spins.
      console.warn('[automations] wake.count_failed', { error: String(again) });
      schedule.retryAt = now + WAKE_RETRY_MAX_MS;
    }
  } finally {
    if (tally.size > 0) deps.defer(flushTally(tally, deps.env));
  }
}
