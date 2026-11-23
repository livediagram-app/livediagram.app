// One rule answering one trigger, for an item with no cards (liveworkspace/docs/specs/018-automations/automations.md
// "Runs, limits and loops", "Steps every app has", "Test Rule and Run Rule"; blueprint item-engine.md "A wake"). The
// same guarantees as the first app's runner: the run's id is a hash of the trigger and the rule, claimed on the
// Audit Trail before anything is done, so a retry never runs a rule twice for one trigger; then the day's budget,
// the chain (never its own change; a rule that keeps its changes to itself starts nothing; five rules deep), the
// conditions, with Pro on one of the owner's Automation Runs for the month, and the steps in order, a failed one stopping the run with those before it done. A Wait holds the
// rest for a run of its own; ten failures in a row pause the rule. A run never throws: anything unexpected is a
// failed run. A dry run (Test Rule) claims nothing, changes nothing and says what each step would do.
import { Failed, allHold } from '../../failed';
import {
  ITEM_RESUME_EVENT,
  eventTabName,
  itemNames,
  itemTriggerLine,
  itemValueResolver,
  type ItemEvent,
  type ItemFillContext,
  type ItemHoldContext,
  type ItemIf,
  type ItemNames,
  type ItemOutline,
  type ItemPart,
  type ItemRule,
  type ItemRun,
  type ItemSummarise,
} from '../../item';
import { AUTOMATION_CHAIN_MAX } from '../../limits';
import type {
  AutomationActionLine,
  AutomationGone,
  AutomationOutgoing,
  AutomationResult,
  AutomationStepLine,
  AutomationSubject,
  AutomationWait,
} from '../../types';
import { fillValues } from '../../values';
import { sha256Hex } from '../automation-incoming';
import {
  budgetLineId,
  claimRun,
  dropRun,
  monthLineId,
  noteLineOnce,
  runsToday,
  settleRun,
  settleWaiting,
} from '../automation-log';
import { sendMessages } from '../automation-sends';
import type { AutomationTally } from '../automation-telemetry';
import { WAIT_CONDITIONS, WAIT_RULE_CHANGED, holdRun, waitFullWords } from '../automation-waits';
import { SHARED_RUNNERS } from './actions';
import { chainOf } from '../../cross-app/chain';
import { fillCrossAppStep, runCrossAppStep } from '../cross-app';
import { isCrossAppKind, type CrossAppChain, type CrossAppStep } from '@liveworkspace/index-client';
import { runSummarise, type AiCount } from './ai';
import type { ItemActionContext, ItemDeps, ItemSource } from './kit';
import { ITEM_TELEMETRY_ACTION, tallyItemRun } from './telemetry';
import { withItemWriter } from './writer';
import { RUNS_USED, runsOfMonthUsed } from '../tier';

export const CHAIN_STOPPED = `Chain stopped after ${AUTOMATION_CHAIN_MAX} rules`;
export const CHAIN_KEPT = "Started by another rule's change";
export const BUDGET_SPENT = 'Daily limit reached: rules run again tomorrow';
export const WENT_WRONG = 'Something went wrong';

// What one wake (or one request) reads once: the item, the runs started today and the AI asks made today.
export type ItemRunState = AiCount & {
  outline: ItemOutline | null;
  today: number;
  // The room's claims (AutomationStore.claims) when `today` was last right; absent, `today` is read at the claim.
  claims?: number;
  // A wake's counts; absent for Test Rule and Run Rule, which the browser counts.
  tally?: AutomationTally;
  // Set when a run never started for the day's budget (Run Rule answers 429 for it, any other null 500).
  spent?: boolean;
  // The rules whose budget line this state has seen written or there already, so a wake writes each once.
  noted?: Set<string>;
  // Set once a run was refused for the owner's month: the rest of the wake asks the service nothing more (Run Rule
  // answers 429 automation_runs_used for it).
  monthUsed?: boolean;
  // The rules whose month line this state has seen written or there already.
  monthNoted?: Set<string>;
};

export type ItemRunOptions = { dry?: boolean };

export const itemRunId = (eventId: string, ruleId: string): Promise<string> =>
  sha256Hex(`${eventId}:${ruleId}`);

// Why a rule's change starts no further rule, or null when it may.
function chainStop(event: ItemEvent, deps: ItemDeps): string | null {
  if (event.role !== 'automation' || event.rule === undefined) return null;
  if (!deps.store.get(event.rule)?.chain) return CHAIN_KEPT;
  return (event.chain ?? 0) >= AUTOMATION_CHAIN_MAX ? CHAIN_STOPPED : null;
}

