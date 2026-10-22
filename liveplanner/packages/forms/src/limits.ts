// The form's limits (docs/specs/030-forms/blueprints/forms.md §3). Each is named once, here, so the builder, the
// respondent page and the api check the same numbers.
import {
  CUSTOM_CHOICE_OPTIONS_MAX,
  CUSTOM_CHOICE_OPTION_MAX,
  ITEMS_MAX,
  ITEM_TITLE_MAX,
} from '@liveplanner/items';

export const FORM_HEADING_MAX = 80;
export const FORM_DESCRIPTION_MAX = 1000;
export const SECTION_TITLE_MAX = 80;
export const PROMPT_MAX = 200;
export const HELP_MAX = 500;
export const PLACEHOLDER_MAX = 80;
// An option is shared with the Choice field a question maps to, so it keeps that field's limits.
export const OPTION_MAX = CUSTOM_CHOICE_OPTION_MAX;
export const OPTIONS_MAX = CUSTOM_CHOICE_OPTIONS_MAX;
export const SHORT_ANSWER_MAX = Math.min(200, ITEM_TITLE_MAX);
// A Paragraph is kept as Long Text, up to 2,000 characters (docs/specs/026-plan/item-types.md).
export const PARAGRAPH_MAX = 2000;
export const OTHER_MAX = SHORT_ANSWER_MAX;
export const SCALE_LABEL_MAX = 40;
export const RATING_SCALE_MIN = 3;
export const RATING_SCALE_MAX = 10;
export const RATING_SCALE_DEFAULT = 5;
export const MESSAGE_MAX = 500;
export const SECTIONS_MAX = 10;
export const QUESTIONS_MAX = 100;
export const FORM_RESPONSE_LIMIT_MAX = ITEMS_MAX;
// A response body, as the api reads it.
export const RESPONSE_BODY_MAX = 65_536;
// A link's code: ~131 bits over base 62, and at least 16 characters so page-view telemetry treats it as an id.
export const FORM_CODE_LENGTH = 22;
export const FORM_CODE_PATTERN = /^[A-Za-z0-9]{22}$/;
// A project whose form links have been suspended this often cannot publish another (docs/specs/030-forms/forms.md
// "Report This Form"). Safe range 1..5.
export const FORM_SUSPENSIONS_MAX = 2;
// Past this many options a Single Choice draws as a dropdown, unless set to always.
export const DROPDOWN_AFTER = 7;

export const DEFAULT_CONFIRMATION = 'Thanks, your response has been recorded.';
export const DEFAULT_CLOSED_MESSAGE = 'This form is no longer accepting responses.';
export const UNTITLED_FORM = 'Untitled Form';
