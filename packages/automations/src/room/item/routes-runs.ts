// The routes that run and read (liveworkspace/docs/specs/018-automations/automations.md "Test Rule and Run Rule",
// "Who may do what"; blueprint item-engine.md "Routes"): Test Rule (a dry run of the rule as the builder holds it),
// Run Rule (a Run by Hand rule, now), the Audit Trail, Make Secret, and one rule's summary for any reader.
import type {
  AutomationRunResponse,
  AutomationRunsResponse,
  AutomationSecretResponse,
  AutomationSummaryResponse,
} from '@liveworkspace/api-schema/automations';
import {
  ITEM_INCOMING_EVENT,
  ITEM_MANUAL_EVENT,
  ITEM_SETTLED_EVENT,
  ITEM_TIME_EVENT,
  itemNames,
  itemRuleSummary,
  readItemRule,
  type ItemEvent,
  type ItemRule,
  type ItemRun,
} from '../../item';
import type { AutomationRuleSummary } from '../../summary';
import type { AutomationResult, AutomationRunsQuery } from '../../types';
import type { Obj } from '../../validate-read';
import { makeHookSecret } from '../automation-incoming';
import { listRuns } from '../automation-log';
import { runItemRule, type ItemRunState } from './run';
import {
  json,
  notFoundRule,
  readBody,
  refuse,
  stampOf,
  type Gated,
  type ItemRoutesInput,
} from './route-kit';

const DAY_MS = 24 * 60 * 60 * 1000;

const tabNotFound = (): Response => json({ error: 'tab_not_found' }, 404);

// The tab a body names: absent (none), its id, or null when the item has no such tab.
async function tabOf(g: Gated, raw: Obj): Promise<string | null | undefined> {
  const tab = raw['tab'];
  if (tab === undefined) return undefined;
  const { tabs } = await g.deps.kit.outline();
  return typeof tab === 'string' && tabs.some((t) => t.id === tab) ? tab : null;
}

// The event a test runs the rule on: what its trigger would hear, by the caller unless nobody is behind it.
function testEvent(g: Gated, rule: ItemRule, tab: string | undefined): ItemEvent {
  const def = g.deps.kit.kinds.trigger(rule.trigger.kind)!;
  const kind = def.time
    ? ITEM_TIME_EVENT
    : def.settle
      ? ITEM_SETTLED_EVENT
      : rule.trigger.kind === 'incoming_webhook'
        ? ITEM_INCOMING_EVENT
        : (def.hears[0] ?? ITEM_MANUAL_EVENT);
  return {
    id: `t:${crypto.randomUUID()}`,
    kind,
    at: Date.now(),
    ruleId: rule.id,
    ...(tab !== undefined ? { tab } : {}),
    ...(def.personless
      ? {}
      : { by: g.caller.person, role: g.ai ? ('agent' as const) : ('editor' as const) }),
  };
}

export async function testRule(g: Gated): Promise<Response> {
  const raw = await readBody(g.request);
  if (raw instanceof Response) return raw;
  const read = readItemRule(raw['rule'], g.deps.kit.kinds);
  // A rule that is no object is refused at `rule` itself, the body's own key.
  if ('error' in read)
    return refuse(400, read.error, {
      path: read.path === 'rule' ? 'rule' : `rule.${read.path}`,
      message: read.message,
    });
  const tab = await tabOf(g, raw);
  if (tab === null) return tabNotFound();
  const stamp = stampOf(g);
  const rule: ItemRule = { ...read.body, id: 'test', enabled: true, made: stamp, edited: stamp };
  const run = await runItemRule(
    g.deps,
    { outline: null, today: 0 },
    rule,
    testEvent(g, rule, tab),
    {
      dry: true,
    },
  );
  return json({ run: run! } satisfies AutomationRunResponse<ItemRun>);
}

const manual = (rule: ItemRule): boolean => rule.trigger.kind === 'manual' && rule.enabled;

