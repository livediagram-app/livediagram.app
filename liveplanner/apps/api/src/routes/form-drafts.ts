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
import { PLAN_DRAFT_FAILED, PLAN_DRAFT_NOT_SET_UP } from '@liveplanner/items';
import type {
  FormDraftError,
  FormDraftErrorBody,
  FormDraftResponse,
} from '@liveplanner/api-schema';
import { aiClient } from '../plan-room/automations/automation-ai';
import { spendPlanDraft } from '../plan-draft-count';
import { json, methodNotAllowed, notFound, signInRequired } from '../responses';
import { reportServerEvent } from '../server-telemetry';
import { readBody, type RouteContext } from './context';
import { askForDraft } from './draft-asks';

const refuse = (status: number, error: FormDraftError, message: string, path?: string) =>
  json({ error, message, ...(path ? { path } : {}) } satisfies FormDraftErrorBody, { status });

type Answer = 'drafted' | 'off_topic' | 'unreadable' | 'capped' | 'failed';

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
  const client = aiClient(ctx.env);
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

  // One draft counted against the account's shared budget, before the first ask; its second ask rides it.
  const spent = await spendPlanDraft(env, accountId, started);
  if (spent === 'unavailable')
    return done('failed', 0, refuse(503, 'form_draft_unavailable', PLAN_DRAFT_FAILED));
  if (!spent) return done('capped', 0, refuse(429, 'form_draft_capped', FORM_DRAFT_CAPPED));

  const asked = await askForDraft({
    client,
    gateway: env.AI_GATEWAY,
    request: (refused) => formDraftRequest(prompt, refused),
    read: (reply) => readFormDraft(reply, prompt),
    onAsk: () => defer(reportServerEvent(env, 'Form', 'Ran', 'FormAiDraft')),
  });
  const { asks } = asked;
  if (asked.answer === 'failed')
    return done('failed', asks, refuse(503, 'form_draft_unavailable', PLAN_DRAFT_FAILED));
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
