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
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

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
  goesTo?: AnswerTarget;
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
  // The column each header lives in, by the column's id (forms.md "Linked by column, not by heading"): `#` and `at`
  // for # and Submitted, a question's id for its answers. Absent on a form from before, which finds them by header.
  columns?: Record<string, string>;
}

// Where every response goes: a Board tab, a card type, a status.
export interface FormDestination {
  tabId: string;
  typeId: string;
  status: string;
}

// The band across the form's top (docs/specs/030-forms/forms.md "The form card"): a colour background, a
// solid colour, a gradient (a moving one included) and a pattern. No pictures.
export type FormCover = ColourBackground;

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
}

export const FORM_VERSION = 1;

// Every question, in form order.
export function questionsOf(form: Pick<FormDefinition, 'sections'>): FormQuestion[] {
  return form.sections.flatMap((s) => s.questions);
}

export function promptOf(q: Pick<FormQuestion, 'prompt'>): string {
  return q.prompt.trim() || 'Untitled Question';
}
