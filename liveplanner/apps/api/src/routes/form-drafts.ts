// Describe a Form, `POST /api/form-drafts` (docs/specs/030-forms/describe-a-form.md; blueprint describe-a-form.md
// "The api"), for a signed-in person only, on the count Describe a Plan keeps per account (plan-draft-count.ts: one AI
// budget, plans and forms together). The person's words, alone, go to the AI actions' model; its reply is read by
// @liveplanner/forms readFormDraft into a form, or asked once more with the check's words (draft-asks.ts). Nothing is
// made: the route writes only its count. Every refusal's message is fixed words, never the model's; the request and
// the reply are never logged.
import {
  FORM_DRAFT_CAPPED,
  FORM_DRAFT_OFF_TOPIC,
  FORM_DRAFT_PROMPT_MAX,
  FORM_DRAFT_UNREADABLE,
  formDraftRequest,
  questionsOf,
  readFormDraft,
} from '@liveplanner/forms';
import { AI_CREDITS_USED, PLAN_DRAFT_FAILED, PLAN_DRAFT_NOT_SET_UP } from '@liveplanner/items';
import type {
  FormDraftError,
  FormDraftErrorBody,
  FormDraftResponse,
} from '@liveplanner/api-schema';
import { draftAi, keyFailedResponse, keyFailureOf } from './draft-ai';
import { itemPayer, type OwnerScope } from '@liveworkspace/subscription';
import { giveBackPlanDraft, spendPlanDraft } from '../plan-draft-count';
import { json, methodNotAllowed, notFound, signInRequired } from '../responses';
import { reportServerEvent } from '../server-telemetry';
import { readBody, type RouteContext } from './context';
import { askForDraft } from './draft-asks';
import { spendDraftCredit } from './draft-credits';
import { resolvePlanGrant } from './plan-grant';

// The longest plan id a draft may name (the images route's own bound).
const PLAN_ID_MAX = 200;

const refuse = (status: number, error: FormDraftError, message: string, path?: string) =>
  json({ error, message, ...(path ? { path } : {}) } satisfies FormDraftErrorBody, { status });

type Answer = 'drafted' | 'off_topic' | 'unreadable' | 'capped' | 'failed' | 'key_failed';

export async function handleFormDrafts(ctx: RouteContext): Promise<Response> {
  if (ctx.segments.length !== 2) return notFound();
  if (ctx.request.method !== 'POST') return methodNotAllowed();
  return draftForm(ctx);
}

