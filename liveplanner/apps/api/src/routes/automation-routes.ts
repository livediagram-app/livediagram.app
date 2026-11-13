// A plan's Automations, `/api/projects/:id/automations` (docs/specs/026-plan/automations.md; blueprint
// automations.md "Routes", "Agents and the CLI"), inside the plan's room. Every route is an Editor's of the whole plan,
// signed in or through that person's API token (a read-only token lists and reads the Audit Trail, nothing else),
// never a workbench session and never through a link confined to one tab: anyone else is answered 403
// `automations_need_editor`. A rule is checked by @liveplanner/items readRuleBody; it is on once it has an action.
// Test on a Card runs the rule as a dry run, changing nothing and logging nothing; Run Rule runs a Run from a Card
// rule at once. A time trigger's rule lists its next moment (`stats.nextAt`), and tests on the chosen card as if its
// moment had come.
import {
  AUTOMATION_RULES_MAX,
  AUTOMATION_RUNS_PER_DAY,
  INCOMING_WEBHOOK_PERSON,
  automationPerson,
  freeRuleName,
  isPersonless,
  isGithubTrigger,
  heardOfTrigger,
  GITHUB_PERSON,
  isTimeTrigger,
  isTrashed,
  readRuleBody,
  ruleHasAction,
  ruleNameTaken,
  ruleNeeds,
  typesOf,
  unheardFields,
  type AutomationEvent,
  type AutomationResult,
  type AutomationRule,
  type AutomationRuleBody,
  type ItemPerson,
} from '@liveplanner/items';
import type {
  AutomationError,
  AutomationErrorBody,
  AutomationHookInfo,
  AutomationListedRule,
  AutomationRunsQuery,
  AutomationsListResponse,
} from '@liveplanner/api-schema';
import { getProject } from '../db';
import { readItem } from '../db/items';
import { json, methodNotAllowed, noContent } from '../responses';
import { readAutomationPlan, type AutomationPlan } from '../plan-room/automations/automation-plan';
import { readPlanHead } from '../plan-room/plan-content';
import { listRuns, ruleStats, runsToday } from '../plan-room/automations/automation-log';
import { runRule } from '../plan-room/automations/automation-runner';
import type { PlanAutomations } from '../plan-room/automations/automation-queue';
import { hookInfos } from '../plan-room/automations/automation-incoming';
import { draftRule } from './automation-draft-route';
import { makeSecret } from './automation-hook-routes';
import { writer } from './item-route-kit';
import { gateEdit, missingProject, readBody, requireOwner, type PlanRouteContext } from './context';

// `ai`: the caller is an API token (an agent), whose stamps and Run Rule say so.
export type Gated = { projectId: string; hook: PlanAutomations; by: ItemPerson; ai: boolean };

const refuse = (
  status: number,
  error: AutomationError,
  more: Omit<AutomationErrorBody, 'error'> = {},
) => json({ error, ...more } satisfies AutomationErrorBody, { status });

const notFoundRule = () => refuse(404, 'automation_not_found');

// Who may come through (spec "Who may do what"): a signed-in person, or an API token of one (its account verified),
// never a workbench session, a guest or a link visitor with no account.
function signedInCaller(ctx: PlanRouteContext): boolean {
  if (ctx.workbench) return false;
  return ctx.token ? !!ctx.verifiedUserId : !!ctx.accountUserId;
}

// The door every route passes: an Editor of the whole plan, signed in, in person or through their token. A read-only
// token reads (GET) and nothing else, as the worker's choke point already answers it.
async function gate(ctx: PlanRouteContext, projectId: string): Promise<Gated | Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const doc = await getProject(ctx.env, projectId);
  if (!doc) return missingProject(ctx, projectId);
  if (ctx.token?.readOnly && ctx.request.method !== 'GET') {
    console.info('[automations] refused', { token: true, readOnly: true });
    return json({ error: 'read_only_token' }, { status: 403 });
  }
  const hook = ctx.env.AUTOMATIONS;
  if (!signedInCaller(ctx) || !hook || !(await gateEdit(ctx, projectId))) {
    console.info('[automations] refused', {
      token: !!ctx.token,
      signedIn: !!ctx.accountUserId,
      workbench: !!ctx.workbench,
    });
    return refuse(403, 'automations_need_editor');
  }
  return { projectId, hook, by: await writer(ctx, owner), ai: !!ctx.token };
}

// A stamp of the caller now: an agent's says so (spec "Agents and the CLI", "Who it was").
const stampOf = (g: Gated) => ({
  by: g.by,
  at: Date.now(),
  ...(g.ai ? { ai: true as const } : {}),
});