export async function runRuleNow(g: Gated, read: ItemRule): Promise<Response> {
  if (!manual(read)) return refuse(409, 'automation_not_manual');
  const raw = await readBody(g.request);
  if (raw instanceof Response) return raw;
  const tab = await tabOf(g, raw);
  if (tab === null) return tabNotFound();
  // Turned off, changed away from Run by Hand or deleted while the body was read: it runs as it now stands.
  const held = g.deps.store.get(read.id);
  if (!held) return notFoundRule();
  if (!manual(held)) return refuse(409, 'automation_not_manual');
  const event: ItemEvent = {
    id: `m:${crypto.randomUUID()}`,
    kind: ITEM_MANUAL_EVENT,
    at: Date.now(),
    ruleId: held.id,
    by: g.caller.person,
    role: g.ai ? 'agent' : 'editor',
    ...(tab !== undefined ? { tab } : {}),
  };
  // The day's count is read as the run claims its row.
  const state: ItemRunState = { outline: null, today: 0 };
  const run = await runItemRule(g.deps, state, held, event);
  if (run) return json({ run } satisfies AutomationRunResponse<ItemRun>);
  if (state.spent) {
    const now = Date.now();
    const midnight = (Math.floor(now / DAY_MS) + 1) * DAY_MS;
    return json({ error: 'automation_budget_spent' }, 429, {
      'Retry-After': String(Math.max(1, Math.ceil((midnight - now) / 1000))),
    });
  }
  // Its claim failed or it never settled: nothing to show, and Run Rule may be tried again.
  console.warn('[automations] run.unstarted');
  return refuse(500, 'automation_run_failed');
}

const RESULTS: readonly string[] = ['done', 'no_match', 'skipped', 'failed', 'waiting'];

export function listItemRuns(g: Gated): Response {
  const p = g.url.searchParams;
  const number = (key: string) => {
    const n = Number(p.get(key));
    return p.has(key) && Number.isFinite(n) ? n : undefined;
  };
  const rule = p.get('rule');
  const result = p.get('result');
  const since = number('since');
  const limit = number('limit');
  const query: AutomationRunsQuery = {
    ...(rule ? { rule } : {}),
    ...(result && RESULTS.includes(result) ? { result: result as AutomationResult } : {}),
    ...(since !== undefined ? { since } : {}),
    ...(limit !== undefined ? { limit } : {}),
  };
  // At most AUTOMATION_RUNS_LIST_MAX rows, whatever the Audit Trail holds.
  const runs = listRuns<ItemRun>(g.deps.sql(), query);
  return json({ runs } satisfies AutomationRunsResponse<ItemRun>);
}

/** Make Secret and Regenerate: a new secret for an Incoming Webhook rule, the old one stopped at once. */
export async function makeSecret(g: Gated, held: ItemRule): Promise<Response> {
  // Never through an API token, whatever the gate lets through.
  if (g.caller.token) return refuse(403, 'automations_need_editor');
  if (held.trigger.kind !== 'incoming_webhook') return refuse(409, 'automation_not_incoming');
  const { kit } = g.deps;
  const made = await makeHookSecret((id) => kit.hookUrl(id), g.deps.sql(), held.id, Date.now());
  console.info('[automations] hook.secret');
  return json(made satisfies AutomationSecretResponse, 201, { 'Cache-Control': 'no-store' });
}

// The longest rule id or name the summary reads.
const ASKED_MAX = 200;

const asked = (value: string | null) =>
  value !== null && value.length > 0 && value.length <= ASKED_MAX ? value : null;

/** One rule as anyone who may read the item sees it: by id (`?rule=`), else by name (`?name=`, case aside). */
export async function ruleSummaryRoute(input: ItemRoutesInput): Promise<Response> {
  const deps = input.engine.deps();
  if (!input.caller.reader) return refuse(403, 'automations_need_editor');
  if (!deps) return notFoundRule();
  const rules = deps.store.list();
  const id = asked(input.url.searchParams.get('rule'));
  const name = asked(input.url.searchParams.get('name'))?.trim().toLowerCase();
  const rule = id
    ? rules.find((r) => r.id === id)
    : name
      ? rules.find((r) => r.name.toLowerCase() === name)
      : undefined;
  if (!rule) return notFoundRule();
  const { kit } = deps;
  const names = itemNames(kit.itemWord, await kit.outline());
  const answer: AutomationSummaryResponse<AutomationRuleSummary> = {
    rule: itemRuleSummary(rule, kit.kinds, names),
  };
  return json(answer);
}
