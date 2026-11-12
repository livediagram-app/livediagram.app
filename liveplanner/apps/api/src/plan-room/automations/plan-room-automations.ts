// A plan room's Automations (docs/specs/026-plan/automations.md "Runs, limits and loops"; blueprint automations.md
// "The event", "Phase 2"): what the room makes of them on its alarm (the time triggers' moments, then the queue),
// and the runner's surface its routes use. A wake never throws: a run's failure is logged on the run, and a wake
// that fails as a whole tries again a minute later.
import { withoutLegacyThread } from '@liveplanner/project';
import type { Item } from '@liveplanner/items';
import type { PlanRoom } from '../plan-room';
import { runAutomationWake, type RunnerDeps } from './automation-runner';
import { runTimeTriggers } from './automation-time';
import { runWaits } from './automation-waits';

const AUTOMATION_RETRY_MS = 60_000;

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
  try {
    // A time rule's moment queues its cards first, so this wake starts running them.
    if (schedule.timeDue(now)) {
      // Runs a Wait held whose time is up go on in this wake too.
      runWaits(deps, schedule, now);
      await runTimeTriggers(deps, schedule, now);
    }
    if (!schedule.queueDue(now)) return;
    const ran = await runAutomationWake(deps, schedule, now);
    if (ran > 0) console.info('[automations] wake', { ran });
  } catch (error) {
    console.warn('[automations] wake.failed', { error: String(error) });
    schedule.at = now + AUTOMATION_RETRY_MS;
    if (schedule.timeDue(now)) schedule.timeAt = now + AUTOMATION_RETRY_MS;
  }
}
