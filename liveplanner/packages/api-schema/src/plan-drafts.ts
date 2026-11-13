// Describe a Plan on the wire (docs/specs/026-plan/describe-a-plan.md, blueprint describe-a-plan.md "The api"): the
// person's words, answered with a draft of names (a board's columns and card types with their fields) for the
// preview to change. Nothing is made: the editor's Make Plan makes the board and the types. `POST /api/plan-drafts`.

import type { PlanDraft } from '@liveplanner/items';

export interface PlanDraftRequest {
  prompt: string;
}

export interface PlanDraftResponse {
  draft: PlanDraft;
}

export const PLAN_DRAFT_ERRORS = [
  // A guest (403): Describe a Plan is for signed-in people only.
  'plan_draft_needs_account',
  // An empty or over-long request (400).
  'plan_draft_invalid',
  // A request that is not a plan, or a reply that never read as one (422).
  'plan_draft_off_topic',
  'plan_draft_unreadable',
  // The account's drafts for the day spent (429).
  'plan_draft_capped',
  // No model, one that erred or was slow, or a count that couldn't be read (503).
  'plan_draft_unavailable',
] as const;
export type PlanDraftError = (typeof PLAN_DRAFT_ERRORS)[number];

// A refusal's body: `message` is fixed words, never the model's; `path` names the request's field at fault.
export interface PlanDraftErrorBody {
  error: PlanDraftError;
  path?: string;
  message?: string;
}
