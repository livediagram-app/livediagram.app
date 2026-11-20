// A form (docs/specs/030-forms/forms.md): what a Form tab holds, stored on the tab as `tab.form`.
import type { ColourBackground } from '@liveworkspace/page-background';

export const QUESTION_TYPES = [
  'short',
  'paragraph',
  'number',
  'email',
  'phone',
  'link',
  'date',
  'datetime',
  'daterange',
  'single',
  'multi',
  'rating',
  'checkbox',
  // How long: hours and minutes, kept as whole minutes as a Duration field keeps them.
  'duration',
  // A colour from a set of swatches (or any #rrggbb), as a Colour field keeps it.
  'colour',
  // Not a question: a content block (text, a callout, a link, a picture) between questions, asking nothing
  // (docs/specs/030-forms/forms.md "Content blocks"). It has no answer, mapping, column or Required.
  'content',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

// The kinds of content block (forms.md "Content blocks").
export const CONTENT_BLOCKS = ['text', 'callout', 'link', 'image'] as const;
export type ContentBlock = (typeof CONTENT_BLOCKS)[number];
export const CONTENT_BLOCK_NAMES: Readonly<Record<ContentBlock, string>> = {
  text: 'Text',
  callout: 'Callout',
  link: 'Link Button',
  image: 'Picture',
};
// A callout's tone: its colour and icon.
export const CALLOUT_TONES = ['info', 'tip', 'warning'] as const;
export type CalloutTone = (typeof CALLOUT_TONES)[number];

// Whether a part of a section asks something (every type but a content block).
export const isAsked = (q: Pick<FormQuestion, 'type'>): boolean => q.type !== 'content';

export const isQuestionType = (v: unknown): v is QuestionType =>
  (QUESTION_TYPES as readonly unknown[]).includes(v);

// The names the builder and the spec give each type, Title Case.
export const QUESTION_TYPE_NAMES: Readonly<Record<QuestionType, string>> = {
  short: 'Short Answer',
  paragraph: 'Paragraph',
  number: 'Number',
  email: 'Email',
  phone: 'Phone',
  link: 'Link',
  date: 'Date',
  datetime: 'Date and Time',
  daterange: 'Date Range',
  single: 'Single Choice',
  multi: 'Multiple Choice',
  rating: 'Rating',
  checkbox: 'Checkbox',
  duration: 'Duration',
  colour: 'Colour',
  content: 'Content',
};

// The telemetry type each question type is counted as (a preset value, never content).
export const QUESTION_TYPE_TELEMETRY: Readonly<Record<QuestionType, string>> = {
  short: 'ShortAnswer',
  paragraph: 'Paragraph',
  number: 'Number',
  email: 'Email',
  phone: 'Phone',
  link: 'Link',
  date: 'Date',
  datetime: 'DateTime',
  daterange: 'DateRange',
  single: 'SingleChoice',
  multi: 'MultipleChoice',
  rating: 'Rating',
  checkbox: 'Checkbox',
  duration: 'Duration',
  colour: 'Colour',
  content: 'Content',
};

// Where an answer is kept on the response's card. Absent reads as Description.
export type AnswerTarget =
  { to: 'description' } | { to: 'title' } | { to: 'field'; fieldId: string };

export interface FormQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  help?: string;
  required?: true;
  placeholder?: string;
  // Single and Multiple Choice.
  options?: string[];
  other?: true;
  // Single Choice drawn as a dropdown whatever its length.
  dropdown?: true;
  // Number: its bounds. Multiple Choice: the fewest and most picks.
  min?: number;
  max?: number;
  whole?: true;
  // Rating.
  scale?: number;
  // Date Range: each end a date and time (docs/specs/030-forms/forms.md "Question types").
  withTime?: true;
  style?: 'stars' | 'numbers';
  lowLabel?: string;
  highLabel?: string;
  // Checkbox: the words beside its box ("Tick if it applies" when absent, "Required" when required and absent).
  checkLabel?: string;
  // The answer kept when a question that is not required is left empty (forms.md "A default answer"): a value its
  // own check takes (never on a Checkbox, a Date Range or a content block).
  fallback?: string | number | string[];
  goesTo?: AnswerTarget;
  // A content block (type 'content'): which kind, and what it holds. Its heading is `prompt` (optional), its text
  // `help`; a link's address `url` and button words `linkLabel`; a callout's `tone`; a picture's `imageId`.
  block?: ContentBlock;
  url?: string;
  linkLabel?: string;
  tone?: CalloutTone;
  imageId?: string;
}

// When a section shows (docs/specs/030-forms/forms.md "Showing a section only sometimes"): an earlier Single Choice,
// Multiple Choice or Checkbox question's answer is one of `anyOf` (a choice's options; a Checkbox's Ticked or Not
// Ticked). A rule whose question is gone or no longer fits is broken, and the section shows.
export interface SectionRule {
  questionId: string;
  anyOf: string[];
}

export interface FormSection {
  id: string;
  // The first section's title and description are the form's heading and description.
  title: string;
  description?: string;
  // Absent: the section always shows. Never on the first section.
  showIf?: SectionRule;
  questions: FormQuestion[];
}

