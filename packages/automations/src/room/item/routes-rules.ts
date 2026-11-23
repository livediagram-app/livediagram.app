// The Rules list's routes (liveworkspace/docs/specs/018-automations/automations.md "A rule", "Who may do what",
// "Revert to Snapshot"; blueprint item-engine.md "Routes"): list, create, save, delete, turn on and off, duplicate
// and reorder. A rule is checked by the kinds' own readers; it is on once it has a step. An API token never picks a
// connection: it may keep the ones a rule already names, unchanged.
import type { AutomationsListResponse } from '@liveworkspace/api-schema/automations';
import {
  readItemRule,
  refsOf,
  ruleHasStep,
  ruleLeftToPick,
  ruleNeedsPerson,
  snapshotsFull,
  type ItemRef,
  type ItemRule,
  type ItemRuleBody,
} from '../../item';
import { tierRefusal } from '@liveworkspace/subscription';
import { listTier, recountRules, rulesAtLimit, rulesOverLimit, type RulesFull } from '../tier';
import { freeRuleName, ruleNameTaken } from '../../validate';
import { runsToday } from '../automation-log';
import {
  answerRule,
  json,
  listed,
  listingOf,
  noContent,
  notFoundRule,
  readBody,
  refuse,
  stampOf,
  type Gated,
} from './route-kit';

// The owner holds every rule their tier allows (in the tier's own numbers, with Pro on), or the item its own bound
// (no tier named, nothing offered, but for a guest's item, whose bound is Free's).
const rulesFull = (g: Gated, full: RulesFull): Response =>
  refuse(
    409,
    'automation_rules_full',
    full.owner || g.deps.tier?.guest
      ? tierRefusal(g.deps.tier, 'automationRules', full.used, full.max)
      : {},
  );

// Another add or delete landed while the count was asked: what the item holds now is told too.
function recounted(g: Gated, told: number): void {
  if (g.deps.store.count() !== told) recountRules(g.deps.tier, g.deps.kit.itemId, g.deps.store);
}

export async function listRules(g: Gated): Promise<Response> {
  const rules = g.deps.store.list();
  const l = await listingOf(g, rules);
  const answer: AutomationsListResponse<ItemRule, ItemRef> = {
    rules: rules.map((r) => listed(g, r, l)),
    runsToday: runsToday(g.deps.sql(), Date.now()),
    ...listTier(g.deps.store, g.deps.tier ?? null),
    // What an agent names tabs and people by.
    tabs: l.outline.tabs.map((t) => ({ id: t.id, name: t.name })),
    people: l.outline.people.map((p) => ({ id: p.id, name: p.name })),
  };
  return json(answer);
}

// Only a person saves a rule that holds a step an API token may not (Revert to Snapshot).
const needsAPerson = (g: Gated, rule: Pick<ItemRuleBody, 'steps'>): Response | null =>
  g.ai && ruleNeedsPerson(rule, g.deps.kit.kinds) ? refuse(403, 'automation_needs_a_person') : null;

/** The connections a rule (or any part of one) names: every non-empty `webhook` field, each once. */
export const ruleConnections = (value: unknown): Set<string> =>
  new Set(
    refsOf(value)
      .filter((r) => r.kind === 'connection' && r.id !== '')
      .map((r) => r.id),
  );

// Only a person picks a connection: a token's rule may name only those `kept` already names (none for a new rule).
function picksAConnection(
  g: Gated,
  rule: Pick<ItemRuleBody, 'steps'>,
  kept: ReadonlySet<string>,
): Response | null {
  if (!g.ai) return null;
  for (const id of ruleConnections(rule.steps))
    if (!kept.has(id)) return refuse(403, 'automation_connection_needs_a_person');
  return null;
}

// The request's rule, checked, or the refusal.
async function bodyOf(g: Gated): Promise<ItemRuleBody | Response> {
  const raw = await readBody(g.request);
  if (raw instanceof Response) return raw;
  const read = readItemRule(raw, g.deps.kit.kinds);
  if ('error' in read) return refuse(400, read.error, { path: read.path, message: read.message });
  return needsAPerson(g, read.body) ?? read.body;
}

export async function createRule(g: Gated): Promise<Response> {
  const body = await bodyOf(g);
  if (body instanceof Response) return body;
  const picked = picksAConnection(g, body, new Set());
  if (picked) return picked;
  const { store } = g.deps;
  const rules = store.list();
  if (ruleNameTaken(body.name, rules))
    return refuse(409, 'automation_name_taken', { path: 'name' });
  if (snapshotsFull([...rules, body])) return refuse(409, 'automation_snapshots_full');
  // Asked last: a growing count is recorded once taken.
  const full = await rulesAtLimit(store, g.deps.tier ?? null, rules.length, g.deps.kit.itemId);
  if (full) return rulesFull(g, full);
  const stamp = stampOf(g);
  const rule: ItemRule = {
    ...body,
    id: crypto.randomUUID(),
    enabled: ruleHasStep(body),
    made: stamp,
    edited: stamp,
  };
  store.insert(rule);
  recounted(g, rules.length + 1);
  console.info('[automations] rule.made', { trigger: rule.trigger.kind, enabled: rule.enabled });
  return answerRule(g, rule, 201);
}

