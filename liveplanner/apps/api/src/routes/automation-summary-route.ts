// One rule as anyone who may read the plan sees it (docs/specs/026-plan/automations.md "On cards", "Who may do what";
// blueprint automations.md "Routes"): `GET /api/projects/:id/automations/summary?rule=<id>` (a comment's mark) or
// `?name=<name>` (a history line's), for a Participant, a Viewer, a link visitor or a read-only token as for an Editor.
// It is the only Automations route that is not an Editor's: the answer is built from an allow-list
// (@liveplanner/items automationRuleSummary), never the stored rule, so no typed-in address, webhook, sender,
// repository or AI step's ask leaves. A tab-scoped link reads only a rule that acted on a card its tab shows (a history
// entry of that card by the rule, or a comment the rule added on a thread of it); anything else, like a rule gone,
// answers 404 `automation_not_found`.
import {
  automationRuleSummary,
  savedFilterKey,
  type AutomationRule,
  type RuleSentenceOutline,
} from '@liveplanner/items';
import type { AutomationErrorBody, AutomationSummaryResponse } from '@liveplanner/api-schema';
import { AUTOMATION_PERSON_ID } from '@liveplanner/items';
import { json, methodNotAllowed } from '../responses';
import { tabOutlines } from '../db/tab-outlines';
import { readAutomationPlan } from '../plan-room/automations/automation-plan';
import type { PlanEnv } from '../types';
import type { PlanRouteContext } from './context';
import { itemCaller } from './item-route-kit';

// The longest rule id or name the route reads (a name is at most 60 characters; ids are UUIDs).
const ASKED_MAX = 200;

const gone = () =>
  json({ error: 'automation_not_found' } satisfies AutomationErrorBody, { status: 404 });

const asked = (value: string | null) =>
  value !== null && value.length > 0 && value.length <= ASKED_MAX ? value : null;

// The rule the query names: by id, else by its name as a history line kept it (case aside).
function ruleOf(rules: readonly AutomationRule[], url: URL): AutomationRule | undefined {
  const id = asked(url.searchParams.get('rule'));
  if (id) return rules.find((r) => r.id === id);
  const name = asked(url.searchParams.get('name'))?.trim().toLowerCase();
  return name ? rules.find((r) => r.name.toLowerCase() === name) : undefined;
}

// Whether the rule acted on one of these cards: an entry of their history written as it, or its comment on one of
// their threads. Two reads, each stopping at its first match, the cards as one JSON parameter.
export async function actedOnCards(
  env: Pick<PlanEnv, 'PLAN_DB'>,
  projectId: string,
  cards: ReadonlySet<string>,
  rule: Pick<AutomationRule, 'id' | 'name'>,
): Promise<boolean> {
  if (cards.size === 0) return false;
  const ids = JSON.stringify([...cards]);
  const history = await env.PLAN_DB.prepare(
    `SELECT 1 AS hit FROM item_history
      WHERE plan_id = ?1 AND item_id IN (SELECT value FROM json_each(?2))
        AND json_extract(by, '$.id') = ?3 AND json_extract(by, '$.name') = ?4 LIMIT 1`,
  )
    .bind(projectId, ids, AUTOMATION_PERSON_ID, rule.name)
    .first<{ hit: number }>();
  if (history) return true;
  const comment = await env.PLAN_DB.prepare(
    `SELECT 1 AS hit FROM card_thread_links l
       JOIN card_threads t ON t.plan_id = l.plan_id AND t.id = l.thread_id
      WHERE l.plan_id = ?1 AND l.item_id IN (SELECT value FROM json_each(?2))
        AND instr(t.comments, ?3) > 0 LIMIT 1`,
  )
    .bind(projectId, ids, `"ruleId":${JSON.stringify(rule.id)}`)
    .first<{ hit: number }>();
  return !!comment;
}

// The plan as the summary names it: card types and fields, columns, people, saved filters, boards and Form tabs.
async function outlineOf(env: PlanEnv, projectId: string): Promise<RuleSentenceOutline> {
  const [plan, tabs] = await Promise.all([
    readAutomationPlan(env, projectId),
    tabOutlines(env, projectId, null),
  ]);
  const { outline } = plan;
  return {
    types: outline.types,
    statuses: new Map(outline.statuses.map((s) => [s.status, s.name])),
    people: outline.people,
    tabs: new Map(tabs.map((t) => [t.id, t.name])),
    filters: new Map(
      outline.savedFilters.map((f) => [savedFilterKey(f.tab, f.filter.id), f.filter.name]),
    ),
    boardNames: new Map((outline.boards ?? []).map((b) => [b.id, b.name])),
    goneWords: true,
  };
}

export async function automationSummary(ctx: PlanRouteContext): Promise<Response> {
  if (ctx.request.method !== 'GET') return methodNotAllowed();
  const projectId = ctx.segments[2]!;
  const caller = await itemCaller(ctx, projectId, 'read');
  if (caller instanceof Response) return caller;
  const rule = ruleOf(ctx.env.AUTOMATIONS?.store.list() ?? [], ctx.url);
  if (!rule) return gone();
  if (caller.scope && !(await actedOnCards(ctx.env, projectId, caller.scope, rule))) {
    console.info('[automations] summary.out_of_scope');
    return gone();
  }
  const answer: AutomationSummaryResponse = {
    rule: automationRuleSummary(rule, await outlineOf(ctx.env, projectId)),
  };
  console.info('[automations] summary.read', { scoped: !!caller.scope });
  return json(answer);
}