function listed(
  hook: PlanAutomations,
  plan: AutomationPlan,
  rule: AutomationRule,
  stats: ReturnType<typeof ruleStats>,
  nextAts: ReadonlyMap<string, number>,
  // An Incoming Webhook rule's address and secret (never the secret itself).
  hooks: ReadonlyMap<string, AutomationHookInfo> = new Map(),
): AutomationListedRule {
  const s = stats.get(rule.id);
  const info = hooks.get(rule.id);
  return {
    ...rule,
    ...(info ? { hook: info } : {}),
    stats: {
      lastRunAt: s?.lastRunAt ?? null,
      nextAt: isTimeTrigger(rule.trigger) ? (nextAts.get(rule.id) ?? null) : null,
      runsThisWeek: s?.runsThisWeek ?? 0,
      failuresInARow: hook.store.failures(rule.id),
    },
    needs: ruleNeeds(rule, plan.outline),
  };
}

async function answerRule(ctx: PlanRouteContext, g: Gated, rule: AutomationRule, status = 200) {
  const plan = await readAutomationPlan(ctx.env, g.projectId);
  const stats = ruleStats(g.hook.sql(), Date.now());
  const hooks = hookInfos(ctx.env, g.projectId, g.hook.sql(), [rule]);
  return json(
    { rule: listed(g.hook, plan, rule, stats, g.hook.store.nextAts(), hooks) },
    { status },
  );
}

async function list(ctx: PlanRouteContext, g: Gated): Promise<Response> {
  const now = Date.now();
  const plan = await readAutomationPlan(ctx.env, g.projectId);
  const stats = ruleStats(g.hook.sql(), now);
  const nextAts = g.hook.store.nextAts();
  const rules = g.hook.store.list();
  const hooks = hookInfos(ctx.env, g.projectId, g.hook.sql(), rules);
  const answer: AutomationsListResponse = {
    rules: rules.map((r) => listed(g.hook, plan, r, stats, nextAts, hooks)),
    runsToday: runsToday(g.hook.sql(), now),
    runsPerDay: AUTOMATION_RUNS_PER_DAY,
    // What an agent names people by, and words them with (spec "Agents and the CLI").
    people: plan.outline.people.map((p) => ({ id: p.id, name: p.name })),
  };
  return json(answer);
}

// The request's rule, checked, or the refusal. A Field Changed rule naming a field no write changes (Time Spent, a
// Votes tally) would never run: refused, naming the field, with the plan's types read only for such a rule.
async function bodyOf(
  ctx: PlanRouteContext,
  projectId: string,
): Promise<AutomationRuleBody | Response> {
  const raw = await readBody(ctx);
  if (raw instanceof Response) return raw;
  const read = readRuleBody(raw);
  if ('error' in read) return refuse(400, read.error, { path: read.path, message: read.message });
  const trigger = read.body.trigger;
  if (trigger.kind === 'field_changed') {
    const types = typesOf((await readPlanHead(ctx.env, projectId)).itemTypes);
    const [unheard] = unheardFields(types, trigger.fields);
    if (unheard)
      return refuse(400, 'automation_invalid', {
        path: `trigger.fields.${trigger.fields.indexOf(unheard.id)}`,
        message: `Field Changed never hears ${unheard.name}: it changes without an edit, so the rule would never run`,
      });
  }
  return read.body;
}

async function create(ctx: PlanRouteContext, g: Gated): Promise<Response> {
  const body = await bodyOf(ctx, g.projectId);
  if (body instanceof Response) return body;
  const rules = g.hook.store.list();
  if (rules.length >= AUTOMATION_RULES_MAX) return refuse(409, 'automation_rules_full');
  if (ruleNameTaken(body.name, rules))
    return refuse(409, 'automation_name_taken', { path: 'name' });
  const stamp = stampOf(g);
  const rule: AutomationRule = {
    ...body,
    id: crypto.randomUUID(),
    enabled: ruleHasAction(body),
    made: stamp,
    edited: stamp,
  };
  g.hook.store.insert(rule);
  console.info('[automations] rule.made', { trigger: rule.trigger.kind, enabled: rule.enabled });
  return answerRule(ctx, g, rule, 201);
}

