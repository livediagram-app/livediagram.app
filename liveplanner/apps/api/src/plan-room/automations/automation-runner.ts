// One trigger against the rules that hear it (docs/specs/026-plan/automations.md "Runs, limits and loops"; blueprint
// automations.md "The run"). A run's id is a hash of the trigger and the rule, claimed in the Audit Trail before anything
// is done, so a retry or a second wake never runs a rule twice for one trigger. Then the day's budget, the chain
// (never its own changes; a rule that keeps its changes to itself starts nothing; five rules at most), the card,
// the conditions, the planned steps (@liveplanner/items planActions) and the writes (automation-writes.ts); the row
// is settled with its result and the rule's failures counted, ten in a row pausing it. A run never throws: anything
// unexpected is a failed run. The wake drains the queue a bounded batch at a time; Test on a Card and Run Rule run
// one at once, a test changing nothing. Phase 2: a time trigger's event runs its one rule (the scan matched it; the
// conditions are checked again); a branch's related cards are written one patch each, a card failing alone; Assign in
// Turn's place moves on only after a done run; the run's messages go after its card writes (automation-sends.ts).
// Phase 3: an Incoming Webhook call's event runs its one rule on its card, or with no card when it named none and
// the rule's steps need none (a blank card, `card.…` values reading nothing, no card on the run or its messages).
import {
  AUTOMATION_CHAIN_MAX,
  AUTOMATION_RUNS_PER_DAY,
  NO_CARDS_NAMED,
  allHold,
  cardlessCard,
  fieldName,
  githubTriggerWords,
  incomingTriggerWords,
  isTimeTrigger,
  isTrashed,
  itemTitle,
  planActions,
  runsWithoutCard,
  sha256,
  statusName,
  timeTriggerWords,
  triggerMatches,
  derivedMoments,
  derivedTargets,
  isDerivedTrigger,
  type DerivedTrigger,
  waitWords,
  type AutomationEvent,
  type AutomationResult,
  type AutomationRule,
  type AutomationRun,
  type AutomationStepLine,
} from '@liveplanner/items';
import { listItems, readItem } from '../../db/items';
import type { Item } from '@liveplanner/items';
import { appBaseUrl } from '../../email/client';
import { cardUrl, readAutomationPlan, type AutomationPlan } from './automation-plan';
import {
  burstLineId,
  claimRun,
  dropRun,
  runsToday,
  settleRun,
  settleWaiting,
  trimRuns,
} from './automation-log';
import { WAIT_CONDITIONS, WAIT_FULL, WAIT_RULE_CHANGED, holdRun } from './automation-waits';
import type { AutomationSchedule } from './automation-queue';
import type { AutomationStore, Sql } from './automation-store';
import { applyPlannedRun, type WriteDeps } from './automation-writes';
import { sendMessages, sendsClient } from './automation-sends';
import { aiClient, runAiSteps } from './automation-ai';
import { tallyRun, type AutomationTally } from './automation-telemetry';

// Triggers one wake runs; the rest wait AUTOMATION_MORE_MS for the next.
export const AUTOMATION_EVENTS_PER_WAKE = 25;
export const AUTOMATION_MORE_MS = 1000;
// The most a wake spends before leaving the rest to the next (AI steps make a run slow: up to 15 s each).
export const AUTOMATION_WAKE_MS = 60_000;

export const CHAIN_STOPPED = `Chain stopped after ${AUTOMATION_CHAIN_MAX} rules`;
export const CHAIN_KEPT = "Started by another rule's change";
export const QUEUE_FULL = 'Too many changes at once';
export const BUDGET_SPENT = 'Daily limit reached: rules run again tomorrow';
const WENT_WRONG = 'Something went wrong';

export interface RunnerDeps extends WriteDeps {
  sql: () => Sql;
  store: AutomationStore;
}

// What one wake (or one request) reads once: the plan, the runs started today, and (once an AI step asks) the AI
// calls made today.
export type RunState = {
  plan: AutomationPlan | null;
  today: number;
  ai?: number;
  // The plan's cards as one event's derived triggers read them (runs between events change them).
  cards?: { event: string; items: Item[] };
  // The columns this wake's Column Over Limit rules ran on, each as its rule and the column's cards.
  tipped?: Set<string>;
  // A wake's counts (automation-telemetry.ts); absent for Test on a Card and Run Rule, which the browser counts.
  tally?: AutomationTally;
};

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export const runIdOf = async (eventId: string, ruleId: string): Promise<string> =>
  hex(await sha256(new TextEncoder().encode(`${eventId}:${ruleId}`)));

