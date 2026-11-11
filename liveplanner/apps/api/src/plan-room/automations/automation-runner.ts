// One trigger against the rules that hear it (docs/specs/026-plan/automations.md "Runs, limits and loops"; blueprint
// automations.md "The run"). A run's id is a hash of the trigger and the rule, claimed in the Run Log before anything
// is done, so a retry or a second wake never runs a rule twice for one trigger. Then the day's budget, the chain
// (never its own changes; a rule that keeps its changes to itself starts nothing; five rules at most), the card,
// the conditions, the planned steps (@liveplanner/items planActions) and the writes (automation-writes.ts); the row
// is settled with its result and the rule's failures counted, ten in a row pausing it. A run never throws: anything
// unexpected is a failed run. The wake drains the queue a bounded batch at a time; Test on a Card and Run Rule run
// one at once, a test changing nothing.
import {
  AUTOMATION_CHAIN_MAX,
  AUTOMATION_RUNS_PER_DAY,
  allHold,
  fieldName,
  isTrashed,
  itemTitle,
  planActions,
  sha256,
  statusName,
  triggerMatches,
  type AutomationEvent,
  type AutomationResult,
  type AutomationRule,
  type AutomationRun,
  type AutomationStepLine,
} from '@liveplanner/items';
import { readItem } from '../../db/items';
import { cardUrl, readAutomationPlan, type AutomationPlan } from './automation-plan';
import { claimRun, dropRun, runsToday, settleRun, trimRuns } from './automation-log';
import type { AutomationSchedule } from './automation-queue';
import type { AutomationStore, Sql } from './automation-store';
import { applyPlannedRun, type WriteDeps } from './automation-writes';

// Triggers one wake runs; the rest wait AUTOMATION_MORE_MS for the next.
export const AUTOMATION_EVENTS_PER_WAKE = 25;
export const AUTOMATION_MORE_MS = 1000;

export const CHAIN_STOPPED = `Chain stopped after ${AUTOMATION_CHAIN_MAX} rules`;
export const CHAIN_KEPT = "Started by another rule's change";
export const QUEUE_FULL = 'Too many changes at once';
const WENT_WRONG = 'Something went wrong';

export interface RunnerDeps extends WriteDeps {
  sql: () => Sql;
  store: AutomationStore;
}

// What one wake (or one request) reads once: the plan, and the runs started today.
export type RunState = { plan: AutomationPlan | null; today: number };

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export const runIdOf = async (eventId: string, ruleId: string): Promise<string> =>
  hex(await sha256(new TextEncoder().encode(`${eventId}:${ruleId}`)));

// The Run Log's first line: who did what to the card.
function triggerLine(event: AutomationEvent, plan: AutomationPlan | null): AutomationStepLine {
  const who = event.by.name;
  const column = (s: string | undefined) =>
    s && plan ? statusName(plan.outline, s) : (s ?? 'no column');
  const text =
    event.kind === 'created'
      ? event.form
        ? `A form response made the card`
        : `${who} made the card`
      : event.kind === 'moved'
        ? `${who} moved it from ${column(event.from)} to ${column(event.to)}`
        : event.kind === 'changed'
          ? `${who} changed ${(event.fields ?? []).map((f) => (plan ? fieldName(plan.outline, f) : f)).join(', ')}`
          : event.kind === 'comment'
            ? `${who} commented`
            : `${who} ran the rule`;
  return { kind: 'trigger', text, by: event.by };
}

// Why a rule's change starts no further rule, or null when it may.
function chainStop(event: AutomationEvent, store: AutomationStore): string | null {
  if (event.role !== 'automation' || event.rule === undefined) return null;
  if (!store.get(event.rule)?.chain) return CHAIN_KEPT;
  return (event.chain ?? 0) >= AUTOMATION_CHAIN_MAX ? CHAIN_STOPPED : null;
}

export type RunOptions = { dry?: boolean };