async function save(ctx: PlanRouteContext, g: Gated, held: AutomationRule): Promise<Response> {
  const body = await bodyOf(ctx, g.projectId);
  if (body instanceof Response) return body;
  if (ruleNameTaken(body.name, g.hook.store.list(), held.id))
    return refuse(409, 'automation_name_taken', { path: 'name' });
  const rule: AutomationRule = {
    ...held,
    ...body,
    enabled: held.enabled && ruleHasAction(body),
    edited: stampOf(g),
  };
  g.hook.store.update(rule);
  return answerRule(ctx, g, rule);
}

async function toggle(ctx: PlanRouteContext, g: Gated, held: AutomationRule): Promise<Response> {
  const raw = await readBody(ctx);
  if (raw instanceof Response) return raw;
  if (typeof raw['enabled'] !== 'boolean')
    return refuse(400, 'automation_invalid', {
      path: 'enabled',
      message: 'enabled must be true or false',
    });
  const enabled = raw['enabled'];
  if (enabled && !ruleHasAction(held))
    return refuse(400, 'automation_invalid', {
      path: 'steps',
      message: 'a rule needs an action to be on',
    });
  const { paused: _paused, ...rest } = held;
  const rule: AutomationRule = enabled ? { ...rest, enabled } : { ...held, enabled };
  g.hook.store.update(rule, enabled ? 0 : undefined);
  console.info('[automations] rule.toggled', { enabled, resumed: enabled && !!held.paused });
  return answerRule(ctx, g, rule);
}

async function duplicate(ctx: PlanRouteContext, g: Gated, held: AutomationRule): Promise<Response> {
  const rules = g.hook.store.list();
  if (rules.length >= AUTOMATION_RULES_MAX) return refuse(409, 'automation_rules_full');
  const { paused: _paused, ...rest } = held;
  const stamp = stampOf(g);
  const rule: AutomationRule = {
    ...rest,
    id: crypto.randomUUID(),
    name: freeRuleName(`${held.name} copy`, rules),
    enabled: false,
    made: stamp,
    edited: stamp,
  };
  g.hook.store.insert(rule);
  return answerRule(ctx, g, rule, 201);
}

async function order(ctx: PlanRouteContext, g: Gated): Promise<Response> {
  const raw = await readBody(ctx);
  if (raw instanceof Response) return raw;
  const ids = raw['ids'];
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string') || !g.hook.store.order(ids))
    return refuse(400, 'automation_invalid', {
      path: 'ids',
      message: 'ids must name every rule once',
    });
  return noContent();
}

// A manual event on the card, by the caller.
const manualEvent = (
  g: Gated,
  cardId: string,
  prefix: string,
  ruleId?: string,
): AutomationEvent => ({
  id: `${prefix}:${crypto.randomUUID()}`,
  kind: 'manual',
  cardId,
  by: g.by,
  role: g.ai ? 'agent' : 'editor',
  ...(ruleId ? { ruleId } : {}),
  at: Date.now(),
});

async function cardOf(ctx: PlanRouteContext, g: Gated, raw: Record<string, unknown>) {
  const id = raw['item'];
  const item = typeof id === 'string' ? await readItem(ctx.env, g.projectId, id) : null;
  return item && !isTrashed(item) ? item : null;
}

const missingItem = () => json({ error: 'item_not_found' }, { status: 404 });

async function test(ctx: PlanRouteContext, g: Gated): Promise<Response> {
  const raw = await readBody(ctx);
  if (raw instanceof Response) return raw;
  const read = readRuleBody(raw['rule']);
  if ('error' in read)
    return refuse(400, read.error, { path: `rule.${read.path}`, message: read.message });
  const card = await cardOf(ctx, g, raw);
  const deps = g.hook.deps();
  if (!card || !deps) return missingItem();
  const stamp = stampOf(g);
  const rule: AutomationRule = {
    ...read.body,
    id: 'test',
    enabled: true,
    made: stamp,
    edited: stamp,
  };
  // A time trigger's rule runs as at its moment: by Automation, no person behind it; an Incoming Webhook rule's as if
  // a call had named the card, with an empty payload; a GitHub rule's as if one of the card's pull requests had just
  // done what its trigger hears, by GitHub.
  const trigger = rule.trigger;
  const event: AutomationEvent = isPersonless(trigger)
    ? {
        ...manualEvent(g, card.id, 't'),
        ...(isTimeTrigger(trigger)
          ? { kind: 'time' as const, by: automationPerson(rule.name) }
          : isGithubTrigger(trigger)
            ? { kind: 'github' as const, by: GITHUB_PERSON, github: heardOfTrigger(trigger) }
            : { kind: 'incoming' as const, by: INCOMING_WEBHOOK_PERSON, cards: 1 }),
        role: 'system',
      }
    : manualEvent(g, card.id, 't');
  // Whose turn it is for a saved rule (shown, never taken).
  const saved = typeof raw['ruleId'] === 'string' ? g.hook.store.get(raw['ruleId']) : null;
  const turn = saved ? g.hook.store.turn(saved.id) : 0;
  const run = await runRule(deps, { plan: null, today: 0 }, rule, event, { dry: true, turn });
  return json({ run });
}

