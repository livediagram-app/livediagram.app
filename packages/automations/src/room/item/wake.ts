// What an item's room makes of its Automations on its alarm (liveworkspace/docs/specs/018-automations/automations.md
// "Where rules live and run", "Runs, limits and loops"; blueprint item-engine.md "A wake"): runs a Wait held go on,
// settles that came due queue their event, time rules' moments queue theirs, then the queue is drained a bounded
// batch at a time, each trigger against every rule that is on and hears it, in the list's order. A wake never
// throws: a run's failure is logged on the run, and a wake that fails as a whole tries again later, backing off, and
// gives up after 12 in a row (automation-wake.ts). One telemetry batch a wake.
import { BUDGET_SPENT, runItemRule, type ItemRunState } from './run';
import { ITEM_RESUME_EVENT, type ItemEvent, type ItemKinds, type ItemRule } from '../../item';
import { AUTOMATION_RUNS_PER_DAY } from '../../limits';
import { burstLineId, runsToday, settleRun, settleWaiting, trimRuns } from '../automation-log';
import { AutomationTally } from '../automation-telemetry';
import { WAIT_RULE_CHANGED, runWaits } from '../automation-waits';
import {
  WAKE_FAILURES_MAX,
  WAKE_RETRY_MAX_MS,
  giveUpWake,
  wakeDone,
  wakeFailed,
} from '../automation-wake';
import type { ItemEngine, ItemSchedule } from './engine';
import type { ItemDeps } from './kit';
import { runItemSettles } from './settles';
import { ITEM_TELEMETRY_ACTION } from './telemetry';
import { runItemTimeTriggers } from './time';

// Triggers one wake runs; the rest wait ITEM_MORE_MS for the next.
export const ITEM_EVENTS_PER_WAKE = 25;
export const ITEM_MORE_MS = 1000;
// The most a wake spends before leaving the rest to the next (an AI step is up to 15 s).
export const ITEM_WAKE_MS = 60_000;
export const QUEUE_FULL = 'Too many changes at once';

/** Whether `event` starts `rule`: the one rule it names (a time, a call, Run Rule, a settle, a Wait going on), or
 *  a kind the rule's trigger hears and matches. */
export function itemTriggerMatches(kinds: ItemKinds, rule: ItemRule, event: ItemEvent): boolean {
  if (event.ruleId !== undefined) return event.ruleId === rule.id;
  const def = kinds.trigger(rule.trigger.kind);
  return !!def && def.hears.includes(event.kind) && def.matches(rule.trigger, event);
}

/** One wake of the queue: the oldest waiting triggers; a burst the queue dropped logged once; the Audit Trail
 *  trimmed. Asks for the next wake while more wait. */
export async function runItemWake(
  deps: ItemDeps,
  schedule: ItemSchedule,
  now: number,
  tally?: AutomationTally,
): Promise<number> {
  const sql = deps.sql();
  const { kit, store } = deps;
  const rows = schedule.next(ITEM_EVENTS_PER_WAKE + 1);
  const rules = store.enabled();
  const state: ItemRunState = {
    outline: null,
    today: runsToday(sql, now),
    claims: store.claims,
    ...(tally ? { tally } : {}),
  };
  let ran = 0;
  let left = false;
  const started = Date.now();
  for (const row of rows.slice(0, ITEM_EVENTS_PER_WAKE)) {
    if (Date.now() - started > ITEM_WAKE_MS) {
      left = true;
      break;
    }
    const event = row.event;
    for (const listed of event ? rules : []) {
      if (!itemTriggerMatches(kit.kinds, listed, event!)) continue;
      // The rule as it is now: one this wake's own runs paused, or a write turned off, deleted or changed while the
      // wake waited, runs as it now stands, or not at all.
      const rule = store.get(listed.id);
      if (!rule?.enabled || !itemTriggerMatches(kit.kinds, rule, event!)) continue;
      if (await runItemRule(deps, state, rule, event!)) ran += 1;
    }
    // A held run that went no further (its rule off or gone since it was queued, the day spent) settles here, so
    // it never shows Waiting past its time; one that ran is settled already, and this changes nothing.
    if (event?.kind === ITEM_RESUME_EVENT && event.origin)
      settleWaiting(
        sql,
        event.origin,
        'skipped',
        state.today >= AUTOMATION_RUNS_PER_DAY ? BUDGET_SPENT : WAIT_RULE_CHANGED,
      );
    schedule.done(row.id);
  }
  if (schedule.dropped > 0) {
    settleRun(sql, {
      id: burstLineId(now),
      ruleId: '',
      ruleName: '',
      subject: null,
      at: now,
      result: 'skipped',
      reason: QUEUE_FULL,
      tookMs: 0,
      steps: [],
    });
    schedule.dropped = 0;
    tally?.track(kit.category, ITEM_TELEMETRY_ACTION, 'AutomationQueueFull');
  }
  trimRuns(sql, now);
  // A full batch leaves the rest a moment; a trigger the wake's own runs queued goes on the next wake.
  const more = left || rows.length > ITEM_EVENTS_PER_WAKE;
  schedule.at = schedule.waiting() ? (more ? now + ITEM_MORE_MS : now) : null;
  return ran;
}

// Waits, settles, times, then the queue.
async function wakeOnce(
  deps: ItemDeps,
  schedule: ItemSchedule,
  now: number,
  tally: AutomationTally,
): Promise<void> {
  // What the SQL triggers queued or pushed back since the alarm was armed.
  schedule.poll(now);
  const timeDue = schedule.timeDue(now);
  // A run a Wait held whose time is up goes on in this wake.
  if (timeDue) runWaits(deps, schedule, now);
  if (schedule.settleDue(now)) runItemSettles(deps, schedule, now);
  if (timeDue) await runItemTimeTriggers(deps, schedule, now, tally);
  if (!schedule.queueDue(now)) return;
  const ran = await runItemWake(deps, schedule, now, tally);
  if (ran > 0) console.info('[automations] wake', { ran });
}

/** The room's alarm, for Automations: Waits, settles, times, then the queue. Never throws. */
export async function runItemAutomations(engine: ItemEngine, now: number): Promise<void> {
  const { schedule } = engine;
  const deps = engine.deps();
  if (!deps || deps.kit.putAway()) {
    schedule.clear();
    return;
  }
  // Held off after a failed wake: nothing runs (and nothing counts as a success) before the next try.
  if (now < schedule.retryAt) return;
  const { kit } = deps;
  // The wake's counts, posted once when it ends, a failed wake's too.
  const tally = new AutomationTally();
  try {
    await wakeOnce(deps, schedule, now, tally);
    wakeDone(deps.sql(), schedule);
  } catch (error) {
    console.warn('[automations] wake.failed', { error: String(error) });
    tally.track(kit.category, ITEM_TELEMETRY_ACTION, 'AutomationWakeFailed');
    try {
      const sql = deps.sql();
      if (wakeFailed(sql, schedule, now) >= WAKE_FAILURES_MAX) {
        giveUpWake(sql, schedule, now, {
          store: deps.store,
          settles: true,
          line: { ruleName: '', subject: null },
        });
        tally.track(kit.category, ITEM_TELEMETRY_ACTION, 'AutomationWakeGaveUp');
      }
      schedule.poll(now);
    } catch (again) {
      // Not even the count could be kept: the longest hold-off, in memory, so the room never spins.
      console.warn('[automations] wake.count_failed', { error: String(again) });
      schedule.retryAt = now + WAKE_RETRY_MAX_MS;
    }
  } finally {
    if (tally.size > 0) kit.defer(tally.flush((events) => kit.telemetry(events)));
  }
}