// The Audit Trail's first line: who did what to the card, or a time trigger's "Automation · Every Weekday at 9:00".
function triggerLine(
  event: AutomationEvent,
  plan: AutomationPlan | null,
  rule: AutomationRule,
): AutomationStepLine {
  if (event.kind === 'time' && isTimeTrigger(rule.trigger))
    return { kind: 'trigger', text: `Automation · ${timeTriggerWords(rule.trigger)}` };
  // A run a Wait held, going on: "After waiting 2 days".
  if (event.kind === 'resume')
    return {
      kind: 'trigger',
      text: `After ${waitWords(event.waited ?? 1)
        .replace('Wait ', 'waiting ')
        .toLowerCase()}`,
    };
  // An Incoming Webhook call's: no person behind it.
  if (event.kind === 'incoming')
    return { kind: 'trigger', text: incomingTriggerWords(event.cards ?? 0) };
  // A GitHub delivery's: what the pull request did.
  if (event.kind === 'github' && event.github)
    return { kind: 'trigger', text: githubTriggerWords(event.github, event.pr), by: event.by };
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

// Whether a rule's steps read the plan's cards: a branch's related cards, or a Link Cards (the card it links, and a
// Blocked By loop).
const readsCards = (rule: AutomationRule): boolean =>
  rule.steps.some(
    (s) =>
      s.kind === 'for' ||
      s.kind === 'link_card' ||
      (s.kind === 'if' && [...s.then, ...s.else].some((a) => a.kind === 'link_card')),
  );

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
  const resume = event.kind === 'resume';
  let waitsUntil: number | undefined;
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
      ...(waitsUntil !== undefined ? { waitsUntil } : {}),
      ...(resume && event.waited ? { afterWait: event.waited } : {}),
    };
    if (opts.dry) return run;
    settleRun(sql, run);
    // The run a Wait held went on: its own row is done (what it did before the Wait stays).
    if (resume && event.origin) settleWaiting(sql, event.origin, 'done');
    // The day's budget counts what ran: a No Match is logged but costs nothing.
    if (result !== 'no_match') state.today += 1;
    if (result === 'done' || result === 'skipped' || result === 'waiting')
      deps.store.advanceTurn(rule.id, turns);
    if (
      (result === 'done' || result === 'failed' || result === 'waiting') &&
      deps.store.settle(rule.id, result === 'waiting' ? 'done' : result, reason ?? '', at, webhook)
    )
      state.tally?.track('Plan', 'Ran', 'AutomationPaused');
    if (state.tally && !opts.dry) tallyRun(state.tally, result, rule.trigger.kind);
    console.info('[automations] run', {
      result,
      trigger: rule.trigger.kind,
      tookMs: run.tookMs,
    });
    return run;
  };
  try {
    state.plan ??= await readAutomationPlan(deps.env, deps.planId);
    const plan = state.plan;
    lines.push(triggerLine(event, plan, rule));
    if (resume && rule.edited.at !== event.edited) return end('skipped', WAIT_RULE_CHANGED);
    const stop = chainStop(event, deps.store);
    // An Incoming Webhook call that named no card: the rule runs once with none, when its steps need none.
    const cardless = event.kind === 'incoming' && !event.cardId;
    if (cardless && !runsWithoutCard(rule)) return end('skipped', NO_CARDS_NAMED);
    const item = cardless ? cardlessCard() : await readItem(deps.env, deps.planId, event.cardId);
    if (!item || isTrashed(item)) {
      if (stop) return (dropRun(sql, id), null);
      return resume ? end('skipped', 'The card is gone') : end('no_match', 'The card is gone');
    }
    if (!cardless) card = { id: item.id, key: item.key, title: itemTitle(item) };
    const url = cardless
      ? `${appBaseUrl(deps.env)}/project/${encodeURIComponent(deps.planId)}`
      : cardUrl(deps.env, deps.planId, item.id);
    const ctx = {
      card: item,
      outline: plan.outline,
      by: event.by,
      role: event.role,
      now: at,
      timeZone: rule.timeZone,
      rule: { name: rule.name },
      url,
      urlOf: (id: string) => cardUrl(deps.env, deps.planId, id),
      ...(event.webhook ? { webhook: event.webhook } : {}),
      ...(cardless ? { cardless: true } : {}),
      turn: opts.turn ?? (opts.dry ? 0 : deps.store.turn(rule.id)),
      // A branch's related cards come from the plan as it is now.
      ...(readsCards(rule) ? { items: await listItems(deps.env, deps.planId) } : {}),
    };
    const held = allHold(rule.conditions, ctx);
    for (const l of held.lines) lines.push({ kind: 'condition', ...l });
    if (stop) {
      if (!held.ok) return (dropRun(sql, id), null);
      return end('skipped', stop);
    }
    if (!held.ok) return resume ? end('no_match', WAIT_CONDITIONS) : end('no_match');
    // A test plans past every Wait; a held run goes on from the step after its Wait.
    const planned = planActions(
      rule.steps,
      ctx,
      opts.dry ? { through: true } : resume ? { from: event.step ?? 0 } : {},
    );
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
      card: cardless ? null : { key: item.key, title: itemTitle(item), url: ctx.url },
      at,
      dry: opts.dry === true,
    };
    const source = {
      role: 'automation' as const,
      rule: rule.id,
      chain: (event.chain ?? 0) + 1,
      // A GitHub delivery's run, and the rest of one going on after its Wait (the resume keeps what GitHub heard).
      ...(event.kind === 'github' || (resume && event.github) ? { via: 'github' as const } : {}),
    };
    const ai = (dry: boolean) =>
      runAiSteps(
        deps,
        {
          client: aiClient(deps.env),
          sql,
          state,
          plan,
          rule,
          card: item,
          source,
          dry,
          ...(deps.env.AI_GATEWAY ? { gateway: deps.env.AI_GATEWAY } : {}),
        },
        writes.ai ?? [],
        lines,
        offset,
      );
    if (opts.dry) {
      await ai(true);
      await sendMessages(messages, writes.sends, lines, offset);
      return end(failed === null ? 'done' : 'failed', failed ?? undefined);
    }
    const out = await applyPlannedRun(deps, plan, rule, item, writes, source, ctx.url);
    if (!out.ok) {
      lines.push({ kind: 'action', ok: false, text: out.reason });
      return end('failed', out.reason);
    }
    const refused: string[] = [];
    for (const r of writes.related) {
      const writes_ = r.patch.set || r.patch.clear || r.patch.type;
      if (!writes_ && !r.comments.length && !r.emails.length && !r.mentions.length && !r.resolve)
        continue;
      const url = cardUrl(deps.env, deps.planId, r.card.id);
      const one = {
        patch: r.patch,
        comments: r.comments,
        created: [],
        emails: r.emails,
        mentions: r.mentions,
        resolve: r.resolve,
      };
      const wrote = await applyPlannedRun(deps, plan, rule, r.card, one, source, url);
      if (wrote.ok) continue;
      lines.push({ kind: 'action', ok: false, text: `#${r.card.key} ${wrote.reason}` });
      refused.push(`#${r.card.key}`);
      failed ??= `Failed on ${refused[0]}: ${wrote.reason}`;
    }
    // The AI steps, after the card writes: each one call, counted against the plan's day.
    const asked = await ai(false);
    failed ??= asked.failed ?? null;
    const sent = await sendMessages(messages, writes.sends, lines, offset);
    if (failed === null && sent.failed !== undefined) {
      failed = sent.failed;
      webhook = sent.webhook;
    }
    if (failed !== null) return end('failed', failed);
    turns = writes.turns;
    // A step the day's AI cap skipped makes the run Skipped, not Failed: nothing is wrong with the rule.
    if (asked.skipped) return end('skipped', asked.skipped);
    // A Wait reached: the rest goes on later, as a run of its own.
    if ('wait' in writes && writes.wait) {
      const until = holdRun(sql, id, rule.id, event, rule.edited.at, writes.wait, Date.now());
      if (until === null) {
        lines.push({ kind: 'action', ok: false, text: WAIT_FULL });
        return end('failed', WAIT_FULL);
      }
      waitsUntil = until;
      // The room's alarm asks again: this run may be the earliest to go on.
      deps.store.onSchedule();
      return end('waiting');
    }
    return end('done');
  } catch (error) {
    console.warn('[automations] run.threw', { error: String(error) });
    state.tally?.track('Plan', 'Ran', 'AutomationCrashed');
    try {
      return end('failed', WENT_WRONG);
    } catch (settling) {
      console.warn('[automations] run.unsettled', { error: String(settling) });
      return null;
    }
  }
}