async function runNow(ctx: PlanRouteContext, g: Gated, held: AutomationRule): Promise<Response> {
  if (held.trigger.kind !== 'manual' || !held.enabled) return refuse(409, 'automation_not_manual');
  const raw = await readBody(ctx);
  if (raw instanceof Response) return raw;
  const card = await cardOf(ctx, g, raw);
  const deps = g.hook.deps();
  if (!card || !deps) return missingItem();
  const today = runsToday(g.hook.sql(), Date.now());
  const run = await runRule(
    deps,
    { plan: null, today },
    held,
    manualEvent(g, card.id, 'm', held.id),
  );
  return run ? json({ run }) : refuse(429, 'automation_budget_spent');
}

const RESULTS: readonly AutomationResult[] = ['done', 'no_match', 'skipped', 'failed', 'waiting'];

function runs(ctx: PlanRouteContext, g: Gated): Response {
  const p = ctx.url.searchParams;
  const number = (key: string) => {
    const n = Number(p.get(key));
    return p.has(key) && Number.isFinite(n) ? n : undefined;
  };
  const result = p.get('result') as AutomationResult | null;
  const since = number('since');
  const limit = number('limit');
  const query: AutomationRunsQuery = {
    ...(p.get('rule') ? { rule: p.get('rule')! } : {}),
    ...(result && RESULTS.includes(result) ? { result } : {}),
    ...(since !== undefined ? { since } : {}),
    ...(limit !== undefined ? { limit } : {}),
  };
  return json({ runs: listRuns(g.hook.sql(), query) });
}

type Door = (g: Gated) => Response | Promise<Response>;
type RuleDoor = (ctx: PlanRouteContext, g: Gated, held: AutomationRule) => Promise<Response>;

function remove(_ctx: PlanRouteContext, g: Gated, held: AutomationRule): Promise<Response> {
  g.hook.store.remove(held.id);
  return Promise.resolve(noContent());
}

// The door a path and method name, before anything is read: null for no such path, 'method' for a verb it lacks.
function doorOf(ctx: PlanRouteContext): Door | 'method' | null {
  const { segments } = ctx;
  const method = ctx.request.method;
  const on = (verb: string, door: Door): Door | 'method' => (method === verb ? door : 'method');
  const ofRule =
    (door: RuleDoor): Door =>
    (g) => {
      const held = g.hook.store.get(segments[4]!);
      return held ? door(ctx, g, held) : notFoundRule();
    };
  if (segments.length === 4) {
    if (method === 'GET') return (g) => list(ctx, g);
    return on('POST', (g) => create(ctx, g));
  }
  if (segments.length === 5) {
    if (segments[4] === 'order') return on('POST', (g) => order(ctx, g));
    if (segments[4] === 'test') return on('POST', (g) => test(ctx, g));
    // Describe a Rule (automation-draft-route.ts): a rule drafted from words, saved nowhere.
    if (segments[4] === 'draft') return on('POST', (g) => draftRule(ctx, g));
    if (segments[4] === 'runs') return on('GET', (g) => runs(ctx, g));
    if (method === 'PUT') return ofRule(save);
    return on('DELETE', ofRule(remove));
  }
  if (segments.length !== 6) return null;
  if (segments[5] === 'toggle') return on('POST', ofRule(toggle));
  if (segments[5] === 'duplicate') return on('POST', ofRule(duplicate));
  if (segments[5] === 'run') return on('POST', ofRule(runNow));
  // An Incoming Webhook rule's secret, made or made again (automation-hook-routes.ts).
  if (segments[5] === 'secret') return on('POST', ofRule(makeSecret));
  return null;
}

// `/api/projects/:id/automations[/…]`, or null for any other path.
export async function handleAutomationRoutes(ctx: PlanRouteContext): Promise<Response | null> {
  if (ctx.segments[3] !== 'automations') return null;
  const door = doorOf(ctx);
  if (door === null) return null;
  if (door === 'method') return methodNotAllowed();
  const g = await gate(ctx, ctx.segments[2]!);
  return g instanceof Response ? g : door(g);
}