const action = (ok: boolean, text: string, gone?: AutomationGone): AutomationActionLine => ({
  kind: 'action',
  ok,
  text,
  ...(gone ? { gone } : {}),
});

// The day's budget spent: the rule's one Audit Trail line for the day, written if it is not there yet (one
// statement a rule a wake, never one a trigger).
function noteBudgetSpent(sql: ItemDepsSql, state: ItemRunState, rule: ItemRule, at: number): void {
  state.spent = true;
  state.noted ??= new Set();
  if (state.noted.has(rule.id)) return;
  state.noted.add(rule.id);
  noteLineOnce(sql, {
    id: budgetLineId(rule.id, at),
    ruleId: rule.id,
    ruleName: rule.name,
    subject: null,
    at,
    result: 'skipped',
    reason: BUDGET_SPENT,
    tookMs: 0,
    steps: [],
  } satisfies ItemRun);
}

// A step in another app's telemetry event (spec "Steps in other apps" "Telemetry").
export const crossAppEvent = (out: { ok: boolean; pause?: true; skip?: true; text: string }) =>
  out.ok
    ? 'CrossAppDone'
    : out.pause
      ? 'CrossAppNoAccess'
      : out.skip
        ? out.text.startsWith('Skipped') || out.text.startsWith('Stopped after')
          ? 'CrossAppLoop'
          : 'CrossAppCapped'
        : 'CrossAppFailed';
// The owner's month used: the rule's one Audit Trail line for the UTC day, as the budget's is written.
function noteMonthUsed(sql: ItemDepsSql, state: ItemRunState, rule: ItemRule, at: number): void {
  state.monthUsed = true;
  state.monthNoted ??= new Set();
  if (state.monthNoted.has(rule.id)) return;
  state.monthNoted.add(rule.id);
  noteLineOnce(sql, {
    id: monthLineId(rule.id, at),
    ruleId: rule.id,
    ruleName: rule.name,
    subject: null,
    at,
    result: 'skipped',
    reason: RUNS_USED,
    tookMs: 0,
    steps: [],
  } satisfies ItemRun);
}

// The owner's month of runs, spent for a run about to act (tier.ts).
async function monthOfRunsUsed(
  deps: Pick<ItemDeps, 'store' | 'tier'>,
  state: ItemRunState,
  at: number,
): Promise<boolean> {
  if (state.monthUsed) return true;
  return runsOfMonthUsed(deps.store, deps.tier, at);
}

type ItemDepsSql = ReturnType<ItemDeps['sql']>;

/** One rule answering one trigger: the run, or null when it never started (its own change, the budget spent, the
 *  owner's month used, ran already, or a chain stop whose conditions did not hold). The budget spent sets
 *  `state.spent`, the month used `state.monthUsed`, and each writes the rule's one line for the day. */