// A derived trigger's events: one for each card it concerns. Card Unblocked's and Related Cards Done's go under that
// card's id and the moment it reached (a hash of its related cards at their revs), so two events that reach the same
// moment run the rule on it once, in this wake or a later one. Column Over Limit's go under the event's id and the
// card's, once per wake for one set of cards in the column: the events a wake reads all see the column as it is now.
async function derivedFor(
  deps: RunnerDeps,
  state: RunState,
  ruleId: string,
  trigger: DerivedTrigger,
  event: AutomationEvent,
): Promise<AutomationEvent[]> {
  state.plan ??= await readAutomationPlan(deps.env, deps.planId);
  if (state.cards?.event !== event.id)
    state.cards = { event: event.id, items: await listItems(deps.env, deps.planId) };
  const { items } = state.cards;
  const targets = derivedTargets(trigger, event, items, state.plan.types, state.plan.isDone);
  const moments = derivedMoments(trigger, targets, items, state.plan.types);
  if (trigger.kind === 'column_limit') {
    const tipped = (state.tipped ??= new Set());
    return targets.flatMap((card, i) => {
      const key = `${ruleId}:${moments[i]!}`;
      if (tipped.has(key)) return [];
      tipped.add(key);
      return [{ ...event, id: `${event.id}>${card.id}`, cardId: card.id }];
    });
  }
  return Promise.all(
    targets.map(async (card, i) => ({
      ...event,
      id: `d:${card.id}:${hex(await sha256(new TextEncoder().encode(moments[i])))}`,
      cardId: card.id,
    })),
  );
}