// One rule answering one trigger: the run, or null when it never started (its own change, the budget spent, ran
// already, or a chain stop whose conditions did not hold).
export async function runRule(
  deps: RunnerDeps,
  state: RunState,
  rule: AutomationRule,
  event: AutomationEvent,
  opts: RunOptions = {},
): Promise<AutomationRun | null> {
  if (event.rule === rule.id) return null;
  const sql = deps.sql();
  const id = await runIdOf(event.id, rule.id);
  const at = Date.now();
  if (!opts.dry) {
    if (state.today >= AUTOMATION_RUNS_PER_DAY) return null;
    if (!claimRun(sql, id, rule.id, at)) return null;
    state.today += 1;
  }
  const lines: AutomationStepLine[] = [];
  let card: AutomationRun['card'] = null;
  const end = (result: AutomationResult, reason?: string): AutomationRun => {
    const run: AutomationRun = {
      id,
      ruleId: rule.id,
      ruleName: rule.name,
      card,
      at,
      result,
      ...(reason ? { reason } : {}),
      tookMs: Date.now() - at,
      steps: lines,
    };
    if (opts.dry) return run;
    settleRun(sql, run);
    if (result === 'done' || result === 'failed')
      deps.store.settle(rule.id, result, reason ?? '', at);
    console.info('[automations] run', { result, tookMs: run.tookMs });
    return run;
  };
  try {
    state.plan ??= await readAutomationPlan(deps.env, deps.planId);
    const plan = state.plan;
    lines.push(triggerLine(event, plan));
    const stop = chainStop(event, deps.store);
    const item = await readItem(deps.env, deps.planId, event.cardId);
    if (!item || isTrashed(item)) {
      if (stop) return (dropRun(sql, id), null);
      return end('no_match', 'The card is gone');
    }
    card = { id: item.id, key: item.key, title: itemTitle(item) };
    const ctx = {
      card: item,
      outline: plan.outline,
      by: event.by,
      role: event.role,
      now: at,
      timeZone: rule.timeZone,
      rule: { name: rule.name },
      url: cardUrl(deps.env, deps.planId, item.id),
    };
    const held = allHold(rule.conditions, ctx);
    for (const l of held.lines) lines.push({ kind: 'condition', ...l });
    if (stop) {
      if (!held.ok) return (dropRun(sql, id), null);
      return end('skipped', stop);
    }
    if (!held.ok) return end('no_match');
    const planned = planActions(rule.steps, ctx);
    lines.push(...planned.lines);
    if ('failed' in planned) return end('failed', planned.failed);
    if (opts.dry) return end('done');
    const source = { role: 'automation' as const, rule: rule.id, chain: (event.chain ?? 0) + 1 };
    const out = await applyPlannedRun(deps, plan, rule, item, planned, source, ctx.url);
    if (!out.ok) {
      lines.push({ kind: 'action', ok: false, text: out.reason });
      return end('failed', out.reason);
    }
    return end('done');
  } catch (error) {
    console.warn('[automations] run.threw', { error: String(error) });
    try {
      return end('failed', WENT_WRONG);
    } catch (settling) {
      console.warn('[automations] run.unsettled', { error: String(settling) });
      return null;
    }
  }
}

// One wake: the oldest waiting triggers, each against every rule that is on and hears it, in the list's order; a
// burst the queue dropped logged once; the Run Log trimmed. Asks for the next wake while more wait. Never throws.
export async function runAutomationWake(
  deps: RunnerDeps,
  schedule: AutomationSchedule,
  now: number,
): Promise<number> {
  const sql = deps.sql();
  const rows = schedule.next(AUTOMATION_EVENTS_PER_WAKE + 1);
  const rules = deps.store.enabled();
  const state: RunState = { plan: null, today: runsToday(sql, now) };
  let ran = 0;
  for (const row of rows.slice(0, AUTOMATION_EVENTS_PER_WAKE)) {
    const event = row.event;
    for (const rule of event ? rules : []) {
      if (!triggerMatches(rule.trigger, event!, rule.id)) continue;
      if (await runRule(deps, state, rule, event!)) ran += 1;
    }
    schedule.done(row.id);
  }
  if (schedule.dropped > 0) {
    settleRun(sql, {
      id: `burst:${now}`,
      ruleId: '',
      ruleName: '',
      card: null,
      at: now,
      result: 'skipped',
      reason: QUEUE_FULL,
      tookMs: 0,
      steps: [],
    });
    schedule.dropped = 0;
  }
  trimRuns(sql, now);
  // A full batch leaves the rest a moment; a trigger the wake's own runs queued goes on the next wake.
  const more = rows.length > AUTOMATION_EVENTS_PER_WAKE;
  schedule.at = schedule.waiting() ? (more ? now + AUTOMATION_MORE_MS : now) : null;
  return ran;
}