async function draftForm(ctx: RouteContext): Promise<Response> {
  // Signed in, as Describe a Plan: a guest is told it needs an account; no identity at all is asked to sign in.
  const accountId = ctx.verifiedUserId;
  if (!accountId)
    return ctx.resolveOwner()
      ? refuse(403, 'form_draft_needs_account', 'Sign in to describe a form.')
      : signInRequired();
  const raw = await readBody(ctx);
  if (raw instanceof Response) return raw;
  const prompt = typeof raw['prompt'] === 'string' ? raw['prompt'].trim() : '';
  if (!prompt || prompt.length > FORM_DRAFT_PROMPT_MAX)
    return refuse(
      400,
      'form_draft_invalid',
      `prompt must be 1 to ${FORM_DRAFT_PROMPT_MAX} characters`,
      'prompt',
    );
  // The plan the form is drafted for, when the dialog was opened on one: its owner pays (draft-credits.ts), and only
  // an Editor of it may draft there. The index's grant says both, never the request.
  const planId = raw['projectId'];
  let payer: OwnerScope | 'nobody' | null = null;
  if (planId !== undefined) {
    if (typeof planId !== 'string' || planId.length === 0 || planId.length > PLAN_ID_MAX)
      return refuse(400, 'form_draft_invalid', 'projectId must name a plan', 'projectId');
    const grant = await resolvePlanGrant(ctx, planId);
    if (grant instanceof Response) return grant;
    if (!grant || grant.level !== 'edit' || grant.trashed)
      return refuse(
        403,
        'form_draft_invalid',
        'Only an Editor of the plan can draft a form for it',
        'projectId',
      );
    // The one rule of who pays (`itemPayer`): the plan's owner; nobody for a guest's plan, whose drafts the day's
    // cap alone holds; the person's own only where the plan names no owner at all.
    const who = itemPayer(grant);
    payer = who.kind === 'owner' ? who.scope : who.kind === 'guest' ? 'nobody' : null;
  }
  // The person's own key when they have one (a key of the plan's team is not looked for), else built-in AI.
  const ai = await draftAi(ctx, null, (message) => refuse(503, 'form_draft_unavailable', message));
  if ('refused' in ai) return ai.refused;
  const { client } = ai;
  if (!client) return refuse(503, 'form_draft_unavailable', PLAN_DRAFT_NOT_SET_UP);

  const env = ctx.env;
  const started = Date.now();
  const defer = (p: Promise<unknown>) => ctx.waitUntil?.(p);
  // The refused path (a part's place, never the request's words) and, for a draft, its size: never what it says.
  const done = (
    answer: Answer,
    asks: number,
    response: Response,
    extra?: { refused?: string | undefined; sections?: number; questions?: number },
  ) => {
    console.info('[form-draft] draft', { answer, asks, tookMs: Date.now() - started, ...extra });
    return response;
  };

  // One draft counted against the account's shared budget, before the first ask; its second ask rides it. On a key
  // nothing is counted or spent.
  if (!ai.keyed) {
    const spent = await spendPlanDraft(env, accountId, started);
    if (spent === 'unavailable')
      return done('failed', 0, refuse(503, 'form_draft_unavailable', PLAN_DRAFT_FAILED));
    if (!spent) return done('capped', 0, refuse(429, 'form_draft_capped', FORM_DRAFT_CAPPED));
    // With Pro on, one AI credit for the month: the plan's owner's when the draft is for a plan, else the person's own
    // (draft-credits.ts).
    const credits = await spendDraftCredit(env, accountId, payer);
    // Refused before the model was asked: the day's place goes back, so a month's used credits never cost a draft.
    if (credits) await giveBackPlanDraft(env, accountId, started);
    if (credits === 'unavailable')
      return done('failed', 0, refuse(503, 'form_draft_unavailable', PLAN_DRAFT_FAILED));
    if (credits) {
      // The owner's numbers go to the owner or the owning team alone (019 "What a collaborator is told"): an Editor of
      // someone else's plan is told the month is used, never how much of it.
      const own =
        payer === null ||
        payer === `p:${accountId}` ||
        (ctx.teams ?? []).some((t) => payer === `t:${t.id}`);
      const body: FormDraftErrorBody = {
        error: 'form_draft_credits_used',
        message: AI_CREDITS_USED,
        ...(own ? credits : { limit: credits.limit }),
      };
      return done('capped', 0, json(body, { status: 429 }));
    }
  }

  const asked = await askForDraft({
    client,
    gateway: ai.keyed ? undefined : env.AI_GATEWAY,
    ...(ai.keyed ? { timeoutMs: ai.timeoutMs } : {}),
    request: (refused) => formDraftRequest(prompt, refused),
    read: (reply) => readFormDraft(reply, prompt),
    onAsk: () => defer(reportServerEvent(env, 'Form', 'Ran', 'FormAiDraft')),
  });
  const { asks } = asked;
  if (asked.answer === 'failed') {
    const failure = keyFailureOf(ai, asked.keyFailure);
    if (failure) return done('key_failed', asks, keyFailedResponse(failure, asked.reason));
    const words = ai.keyed ? asked.reason : PLAN_DRAFT_FAILED;
    return done('failed', asks, refuse(503, 'form_draft_unavailable', words));
  }
  if (asked.answer === 'off_topic') {
    defer(reportServerEvent(env, 'Form', 'Ran', 'FormAiOffTopic'));
    return done('off_topic', asks, refuse(422, 'form_draft_off_topic', FORM_DRAFT_OFF_TOPIC));
  }
  if (asked.answer === 'drafted') {
    const { draft } = asked.out;
    const answer: FormDraftResponse = { draft };
    return done('drafted', asks, json(answer), {
      sections: draft.form.sections.length,
      questions: questionsOf(draft.form).length,
    });
  }
  return done('unreadable', asks, refuse(422, 'form_draft_unreadable', FORM_DRAFT_UNREADABLE), {
    refused: asked.refused?.path,
  });
}