// One wake: the oldest waiting triggers, each against every rule that is on and hears it, in the list's order; a
// burst the queue dropped logged once; the Audit Trail trimmed. Asks for the next wake while more wait. Never throws.
export async function runAutomationWake(
  deps: RunnerDeps,
  schedule: AutomationSchedule,
  now: number,
  tally?: AutomationTally,
): Promise<number> {
  const sql = deps.sql();
  const rows = schedule.next(AUTOMATION_EVENTS_PER_WAKE + 1);
  const rules = deps.store.enabled();
  const state: RunState = { plan: null, today: runsToday(sql, now), ...(tally ? { tally } : {}) };
  let ran = 0;
  let left = false;
  const started = Date.now();
  for (const row of rows.slice(0, AUTOMATION_EVENTS_PER_WAKE)) {
    if (Date.now() - started > AUTOMATION_WAKE_MS) {
      left = true;
      break;
    }
    const event = row.event;
    for (const listed of event ? rules : []) {
      if (!triggerMatches(listed.trigger, event!, listed.id)) continue;
      // The rule as it is now: one this wake's own runs paused (ten failures), or a write turned off, deleted or
      // changed while the wake waited on the plan, runs as it now stands, or not at all.
      const rule = deps.store.get(listed.id);
      if (!rule?.enabled || !triggerMatches(rule.trigger, event!, rule.id)) continue;
      // Card Unblocked, Related Cards Done, Column Over Limit: the cards it concerns, worked out from the plan now. A
      // held run going on already names its card (the one the trigger found before the Wait).
      if (isDerivedTrigger(rule.trigger) && event!.kind !== 'resume') {
        for (const target of await derivedFor(deps, state, rule.id, rule.trigger, event!))
          if (await runRule(deps, state, rule, target)) ran += 1;
        continue;
      }
      if (await runRule(deps, state, rule, event!)) ran += 1;
    }
    // A held run that went no further (its rule off or gone since it was queued, the day spent) settles here, so it
    // never shows Waiting past its time; one that ran is settled already, and this changes nothing.
    if (event?.kind === 'resume' && event.origin)
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
      card: null,
      at: now,
      result: 'skipped',
      reason: QUEUE_FULL,
      tookMs: 0,
      steps: [],
    });
    schedule.dropped = 0;
    tally?.track('Plan', 'Ran', 'AutomationQueueFull');
  }
  trimRuns(sql, now);
  // A full batch leaves the rest a moment; a trigger the wake's own runs queued goes on the next wake.
  const more = left || rows.length > AUTOMATION_EVENTS_PER_WAKE;
  schedule.at = schedule.waiting() ? (more ? now + AUTOMATION_MORE_MS : now) : null;
  return ran;
}
