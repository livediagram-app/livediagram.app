// The api's refusals as agents read them (docs/specs/026-plan/plan-agents.md "Errors that teach"): what was wrong
// and the next call to make, the same words on the CLI and the MCP. A 5xx or anything not from the api is not a
// refusal: the caller lets it throw.
import { ApiError } from '@livediagram/api-client';
import { SHEET_REFUSAL_WORDS } from '../sheets/sheet-refusals';

export const FIELD_HINT =
  'Fields: title, description, status (a column name), assignee (a name), priority (urgent|high|medium|low), ' +
  'labels, estimate (0-999), start and due (YYYY-MM-DD), color (a Plan swatch), checklist [{text,done}], ' +
  "parent (#number of a Project), and the card type's custom fields by name.";

const BY_CODE: Readonly<Record<string, string>> = {
  status_excluded:
    "the item's card type does not use that column: pick another, or allow it with change_card_types " +
    '(set excludedStatuses).',
  type_invalid: 'that is not a card type id. list_items lists the card types.',
  title_required: 'an item needs a title.',
  item_types_invalid: 'the card types would break a rule.',
  item_types_stale:
    'someone else kept changing the card types at the same moment: list_items reads them again, then retry.',
  place_invalid: 'the column or position is not valid.',
  ...SHEET_REFUSAL_WORDS,
  // Forms (docs/specs/030-forms/forms.md "Agents").
  form_locked:
    'this form is taking responses, so only its settings can change. Close it with share_form (action "close") ' +
    'first: its link stays, and publish opens it again.',
  form_changed:
    'someone changed the form since it was read: read_form again, then redo the change.',
  form_not_ready: 'the form is not ready to publish: read_form lists its problems.',
  form_destination_missing: 'responses have nowhere to go: set respondsTo with change_form.',
  form_suspensions:
    "this document's form links were suspended twice after reports, so it cannot publish another.",
  form_already_published: 'the form already has a link: read_form gives it.',
  form_closed:
    'the board, column, card type or sheet its responses go to is gone: read_form lists the problem.',
  form_full: 'the board or sheet its responses go to is full.',
  form_busy: 'the form is busy: wait a minute, then try again.',
  not_a_form_tab: 'that tab holds no form: add one with add_form.',
};

const BY_STATUS: Readonly<Record<number, string>> = {
  401: 'the token is not accepted: sign in again.',
  403: 'you may view this document but not change it (or not this part of it).',
  404: 'no such document or item, or it is not shared with you. find_documents lists them.',
  410: 'that document is in the Trash: restore it with restore_document first.',
  413: 'that is more than the document can hold.',
  // A burst past the per-token limit (docs/specs/015-api/public-api-and-tokens.md §3.5): the window is a minute.
  429: 'too many calls in the last minute (the limit is per token). Wait about a minute, then make the same call again.',
};

export interface ApiRefusal {
  code: string;
  message: string;
}

export function apiRefusalOf(err: unknown): ApiRefusal | null {
  if (!(err instanceof ApiError) || err.status >= 500) return null;
  const code = err.code ?? `http_${err.status}`;
  const known = (err.code && BY_CODE[err.code]) || BY_STATUS[err.status];
  if (known) return { code, message: `The api refused it: ${known}` };
  if (err.code && /field|value|label|checklist|estimate|priority|date|colou?r/.test(err.code))
    return { code, message: `The api refused a field value (${err.code}). ${FIELD_HINT}` };
  return { code, message: `The api refused it (${code}).` };
}