// Where every response goes when it goes to a Sheet (docs/specs/030-forms/forms.md "Responses to a Sheet"): a row
// each, a column per question, no mapping. Set, it wins over `destination`, which is kept for switching back.
export interface FormSheetDestination {
  tabId: string;
  sheetId: string;
  // Columns every row fills without a question (forms.md "Columns filled in automatically"), after the questions'.
  fixed?: SheetFixedColumn[];
  // The column each header lives in, by the column's id (forms.md "Linked by column, not by heading"): `#` and `at`
  // for # and Submitted, a question's id for its answers. Absent on a form from before, which finds them by header.
  columns?: Record<string, string>;
}

// A value a card field or a sheet column takes on every response without a question (docs/specs/030-forms/forms.md
// "Filled in automatically"): a fixed value, or the day the response was filed (plus `days`), read in `tz` (the
// browser zone of the Editor who set it; UTC when absent). Filled by the api, never sent by a respondent.
export type SubmittedDay = { days: number; tz?: string };
export type FixedValue =
  { value: string | number | readonly string[] } | { submitted: SubmittedDay };

export type SheetFixedColumn = { id: string; header: string } & (
  { value: string | number } | { submitted: SubmittedDay }
);

// A card type rule (docs/specs/030-forms/forms.md "Choosing the card type by an answer"): when `questionId`'s answer is
// one of `anyOf` (a section rule's shape), the response makes a `typeId` card in `status`. `fields` maps a question's
// answer to a custom field of `typeId`, by question id (Title and Description are the form's, from `goesTo`).
export interface CardTypeRule {
  id: string;
  questionId: string;
  anyOf: string[];
  typeId: string;
  status: string;
  fields?: Readonly<Record<string, string>>;
}

// What every response makes: a card of a type in a status (docs/specs/030-forms/forms.md "Responses Go To"), never a
// board. The boards that show it are worked out from the plan (boardsShowing). `tabId` is only the Board tab the
// builder last saw it on: where its buttons open and what a build from before card targets reads; nothing is judged
// by it, and it may name a tab that is gone.
export interface FormDestination {
  tabId?: string;
  typeId: string;
  status: string;
  // The card fields every response's card gets without a question, by field id (one source per field).
  fixed?: Readonly<Record<string, FixedValue>>;
  // Other card types by an answer, read in order; `typeId` and `status` cover every other answer. Absent: none.
  typeRules?: readonly CardTypeRule[];
}

// The band across the form's top (docs/specs/030-forms/forms.md "The form card"): a colour background, a
// solid colour, a gradient (a moving one included) and a pattern. No pictures.
// A cover may instead (or as well, a pattern over it) hold a picture from the plan's images (forms.md "Cover"):
// `imageId` the picture, `focus` where it sits vertically (0 top to 100 bottom, 50 when absent), `credit` an Image
// Search pick's credit line.
export type FormCover = ColourBackground & {
  imageId?: string;
  focus?: number;
  credit?: string;
};

// How wide the form's column is (forms.md "Width"): Narrow (640 px, the default) or Wide.
export type FormWidth = 'narrow' | 'wide';
export const FORM_WIDTH_PX: Readonly<Record<FormWidth, number>> = { narrow: 640, wide: 880 };

export const STARTER_IDS = [
  'blank',
  'bug-report',
  'feedback',
  'feature-request',
  'rsvp',
  'job-application',
  'contact',
] as const;
export type StarterId = (typeof STARTER_IDS)[number];

export interface FormDefinition {
  v: 1;
  heading: string;
  description?: string;
  // No colour of its own: a form wears its tab theme's (docs/specs/030-forms/forms.md "Look").
  cover?: FormCover;
  sections: FormSection[];
  destination?: FormDestination;
  sheet?: FormSheetDestination;
  closesAt?: number;
  limit?: number;
  confirmation?: string;
  closedMessage?: string;
  starter?: StarterId;
  // Absent: Narrow.
  width?: 'wide';
}

export const FORM_VERSION = 1;

// Every question, in form order (content blocks, which ask nothing, left out).
export function questionsOf(form: Pick<FormDefinition, 'sections'>): FormQuestion[] {
  return form.sections.flatMap((s) => s.questions).filter(isAsked);
}

// Every part of every section, questions and content blocks, in form order.
export function partsOf(form: Pick<FormDefinition, 'sections'>): FormQuestion[] {
  return form.sections.flatMap((s) => s.questions);
}

// The pictures a form shows: its cover's and each picture block's (the api serves only these on its link).
export function formImageIds(form: Pick<FormDefinition, 'sections' | 'cover'>): string[] {
  const ids = new Set<string>();
  if (form.cover?.imageId) ids.add(form.cover.imageId);
  for (const q of partsOf(form)) if (q.type === 'content' && q.imageId) ids.add(q.imageId);
  return [...ids];
}

export function promptOf(q: Pick<FormQuestion, 'prompt'>): string {
  return q.prompt.trim() || 'Untitled Question';
}
