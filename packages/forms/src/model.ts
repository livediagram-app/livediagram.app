// A form (docs/specs/030-forms/forms.md): what a Form tab holds, stored on the tab as `tab.form`.

export const QUESTION_TYPES = [
  'short',
  'paragraph',
  'number',
  'email',
  'link',
  'date',
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
  link: 'Link',
  date: 'Date',
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
  link: 'Link',
  date: 'Date',
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
  style?: 'stars' | 'numbers';
  lowLabel?: string;
  highLabel?: string;
  goesTo?: AnswerTarget;
}

export interface FormSection {
  id: string;
  // The first section's title and description are the form's heading and description.
  title: string;
  description?: string;
  questions: FormQuestion[];
}

// Where every response goes: a Board tab, a card type, a status.
export interface FormDestination {
  tabId: string;
  typeId: string;
  status: string;
}

// The band across the form's top: a colour drawn plain, as a gradient into the form colour, or dotted.
export const COVER_STYLES = ['solid', 'gradient', 'dots'] as const;
export type CoverStyle = (typeof COVER_STYLES)[number];

export interface FormCover {
  color?: string;
  style?: CoverStyle;
}

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
  accent?: string;
  cover?: FormCover;
  sections: FormSection[];
  destination?: FormDestination;
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
