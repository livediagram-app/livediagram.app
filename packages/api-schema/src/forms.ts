// The form link's wire shapes (docs/specs/030-forms/blueprints/forms.md §11): what the Form tab reads and changes
// about its link, and what a form link's page reads and sends.
import type { FormLook } from '@livediagram/document';
import type { AnswerError, PublicForm } from '@livediagram/forms';

// A Form tab's live link, as an Editor sees it.
export type FormLink = {
  code: string;
  open: boolean;
  createdAt: number;
};

// GET / POST / PUT .../tabs/:tabId/form-link
export type FormLinkResponse = {
  // The live link; null while unpublished. `code` is only sent to someone who may edit.
  link: FormLink | null;
  // Responses so far (the last response number given), and how many this reader has not seen.
  responses: number;
  unseen: number;
  // When the tab's last link was suspended after reports, while it has no live one.
  suspendedAt: number | null;
  // Whether this document may still publish (its links have not been suspended too often).
  canPublish: boolean;
};

// The form's look (its tab's theme, finish and font, and its colour), each colour for both halves: the form page
// draws the one matching the respondent's system.
export type { FormLook };

// GET /api/forms/:code
export type PublicFormResponse =
  | { state: 'open'; form: PublicForm; look: FormLook }
  | { state: 'closed'; heading: string; message: string; look: FormLook };

// POST /api/forms/:code/responses
export type FormResponseBody = {
  answers: Record<string, unknown>;
  other?: Record<string, unknown>;
  // The hidden field: a person never fills it.
  website?: string;
};
export type FormResponseAccepted = { number: number };
export type FormResponseRefusal =
  | { error: 'invalid_answers'; errors: Record<string, AnswerError> }
  | { error: 'form_closed' | 'form_full' | 'form_busy' | 'form_not_found' | 'rate_limited' };

// POST /api/forms/:code/reports
export const FORM_REPORT_REASONS = ['spam', 'phishing', 'offensive', 'other'] as const;
export type FormReportReason = (typeof FORM_REPORT_REASONS)[number];
export const FORM_REPORT_REASON_LABELS: Readonly<Record<FormReportReason, string>> = {
  spam: 'Spam',
  phishing: 'Phishing or Asking for Passwords',
  offensive: 'Offensive',
  other: 'Something Else',
};
export const FORM_REPORT_NOTE_MAX = 300;
export type FormReportBody = { reason: FormReportReason; note?: string };

export const formPath = (code: string) => `/form/${code}`;
