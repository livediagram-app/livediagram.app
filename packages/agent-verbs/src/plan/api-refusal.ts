// The api's refusals as agents read them (docs/specs/026-plan/plan-agents.md "Errors that teach"): what was wrong
// and the next call to make, the same words on the CLI and the MCP. A 5xx or anything not from the api is not a
// refusal: the caller lets it throw.
import { ApiError } from '@livediagram/api-client';

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
  place_invalid: 'the column or position is not valid.',
};

const BY_STATUS: Readonly<Record<number, string>> = {
  401: 'the token is not accepted: sign in again.',
  403: 'you may view this document but not change it (or not this part of it).',
  404: 'no such document or item, or it is not shared with you. find_documents lists them.',
  410: 'that document is in the Trash: restore it with restore_document first.',
  413: 'that is more than the document can hold.',
};

export interface ApiRefusal {
  code: string;
  message: string;
}

export function apiRefusalOf(err: unknown): ApiRefusal | null {
  if (!(err instanceof ApiError) || err.status >= 500) return null;
  const code = err.code ?? `http_${err.status}`;
  const known = (err.code && BY_CODE[err.code]) ?? BY_STATUS[err.status];
  if (known) return { code, message: `The api refused it: ${known}` };
  if (err.code && /field|value|label|checklist|estimate|priority|date|colou?r/.test(err.code))
    return { code, message: `The api refused a field value (${err.code}). ${FIELD_HINT}` };
  return { code, message: `The api refused it (${code}).` };
}
