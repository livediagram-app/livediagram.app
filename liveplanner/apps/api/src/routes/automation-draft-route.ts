// Describe a Rule, `POST /api/projects/:id/automations/draft` (docs/specs/026-plan/automations.md "Describe a Rule";
// blueprint automations.md "Describe a Rule"), behind the Automations gate (an Editor of the whole plan, signed in or
// their token, never read-only). The person's words and the plan's names go to the AI actions' model; its reply is
// read by @liveplanner/items readAiDraft into a rule body, unsaved and off, or asked once more with the check's words.
// Nothing is saved or run: the route writes only its count of asks, which share the day's AI steps and cap the drafts
// a day. Every refusal's message is fixed words, never the model's; the request and the reply are never logged.
import {
  AI_CAPPED,
  AI_DRAFT_CAPPED,
  AI_DRAFT_OFF_TOPIC,
  AI_DRAFT_PER_DAY,
  AI_DRAFT_PROMPT_MAX,
  AI_DRAFT_FAILED,
  AI_DRAFT_UNREADABLE,
  AI_NOT_SET_UP,
  AUTOMATION_AI_PER_DAY,
  aiDraftPlan,
  aiDraftRequest,
  isRuleTimeZone,
  planLabels,
  readAiDraft,
  readAiReply,
} from '@liveplanner/items';
import type {
  AutomationDraftResponse,
  AutomationError,
  AutomationErrorBody,
} from '@liveplanner/api-schema';
import { listItems } from '../db/items';
import { json } from '../responses';
import { reportServerEvent } from '../server-telemetry';
import {
  aiClient,
  aiToday,
  ask,
  countDraftAsk,
  draftsToday,
} from '../plan-room/automations/automation-ai';
import { readAutomationPlan } from '../plan-room/automations/automation-plan';
import type { Gated } from './automation-routes';
import { readBody, type PlanRouteContext } from './context';

// The asks one draft may make: the first, and one more with the check's words.
export const DRAFT_ASKS_MAX = 2;

const refuse = (status: number, error: AutomationError, message: string, path?: string) =>
  json({ error, message, ...(path ? { path } : {}) } satisfies AutomationErrorBody, { status });

type Answer = 'drafted' | 'off_topic' | 'unreadable' | 'failed';

export async function draftRule(ctx: PlanRouteContext, g: Gated): Promise<Response> {
  const raw = await readBody(ctx);
  if (raw instanceof Response) return raw;
  const prompt = typeof raw['prompt'] === 'string' ? raw['prompt'].trim() : '';
  if (!prompt || prompt.length > AI_DRAFT_PROMPT_MAX)
    return refuse(
      400,
      'automation_draft_invalid',
      `prompt must be 1 to ${AI_DRAFT_PROMPT_MAX} characters`,
      'prompt',
    );
  const timeZone = raw['timeZone'];
  if (!isRuleTimeZone(timeZone))
    return refuse(400, 'automation_draft_invalid', 'timeZone must name a time zone', 'timeZone');
  const client = aiClient(ctx.env);
  if (!client) return refuse(503, 'automation_ai_unavailable', AI_NOT_SET_UP);
  const sql = g.hook.sql();
  const started = Date.now();
  if (aiToday(sql, started) >= AUTOMATION_AI_PER_DAY)
    return refuse(429, 'automation_ai_capped', AI_CAPPED);
  if (draftsToday(sql, started) >= AI_DRAFT_PER_DAY)
    return refuse(429, 'automation_ai_capped', AI_DRAFT_CAPPED);

  const [plan, items] = await Promise.all([
    readAutomationPlan(ctx.env, g.projectId),
    listItems(ctx.env, g.projectId),
  ]);
  const draftPlan = aiDraftPlan(plan.outline, planLabels(items));
  const context = {
    prompt,
    names: {
      statuses: plan.outline.statuses,
      types: plan.outline.types,
      people: plan.outline.people,
      tabs: [],
    },
    timeZone,
    rules: g.hook.store.list(),
  };
  const env = ctx.env;
  const defer = (p: Promise<unknown>) => ctx.waitUntil?.(p);
  let previous: { path: string; message: string } | undefined;
  // The refused path (a step's place, never the request's words) says which check a draft that didn't read failed.
  const done = (answer: Answer, asks: number, response: Response) => {
    const refused = answer === 'unreadable' ? previous?.path : undefined;
    console.info('[automations] draft', { answer, asks, tookMs: Date.now() - started, refused });
    return response;
  };

  let asks = 0;
  for (let n = 0; n < DRAFT_ASKS_MAX; n++) {
    // A second ask past the day's AI steps is not made: the draft didn't read.
    if (n > 0 && aiToday(sql, Date.now()) >= AUTOMATION_AI_PER_DAY) break;
    countDraftAsk(sql, Date.now(), n > 0);
    asks += 1;
    defer(reportServerEvent(env, 'Plan', 'Ran', 'AutomationAiDraft'));
    const asked = await ask(
      client,
      aiDraftRequest(prompt, draftPlan, previous),
      ctx.env.AI_GATEWAY,
    );
    if (!asked.ok)
      return done('failed', asks, refuse(503, 'automation_ai_unavailable', AI_DRAFT_FAILED));
    const reply = readAiReply(asked.raw);
    if (!reply) {
      previous = { path: 'reply', message: 'the reply must be one JSON object' };
      continue;
    }
    const out = readAiDraft(reply, context);
    if ('off' in out) {
      defer(reportServerEvent(env, 'Plan', 'Ran', 'AutomationAiOffTopic'));
      return done('off_topic', asks, refuse(422, 'automation_draft_off_topic', AI_DRAFT_OFF_TOPIC));
    }
    if ('body' in out) {
      const answer: AutomationDraftResponse = { rule: out.body, picks: out.picks };
      return done('drafted', asks, json(answer));
    }
    previous = out.refused;
  }
  return done('unreadable', asks, refuse(422, 'automation_draft_unreadable', AI_DRAFT_UNREADABLE));
}
