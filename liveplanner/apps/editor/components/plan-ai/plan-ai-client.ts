// Plan AI's call, `POST /api/plan-ai` (docs/specs/026-plan/blueprints/plan-ai.md "The editor"): the open tab as read,
// the instruction and the last few turns, answered with words and changes. A refusal the api names throws a
// DraftRefusal carrying its fixed words (and, for a key, whose key failed), which the panel says as they are; anything
// else is a failure the panel says in its own words.
import {
  PLAN_AI_ERRORS,
  type PlanAiError,
  type PlanAiRequest,
  type PlanAiResponse,
} from '@liveplanner/api-schema';
import { API_BASE, apiFetch, apiHeaders, expectOk } from '@/lib/api/core';
import { DraftRefusal, refusalOf } from '@/components/describe/draft-client';

export type PlanAiRefusal = DraftRefusal<PlanAiError>;

const make = (status: number, code: PlanAiError, message: string) =>
  new DraftRefusal(status, code, message);

/** Asks Plan AI as `ownerId` (their account's token rides apiHeaders); `signal` stops it. */
export async function askPlanAi(
  ownerId: string,
  body: PlanAiRequest,
  signal?: AbortSignal,
): Promise<PlanAiResponse> {
  const res = await apiFetch(`${API_BASE}/plan-ai`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
  if (!res.ok) {
    const refusal = await refusalOf(res, PLAN_AI_ERRORS, make);
    if (refusal) throw refusal;
  }
  return expectOk<PlanAiResponse>(res, 'ask Plan AI');
}
