// Describe a Form on the wire (docs/specs/030-forms/describe-a-form.md, blueprint describe-a-form.md "The api"): the
// person's words, answered with a drafted form and where its responses would go, for the preview to show. Nothing is
// made: the editor's Create Form makes the tab. `POST /api/form-drafts`.

import type { FormDraft } from '@liveplanner/forms';
import type { AiKeyFailureBody } from './plan-drafts';

import type { TierLimitRefusal } from './tiers';

export interface FormDraftRequest {
  prompt: string;
  // The plan the form is drafted for (the dialog was opened on one of its tabs): its owner's AI credit is spent, and
  // the caller must be an Editor of it. Left out, the draft is nobody's plan yet and the person's own is spent.
  projectId?: string;
}

export interface FormDraftResponse {
  draft: FormDraft;
}

export const FORM_DRAFT_ERRORS = [
  // A guest (403): Describe a Form is for signed-in people only.
  'form_draft_needs_account',
  // An empty or over-long request (400).
  'form_draft_invalid',
  // A request that is not a form, or a reply that never read as one (422).
  'form_draft_off_topic',
  'form_draft_unreadable',
  // The account's drafts for the day spent, plans and forms together (429).
  'form_draft_capped',
  // No model, one that erred or was slow, or a count that couldn't be read (503).
  'form_draft_unavailable',
  // On the person's own key: the provider refused it (revoked, out of credit, a model it can't use) or it will not
  // open (422), with `aiKey` (ai-keys.md "Every AI feature honours the choice"). Never sent to built-in AI instead.
  'ai_key_failed',
  // The person's AI credits for the month used (Pro on only): 429, with `limit`, `used` and `max`.
  'form_draft_credits_used',
] as const;
export type FormDraftError = (typeof FORM_DRAFT_ERRORS)[number];

// A refusal's body: `message` is fixed words, never the model's; `path` names the request's field at fault.
export interface FormDraftErrorBody extends Partial<TierLimitRefusal> {
  error: FormDraftError;
  path?: string;
  message?: string;
  aiKey?: AiKeyFailureBody;
}
