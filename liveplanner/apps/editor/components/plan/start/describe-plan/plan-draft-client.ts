// Describe a Plan's call (docs/specs/026-plan/describe-a-plan.md; blueprint describe-a-plan.md "The api"): the person's
// words to `POST /api/plan-drafts`, answered with a draft of names. A refusal the api names (`plan_draft_*`) throws a
// PlanDraftRefusal carrying the api's fixed words, which the dialog says as they are; anything else is a failure the
// dialog says in its own words. The call itself is the shared draft-client's.

import {
  PLAN_DRAFT_ERRORS,
  type PlanDraftError,
  type PlanDraftRequest,
  type PlanDraftResponse,
} from '@liveplanner/api-schema';
import { DraftRefusal, postDraft } from '@/components/describe/draft-client';

export class PlanDraftRefusal extends DraftRefusal<PlanDraftError> {
  constructor(status: number, code: PlanDraftError, message: string) {
    super(status, code, message);
    this.name = 'PlanDraftRefusal';
  }
}

/** Drafts a plan from the person's words, as `ownerId` (their account's token rides apiHeaders). */
export async function draftPlan(ownerId: string, prompt: string): Promise<PlanDraftResponse> {
  const body: PlanDraftRequest = { prompt };
  return postDraft<PlanDraftResponse, PlanDraftError>(
    'plan-drafts',
    ownerId,
    body.prompt,
    PLAN_DRAFT_ERRORS,
    (status, code, message) => new PlanDraftRefusal(status, code, message),
    'draft plan',
  );
}
