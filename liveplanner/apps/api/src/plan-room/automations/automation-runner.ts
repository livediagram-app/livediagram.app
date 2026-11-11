// One trigger against the rules that hear it (docs/specs/026-plan/automations.md "Runs, limits and loops"; blueprint
// automations.md "The run"). A run's id is a hash of the trigger and the rule, claimed in the Run Log before anything
// is done, so a retry or a second wake never runs a rule twice for one trigger. Then the day's budget, the chain
// (never its own changes; a rule that keeps its changes to itself starts nothing; five rules at most), the card,
// the conditions, the planned steps (@liveplanner/items planActions) and the writes (automation-writes.ts); the row
// is settled with its result and the rule's failures counted, ten in a row pausing it. A run never throws: anything
// unexpected is a failed run. The wake drains the queue a bounded batch at a time; Test on a Card and Run Rule run
// one at once, a test changing nothing. Phase 2: a time trigger's event runs its one rule (the scan matched it; the
// conditions are checked again); a branch's related cards are written one patch each, a card failing alone; Assign in
// Turn's place moves on only after a done run; the run's messages go after its card writes (automation-sends.ts).
import {
  AUTOMATION_CHAIN_MAX,
  AUTOMATION_RUNS_PER_DAY,
  allHold,
  fieldName,
  isTimeTrigger,
  isTrashed,
  itemTitle,
  planActions,
  sha256,
  statusName,
  timeTriggerWords,
  triggerMatches,
  type AutomationEvent,
  type AutomationResult,
  type AutomationRule,
  type AutomationRun,
  type AutomationStepLine,
} from '@liveplanner/items';
import { listItems, readItem } from '../../db/items';
import { cardUrl, readAutomationPlan, type AutomationPlan } from './automation-plan';
import { claimRun, dropRun, runsToday, settleRun, trimRuns } from './automation-log';
import type { AutomationSchedule } from './automation-queue';
import type { AutomationStore, Sql } from './automation-store';
import { applyPlannedRun, type WriteDeps } from './automation-writes';
import { sendMessages, sendsClient } from './automation-sends';

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

// The Run Log's first line: who did what to the card, or a time trigger's "Automation · Every Weekday at 9:00".
function triggerLine(
  event: AutomationEvent,
  plan: AutomationPlan | null,
  rule: AutomationRule,
): AutomationStepLine {
  if (event.kind === 'time' && isTimeTrigger(rule.trigger))
    return { kind: 'trigger', text: `Automation · ${timeTriggerWords(rule.trigger)}` };
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

// `turn`: a test's Assign in Turn place (the saved rule's, when it has one).
// A branch's failed cards, named: "Failed on #12, #14: Column qa is gone".
const relatedFailure = (related: readonly { card: { key: number }; failed?: string }[]): string =>
  `Failed on ${related.map((r) => `#${r.card.key}`).join(', ')}: ${related[0]!.failed!}`;

export type RunOptions = { dry?: boolean; turn?: number };

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
  }
  const lines: AutomationStepLine[] = [];
  let card: AutomationRun['card'] = null;
  let turns = 0;
  let webhook: string | undefined;
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
    // The day's budget counts what ran: a No Match is logged but costs nothing.
    if (result !== 'no_match') state.today += 1;
    if (result === 'done') deps.store.advanceTurn(rule.id, turns);
    if (result === 'done' || result === 'failed')
      deps.store.settle(rule.id, result, reason ?? '', at, webhook);
    console.info('[automations] run', { result, tookMs: run.tookMs });
    return run;
  };
  try {
    state.plan ??= await readAutomationPlan(deps.env, deps.planId);
    const plan = state.plan;
    lines.push(triggerLine(event, plan, rule));
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
      urlOf: (id: string) => cardUrl(deps.env, deps.planId, id),
      turn: opts.turn ?? (opts.dry ? 0 : deps.store.turn(rule.id)),
      // A branch's related cards come from the plan as it is now.
      ...(rule.steps.some((s) => s.kind === 'for')
        ? { items: await listItems(deps.env, deps.planId) }
        : {}),
    };
    const held = allHold(rule.conditions, ctx);
    for (const l of held.lines) lines.push({ kind: 'condition', ...l });
    if (stop) {
      if (!held.ok) return (dropRun(sql, id), null);
      return end('skipped', stop);
    }
    if (!held.ok) return end('no_match');
    const planned = planActions(rule.steps, ctx);
    const offset = lines.length;
    lines.push(...planned.lines);
    // A failed step stops the run; the steps before it stay done (spec "Actions").
    const writes = 'failed' in planned ? planned.done : planned;
    let failed = 'failed' in planned ? planned.failed : null;
    const related = writes.related.filter((r) => r.failed);
    failed ??= related.length ? relatedFailure(related) : null;
    const messages = {
      client: opts.dry ? null : sendsClient(deps.env),
      planId: deps.planId,
      runId: id,
      rule: rule.name,
      card: { key: item.key, title: itemTitle(item), url: ctx.url },
      at,
      dry: opts.dry === true,
    };
    if (opts.dry) {
      await sendMessages(messages, writes.sends, lines, offset);
      return end(failed === null ? 'done' : 'failed', failed ?? undefined);
    }
    const source = { role: 'automation' as const, rule: rule.id, chain: (event.chain ?? 0) + 1 };
    const out = await applyPlannedRun(deps, plan, rule, item, writes, source, ctx.url);
    if (!out.ok) {
      lines.push({ kind: 'action', ok: false, text: out.reason });
      return end('failed', out.reason);
    }
    const refused: string[] = [];
    for (const r of writes.related) {
      if (!r.patch.set && !r.patch.clear && !r.comments.length && !r.emails.length) continue;
      const url = cardUrl(deps.env, deps.planId, r.card.id);
      const one = { patch: r.patch, comments: r.comments, created: [], emails: r.emails };
      const wrote = await applyPlannedRun(deps, plan, rule, r.card, one, source, url);
      if (wrote.ok) continue;
      lines.push({ kind: 'action', ok: false, text: `#${r.card.key} ${wrote.reason}` });
      refused.push(`#${r.card.key}`);
      failed ??= `Failed on ${refused[0]}: ${wrote.reason}`;
    }
    const sent = await sendMessages(messages, writes.sends, lines, offset);
    if (failed === null && sent.failed !== undefined) {
      failed = sent.failed;
      webhook = sent.webhook;
    }
    if (failed !== null) return end('failed', failed);
    turns = writes.turns;
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
