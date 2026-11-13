// Describe a Plan, `POST /api/plan-drafts` (docs/specs/026-plan/describe-a-plan.md; blueprint describe-a-plan.md
// "The api"), for a signed-in person only: no plan exists on the server yet when Start Planning asks, so the count is
// the account's (plan-draft-count.ts), PLAN_DRAFT_PER_DAY a UTC day. The person's words, alone, go to the AI actions'
// model; its reply is read by @liveplanner/items readPlanDraft into a draft of names (with up to two starter rules,
// each read by Describe a Rule's reader), or asked once more with the check's words (draft-asks.ts). Nothing is made: the route writes only its count. Every refusal's message is fixed words, never the
// model's; the request and the reply are never logged.
import {
  PLAN_DRAFT_CAPPED,
  PLAN_DRAFT_FAILED,
  PLAN_DRAFT_NOT_SET_UP,
  PLAN_DRAFT_OFF_TOPIC,
  PLAN_DRAFT_PROMPT_MAX,
  PLAN_DRAFT_UNREADABLE,
  planDraftRequest,
  readPlanDraft,
} from '@liveplanner/items';
import type {
  PlanDraftError,
  PlanDraftErrorBody,
  PlanDraftResponse,
} from '@liveplanner/api-schema';
import { aiClient } from '../plan-room/automations/automation-ai';
import { DRAFT_ASKS_MAX, askForDraft } from './draft-asks';
import { spendPlanDraft } from '../plan-draft-count';
import { json, methodNotAllowed, notFound, signInRequired } from '../responses';
import { reportServerEvent } from '../server-telemetry';
import { readBody, type RouteContext } from './context';

// The asks one draft may make: the first, and one more with the check's words (draft-asks.ts, shared with Describe a
// Form).
export const PLAN_DRAFT_ASKS_MAX = DRAFT_ASKS_MAX;

const refuse = (status: number, error: PlanDraftError, message: string, path?: string) =>
  json({ error, message, ...(path ? { path } : {}) } satisfies PlanDraftErrorBody, { status });

type Answer = 'drafted' | 'off_topic' | 'unreadable' | 'capped' | 'failed';

export async function handlePlanDrafts(ctx: RouteContext): Promise<Response> {
  if (ctx.segments.length !== 2) return notFound();
  if (ctx.request.method !== 'POST') return methodNotAllowed();
  return draftPlan(ctx);
}

async function draftPlan(ctx: RouteContext): Promise<Response> {
  // Signed in (in the browser, a full API token or a workbench session: each is an account). A guest is told it
  // needs one; a caller with no identity at all is asked to sign in.
  const accountId = ctx.verifiedUserId;
  if (!accountId)
    return ctx.resolveOwner()
      ? refuse(403, 'plan_draft_needs_account', 'Sign in to describe a plan.')
      : signInRequired();
  const raw = await readBody(ctx);
  if (raw instanceof Response) return raw;
  const prompt = typeof raw['prompt'] === 'string' ? raw['prompt'].trim() : '';
  if (!prompt || prompt.length > PLAN_DRAFT_PROMPT_MAX)
    return refuse(
      400,
      'plan_draft_invalid',
      `prompt must be 1 to ${PLAN_DRAFT_PROMPT_MAX} characters`,
      'prompt',
    );
  const client = aiClient(ctx.env);
  if (!client) return refuse(503, 'plan_draft_unavailable', PLAN_DRAFT_NOT_SET_UP);

  const env = ctx.env;
  const started = Date.now();
  const defer = (p: Promise<unknown>) => ctx.waitUntil?.(p);
  // The refused path (a part's place, never the request's words) says which check a draft that didn't read failed.
  // A draft's starter rules: how many it kept and left out, never what they say.
  const done = (
    answer: Answer,
    asks: number,
    response: Response,
    rules?: { rules: number; rulesDropped: number },
    refused?: string,
  ) => {
    console.info('[plan-draft] draft', {
      answer,
      asks,
      tookMs: Date.now() - started,
      refused,
      ...rules,
    });
    return response;
  };

  // One draft counted, before the first ask; its second ask rides it.
  const spent = await spendPlanDraft(env, accountId, started);
  if (spent === 'unavailable')
    return done('failed', 0, refuse(503, 'plan_draft_unavailable', PLAN_DRAFT_FAILED));
  if (!spent) return done('capped', 0, refuse(429, 'plan_draft_capped', PLAN_DRAFT_CAPPED));

  const asked = await askForDraft({
    client,
    gateway: env.AI_GATEWAY,
    request: (refused) => planDraftRequest(prompt, refused),
    read: (reply) => readPlanDraft(reply, prompt),
    onAsk: () => defer(reportServerEvent(env, 'Plan', 'Ran', 'PlanAiDraft')),
  });
  const { asks } = asked;
  if (asked.answer === 'failed')
    return done('failed', asks, refuse(503, 'plan_draft_unavailable', PLAN_DRAFT_FAILED));
  if (asked.answer === 'off_topic') {
    defer(reportServerEvent(env, 'Plan', 'Ran', 'PlanAiOffTopic'));
    return done('off_topic', asks, refuse(422, 'plan_draft_off_topic', PLAN_DRAFT_OFF_TOPIC));
  }
  if (asked.answer === 'drafted') {
    const { draft, dropped } = asked.out;
    const answer: PlanDraftResponse = { draft };
    return done('drafted', asks, json(answer), {
      rules: draft.rules?.length ?? 0,
      rulesDropped: dropped ?? 0,
    });
  }
  return done(
    'unreadable',
    asks,
    refuse(422, 'plan_draft_unreadable', PLAN_DRAFT_UNREADABLE),
    undefined,
    asked.refused?.path,
  );
}
