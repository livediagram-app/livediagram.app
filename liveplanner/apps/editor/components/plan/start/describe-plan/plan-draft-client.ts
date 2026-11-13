// Describe a Plan's call (docs/specs/026-plan/describe-a-plan.md; blueprint describe-a-plan.md "The api"): the person's
// words to `POST /api/plan-drafts`, answered with a draft of names. A refusal the api names (`plan_draft_*`) throws a
// PlanDraftRefusal carrying the api's fixed words, which the dialog says as they are; anything else is a failure the
// dialog says in its own words.

import {
  PLAN_DRAFT_ERRORS,
  type PlanDraftError,
  type PlanDraftErrorBody,
  type PlanDraftRequest,
  type PlanDraftResponse,
} from '@liveplanner/api-schema';
import { API_BASE, apiFetch, apiHeaders, expectOk } from '@/lib/api/core';

export class PlanDraftRefusal extends Error {
  readonly status: number;
  readonly code: PlanDraftError;
  constructor(status: number, code: PlanDraftError, message: string) {
    super(message);
    this.name = 'PlanDraftRefusal';
    this.status = status;
    this.code = code;
  }
}

const isPlanDraftError = (v: unknown): v is PlanDraftError =>
  typeof v === 'string' && (PLAN_DRAFT_ERRORS as readonly string[]).includes(v);

async function refusalOf(res: Response): Promise<PlanDraftRefusal | null> {
  try {
    const body = (await res.clone().json()) as Partial<PlanDraftErrorBody>;
    if (!isPlanDraftError(body.error) || typeof body.message !== 'string') return null;
    return new PlanDraftRefusal(res.status, body.error, body.message);
  } catch {
    return null;
  }
}

/** Drafts a plan from the person's words, as `ownerId` (their account's token rides apiHeaders). */
export async function draftPlan(ownerId: string, prompt: string): Promise<PlanDraftResponse> {
  const body: PlanDraftRequest = { prompt };
  const res = await apiFetch(`${API_BASE}/plan-drafts`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const refusal = await refusalOf(res);
    if (refusal) throw refusal;
  }
  return expectOk<PlanDraftResponse>(res, 'draft plan');
}