export async function saveRule(g: Gated, read: ItemRule): Promise<Response> {
  const body = await bodyOf(g);
  if (body instanceof Response) return body;
  const { store } = g.deps;
  // The rule as it is now, after the body's await: one deleted meanwhile is not found, one turned off stays off.
  const held = store.get(read.id);
  if (!held) return notFoundRule();
  // A token keeps only the connections the rule names now (checked on the rule as it stands, after the await).
  const picked = picksAConnection(g, body, ruleConnections(held.steps));
  if (picked) return picked;
  const rules = store.list();
  if (ruleNameTaken(body.name, rules, held.id))
    return refuse(409, 'automation_name_taken', { path: 'name' });
  if (snapshotsFull(rules.map((r) => (r.id === held.id ? body : r))))
    return refuse(409, 'automation_snapshots_full');
  const rule: ItemRule = {
    ...held,
    ...body,
    enabled: held.enabled && ruleHasStep(body),
    edited: stampOf(g),
  };
  store.update(rule);
  return answerRule(g, rule);
}

export function removeRule(g: Gated, held: ItemRule): Promise<Response> {
  g.deps.store.remove(held.id);
  recountRules(g.deps.tier, g.deps.kit.itemId, g.deps.store);
  return Promise.resolve(noContent());
}

export async function toggleRule(g: Gated, read: ItemRule): Promise<Response> {
  const raw = await readBody(g.request);
  if (raw instanceof Response) return raw;
  const held = g.deps.store.get(read.id);
  if (!held) return notFoundRule();
  const enabled = raw['enabled'];
  if (typeof enabled !== 'boolean')
    return refuse(400, 'automation_invalid', {
      path: 'enabled',
      message: 'enabled must be true or false',
    });
  if (enabled && !ruleHasStep(held))
    return refuse(400, 'automation_invalid', {
      path: 'steps',
      message: 'a rule needs a step to be on',
    });
  if (enabled && ruleLeftToPick(held, g.deps.kit.kinds))
    return refuse(400, 'automation_invalid', {
      path: 'steps',
      message: 'pick what the rule still needs before turning it on',
    });
  // An item over its tier's rules (it kept them when its tier dropped) switches nothing on until it is back within it.
  if (enabled && !held.enabled) {
    const count = g.deps.store.count();
    const full = await rulesOverLimit(g.deps.store, g.deps.tier ?? null, count, g.deps.kit.itemId);
    if (full) return rulesFull(g, full);
  }
  const { paused: _paused, ...rest } = held;
  const rule: ItemRule = enabled ? { ...rest, enabled } : { ...held, enabled };
  // Resume clears the failures in a row.
  g.deps.store.update(rule, enabled ? 0 : undefined);
  console.info('[automations] rule.toggled', { enabled, resumed: enabled && !!held.paused });
  return answerRule(g, rule);
}

export async function duplicateRule(g: Gated, held: ItemRule): Promise<Response> {
  // The copy is a new rule: a token's names no connection, as its add would not.
  const refused = needsAPerson(g, held) ?? picksAConnection(g, held, new Set());
  if (refused) return refused;
  const { store } = g.deps;
  const rules = store.list();
  const full = await rulesAtLimit(store, g.deps.tier ?? null, rules.length, g.deps.kit.itemId);
  if (full) return rulesFull(g, full);
  const { paused: _paused, ...rest } = held;
  const stamp = stampOf(g);
  const rule: ItemRule = {
    ...rest,
    id: crypto.randomUUID(),
    name: freeRuleName(held.name, rules, ' copy'),
    enabled: false,
    made: stamp,
    edited: stamp,
  };
  store.insert(rule);
  recounted(g, rules.length + 1);
  return answerRule(g, rule, 201);
}

export async function orderRules(g: Gated): Promise<Response> {
  const raw = await readBody(g.request);
  if (raw instanceof Response) return raw;
  const ids = raw['ids'];
  if (
    !Array.isArray(ids) ||
    !ids.every((id): id is string => typeof id === 'string') ||
    !g.deps.store.order(ids)
  )
    return refuse(400, 'automation_invalid', {
      path: 'ids',
      message: 'ids must name every rule once',
    });
  return noContent();
}
