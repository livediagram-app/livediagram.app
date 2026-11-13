// Describe a Form's call (docs/specs/030-forms/describe-a-form.md; blueprint describe-a-form.md "The api"): the
// person's words to `POST /api/form-drafts`, answered with a drafted form. A refusal the api names (`form_draft_*`)
// throws a FormDraftRefusal carrying its fixed words; anything else the dialog says in its own.

import {
  FORM_DRAFT_ERRORS,
  type FormDraftError,
  type FormDraftResponse,
} from '@liveplanner/api-schema';
import { DraftRefusal, postDraft } from '@/components/describe/draft-client';

export class FormDraftRefusal extends DraftRefusal<FormDraftError> {
  constructor(status: number, code: FormDraftError, message: string) {
    super(status, code, message);
    this.name = 'FormDraftRefusal';
  }
}

/** Drafts a form from the person's words, as `ownerId`. */
export function draftForm(ownerId: string, prompt: string): Promise<FormDraftResponse> {
  return postDraft<FormDraftResponse, FormDraftError>(
    'form-drafts',
    ownerId,
    prompt,
    FORM_DRAFT_ERRORS,
    (status, code, message) => new FormDraftRefusal(status, code, message),
    'draft form',
  );
}