export async function runItemRule(
  deps: ItemDeps,
  state: ItemRunState,
  rule: ItemRule,
  event: ItemEvent,
  opts: ItemRunOptions = {},
): Promise<ItemRun | null> {
  if (event.rule === rule.id) return null;
  const { kit, store } = deps;
  const { kinds } = kit;
  const sql = deps.sql();
  const id = await itemRunId(event.id, rule.id);
  const at = Date.now();
  const dry = opts.dry === true;
  if (!dry) {
    // The day's count read again when another request claimed a run since this one last did, with no await before
    // the claim: runs at once never pass the day between them, and a wake alone reads it once.
    if (state.claims !== store.claims) state.today = runsToday(sql, at);
    if (state.today >= store.runsPerDay) return (noteBudgetSpent(sql, state, rule, at), null);
    if (!claimRun(sql, id, rule.id, at)) return null;
    store.claims += 1;
    state.claims = store.claims;
  }
  const lines: AutomationStepLine[] = [];
  let subject: AutomationSubject | null = null;
  let webhook: string | undefined;
  let waitsUntil: number | undefined;
  const resume = event.kind === ITEM_RESUME_EVENT;
  const end = (result: AutomationResult, reason?: string, gone?: AutomationGone): ItemRun => {
    const run: ItemRun = {
      id,
      ruleId: rule.id,
      ruleName: rule.name,
      subject,
      at,
      result,
      ...(reason ? { reason } : {}),
      ...(reason && gone ? { gone } : {}),
      tookMs: Date.now() - at,
      steps: lines,
      ...(waitsUntil !== undefined ? { waitsUntil } : {}),
      ...(resume && event.waited ? { afterWait: event.waited } : {}),
    };
    if (dry) return run;
    settleRun(sql, run);
    // The run a Wait held went on: its own row is done (what it did before the Wait stays).
    if (resume && event.origin) settleWaiting(sql, event.origin, 'done');
    // The day's budget counts what ran: a No Match is logged but costs nothing.
    if (result !== 'no_match') state.today += 1;
    if (
      (result === 'done' || result === 'failed' || result === 'waiting') &&
      store.settle(rule.id, result === 'waiting' ? 'done' : result, reason ?? '', at, {
        ...(webhook ? { webhook } : {}),
        ...(reason && gone ? { gone } : {}),
      })
    )
      state.tally?.track(kit.category, ITEM_TELEMETRY_ACTION, 'AutomationPaused');
    if (state.tally) tallyItemRun(state.tally, kit.category, result, rule.trigger.kind);
    console.info('[automations] run', { result, trigger: rule.trigger.kind, tookMs: run.tookMs });
    return run;
  };
  try {
    state.outline ??= await kit.outline();
    const outline = state.outline;
    const names: ItemNames = itemNames(kit.itemWord, outline);
    lines.push(itemTriggerLine(rule, event, kinds, names));
    if (resume && rule.edited.at !== event.edited) return end('skipped', WAIT_RULE_CHANGED);
    const stop = chainStop(event, deps);
    const held = event.tab === undefined ? undefined : outline.tabs.find((t) => t.id === event.tab);
    const tab = held ? { id: held.id, name: held.name, url: kit.tabUrl(held.id) } : null;
    // A tab since removed is still what the run is about, by the name its event kept.
    if (event.tab !== undefined)
      subject = {
        id: event.tab,
        title: tab?.name ?? eventTabName(event, names),
        ...(tab ? { url: tab.url } : {}),
      };
    const own = kit.values ? await kit.values(event) : undefined;
    const carried = event.data?.['summary'];
    const filling: ItemFillContext = {
      event,
      outline,
      tab,
      // What a Summarise step before a Wait made rides the held event.
      summary: resume && typeof carried === 'string' ? carried : '',
      rule,
      now: at,
      timeZone: rule.timeZone,
      ...(own ? { own } : {}),
    };
    const resolve = itemValueResolver(kinds, filling);
    const fill = (text: string) => fillValues(text, resolve);
    const holding: ItemHoldContext = {
      event,
      now: at,
      timeZone: rule.timeZone,
      names,
      value: resolve,
    };
    const check = (conditions: readonly ItemPart[]) => {
      const all = allHold(conditions, (c) => {
        const def = kinds.condition(c.kind);
        return def
          ? def.holds(c, holding)
          : { ok: false, text: `${c.kind} is not a condition here` };
      });
      for (const line of all.lines) lines.push({ kind: 'condition', ...line });
      return all.ok;
    };
    const holds = check(rule.conditions);
    if (stop) {
      if (!holds) return (dropRun(sql, id), null);
      return end('skipped', stop);
    }
    if (!holds) return resume ? end('no_match', WAIT_CONDITIONS) : end('no_match');
    // The run acts: one of the owner's runs this month, spent before its first step (a run going on after a Wait
    // spent when it started). The month used drops the claim, so the run never started.
    if (!dry && !resume && (await monthOfRunsUsed(deps, state, at)))
      return (dropRun(sql, id), noteMonthUsed(sql, state, rule, at), null);

    // The chain across apps this run goes on in: its event's, or one it starts.
    const cross: CrossAppChain = chainOf(event.cross, id);
    const source: ItemSource = {
      role: 'automation',
      rule: rule.id,
      chain: (event.chain ?? 0) + 1,
      ...(event.cross ? { cross } : {}),
    };
    const ctx: ItemActionContext = { rule, event, outline, names, tab, fill, source, now: at };
    // A step the day's limit held back skips only itself: the run goes on and is Skipped once the rest is done.
    let capped: string | undefined;
    const shared = {
      deps,
      cap: (reason: string) => {
        capped ??= reason;
      },
    };
    // One action: what it would do (a dry run), or done through its runner inside the rule's own write window.
    const act = async (step: ItemPart): Promise<AutomationActionLine> => {
      const def = kinds.action(step.kind);
      if (!def) return action(false, `${step.kind} is not a step here`);
      if (dry) return action(true, def.would(step, { fill, names }));
      const runner = SHARED_RUNNERS.get(step.kind);
      const mine = Object.hasOwn(kit.run, step.kind) ? kit.run[step.kind] : undefined;
      if (!runner && !mine) return action(false, `${def.name} can't run here`);
      try {
        const outcome = await withItemWriter(
          sql,
          { who: source, own: true },
          () => (runner ? runner(step, ctx, shared) : mine!(step, ctx)),
          deps.fed(),
        );
        return action(outcome.ok, outcome.text, outcome.ok ? undefined : outcome.gone);
      } catch (error) {
        if (error instanceof Failed) return action(false, error.message, (error as Failed).gone);
        throw error;
      }
    };
    let asked = 0;
    for (let i = resume ? (event.step ?? 0) : 0; i < rule.steps.length; i += 1) {
      const step = rule.steps[i]!;
      if (step.kind === 'wait') {
        const wait = step as unknown as AutomationWait;
        // A test plans past every Wait.
        if (dry) {
          lines.push(await act(step));
          continue;
        }
        const going: ItemEvent = filling.summary
          ? { ...event, data: { ...event.data, summary: filling.summary } }
          : event;
        const until = holdRun(
          sql,
          id,
          rule.id,
          going,
          rule.edited.at,
          { hours: wait.hours, from: i + 1 },
          Date.now(),
        );
        if (until === null) {
          const full = waitFullWords(kit.itemWord);
          lines.push(action(false, full));
          return end('failed', full);
        }
        waitsUntil = until;
        // The room's alarm asks again: this run may be the earliest to go on.
        deps.wake();
        return end('waiting');
      }
      if (step.kind === 'notify' && !dry) {
        const message = step as unknown as AutomationOutgoing;
        const sent: AutomationActionLine[] = [];
        const out = await sendMessages(
          {
            client: kit.sends,
            itemId: kit.itemId,
            runId: id,
            rule: rule.name,
            subject: tab ? { title: tab.name, url: tab.url } : null,
            at,
            // With Pro on, one of the owner's Automation Runs for the message, spent before it is pushed.
            ...(deps.tier ? { spend: (n: number) => deps.tier!.spend('automationRuns', n) } : {}),
          },
          [
            {
              step: i,
              line: 0,
              webhook: message.webhook,
              ...(message.name !== undefined ? { name: message.name } : {}),
              text: fill(message.text),
            },
          ],
          sent,
          0,
        );
        lines.push(sent[0]!);
        // Held back for the owner's month, with nothing wrong with the rule: the run goes on and is Skipped.
        if (out.skipped !== undefined) shared.cap(out.skipped);
        else if (out.failed !== undefined) {
          webhook = out.webhook;
          return end('failed', out.failed);
        }
        continue;
      }
      if (step.kind === 'ai' && !dry) {
        const summarised = await runSummarise(deps, state, step as unknown as ItemSummarise, {
          id,
          asked,
          tab: event.tab,
          now: at,
        });
        lines.push(summarised.line);
        if (summarised.line.ai) asked += 1;
        if (summarised.capped) shared.cap(summarised.capped);
        else if (!summarised.line.ok) return end('failed', summarised.line.text);
        filling.summary = summarised.summary ?? '';
        continue;
      }
      if (isCrossAppKind(step.kind) && !dry) {
        const out = await runCrossAppStep(
          {
            client: kit.crossApp?.client ?? null,
            sql,
            app: kit.crossApp?.app ?? 'livediagram',
            itemId: kit.itemId,
            rule: { id: rule.id, name: rule.name },
            author: rule.edited.by.id,
            from: { title: outline.name, url: tab?.url ?? outline.url },
            chain: cross,
            key: `${id}:${i}`,
            now: at,
          },
          kit.crossApp ? fillCrossAppStep(step as unknown as CrossAppStep, fill) : null,
        );
        lines.push(action(out.ok, out.text));
        state.tally?.track(kit.category, ITEM_TELEMETRY_ACTION, crossAppEvent(out));
        if (out.ok) continue;
        if (out.skip) {
          shared.cap(out.text);
          continue;
        }
        if (out.pause && store.pauseNow(rule.id, out.text, at))
          state.tally?.track(kit.category, ITEM_TELEMETRY_ACTION, 'AutomationPaused');
        return end('failed', out.text);
      }
      const branch = step.kind === 'if' ? (step as unknown as ItemIf) : null;
      const list = branch ? (check(branch.conditions) ? branch.then : branch.else) : [step];
      for (const one of list) {
        const line = await act(one);
        lines.push(line);
        if (!line.ok) return end('failed', line.text, line.gone);
      }
    }
    return capped === undefined ? end('done') : end('skipped', capped);
  } catch (error) {
    console.warn('[automations] run.threw', { error: String(error) });
    state.tally?.track(kit.category, ITEM_TELEMETRY_ACTION, 'AutomationCrashed');
    try {
      return end('failed', WENT_WRONG);
    } catch (settling) {
      console.warn('[automations] run.unsettled', { error: String(settling) });
      return null;
    }
  }
}
