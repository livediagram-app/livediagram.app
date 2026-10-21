// Checking answers (docs/specs/030-forms/forms.md "Checking answers", blueprint §4): one set of rules for the
// respondent page, the builder's Preview and the api, so a response the page lets through is one the api keeps.
import { isEmailAddress } from '@liveplanner/items';
import { OTHER_MAX, PARAGRAPH_MAX, SHORT_ANSWER_MAX } from './limits';
import { shownQuestions } from './branching';
import type { FormDefinition, FormQuestion } from './model';

export type AnswerValue = string | number | boolean | string[];

export type AnswerError =
  | 'required'
  | 'too_long'
  | 'not_a_number'
  | 'not_whole'
  | 'below_min'
  | 'above_max'
  | 'not_an_email'
  | 'not_a_link'
  | 'not_a_date'
  | 'not_an_option'
  | 'too_few'
  | 'too_many'
  | 'out_of_scale'
  | 'must_tick';

// What a respondent sends: answers by question id, the text of an Other option, and the hidden field.
interface ResponseBody {
  answers: Record<string, unknown>;
  other?: Record<string, unknown>;
  website?: unknown;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateAnswer(v: string): boolean {
  const m = DATE.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  return (
    d.getUTCFullYear() === +m[1]! && d.getUTCMonth() === +m[2]! - 1 && d.getUTCDate() === +m[3]!
  );
}

// A link as a Link field keeps it: an https:// address. A bare "example.com" is taken as https.
export function normaliseLink(v: string): string | null {
  const raw = v.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  if (!/^https:\/\//i.test(withScheme)) return null;
  try {
    const u = new URL(withScheme);
    return u.hostname.includes('.') ? withScheme : null;
  } catch {
    return null;
  }
}

// The text of an Other answer: what was typed, trimmed and capped.
const otherText = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, OTHER_MAX) : '');

// An answer that says nothing: no value, empty text, no picks, an unticked box.
function isEmpty(v: unknown): boolean {
  return (
    v === undefined ||
    v === null ||
    v === false ||
    (typeof v === 'string' && v.trim() === '') ||
    (Array.isArray(v) && v.length === 0)
  );
}

type AnswerCheck = { value?: AnswerValue; error?: AnswerError };

export function checkAnswer(q: FormQuestion, raw: unknown, other?: unknown): AnswerCheck {
  // An Other pick stands for its typed text.
  const typedOther = q.other ? otherText(other) : '';
  if (isEmpty(raw)) {
    if (q.required) return { error: q.type === 'checkbox' ? 'must_tick' : 'required' };
    return {};
  }
  switch (q.type) {
    case 'short':
    case 'paragraph': {
      if (typeof raw !== 'string') return { error: 'required' };
      const t = raw.trim();
      return t.length > (q.type === 'short' ? SHORT_ANSWER_MAX : PARAGRAPH_MAX)
        ? { error: 'too_long' }
        : { value: t };
    }
    case 'number': {
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN;
      if (!Number.isFinite(n)) return { error: 'not_a_number' };
      if (q.whole && !Number.isInteger(n)) return { error: 'not_whole' };
      if (q.min !== undefined && n < q.min) return { error: 'below_min' };
      if (q.max !== undefined && n > q.max) return { error: 'above_max' };
      return { value: n };
    }
    case 'email': {
      const t = typeof raw === 'string' ? raw.trim() : '';
      return isEmailAddress(t) ? { value: t } : { error: 'not_an_email' };
    }
    case 'link': {
      const link = typeof raw === 'string' ? normaliseLink(raw) : null;
      if (!link) return { error: 'not_a_link' };
      return link.length > 2048 ? { error: 'too_long' } : { value: link };
    }
    case 'date':
      return typeof raw === 'string' && isDateAnswer(raw)
        ? { value: raw }
        : { error: 'not_a_date' };
    case 'single': {
      if (typeof raw !== 'string') return { error: 'not_an_option' };
      if (q.other && raw === OTHER_ANSWER) {
        if (!typedOther) return { error: 'required' };
        return { value: typedOther };
      }
      return (q.options ?? []).includes(raw) ? { value: raw } : { error: 'not_an_option' };
    }
    case 'multi': {
      if (!Array.isArray(raw) || raw.some((o) => typeof o !== 'string'))
        return { error: 'not_an_option' };
      const picks = [...new Set(raw as string[])];
      const options = q.options ?? [];
      let typed: string | null = null;
      for (const p of picks) {
        if (options.includes(p)) continue;
        if (!(q.other && p === OTHER_ANSWER)) return { error: 'not_an_option' };
        if (!typedOther) return { error: 'required' };
        typed = typedOther;
      }
      // Kept in option order, so a card reads the same whoever ticked first; an Other typed as one of the options
      // counts as that option.
      const out = options.filter((o) => picks.includes(o) || o === typed);
      if (typed !== null && !options.includes(typed)) out.push(typed);
      if (q.min !== undefined && picks.length < q.min) return { error: 'too_few' };
      if (q.max !== undefined && picks.length > q.max) return { error: 'too_many' };
      return { value: out };
    }
    case 'rating': {
      // A number, or one written as digits; never a tick or a list that happens to convert.
      const n =
        typeof raw === 'number'
          ? raw
          : typeof raw === 'string' && /^\d+$/.test(raw.trim())
            ? +raw
            : NaN;
      return Number.isInteger(n) && n >= 1 && n <= (q.scale ?? 5)
        ? { value: n }
        : { error: 'out_of_scale' };
    }
    case 'checkbox':
      return raw === true ? { value: true } : { error: 'must_tick' };
  }
}

// The value a respondent's Other option sends in place of an option name.
export const OTHER_ANSWER = '__other__';

type ResponseCheck =
  | { ok: true; answers: Map<string, AnswerValue> }
  | { ok: false; errors: Record<string, AnswerError> };

// Every question of the sections `form` shows for these answers (or only `questions`, a section's, for Next) checked
// against the body. Answers to ids the form no longer has, or of a section that does not show, are dropped, never
// refused: the form may have changed while someone filled it in, and a hidden section was never asked.
export function checkResponse(
  form: Pick<FormDefinition, 'sections'>,
  body: Pick<ResponseBody, 'answers' | 'other'>,
  questions: readonly FormQuestion[] = shownQuestions(form, body.answers),
): ResponseCheck {
  const answers = new Map<string, AnswerValue>();
  const errors: Record<string, AnswerError> = {};
  for (const q of questions) {
    const r = checkAnswer(q, body.answers[q.id], body.other?.[q.id]);
    if (r.error) errors[q.id] = r.error;
    else if (r.value !== undefined) answers.set(q.id, r.value);
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, answers };
}

// What the page says under a question for each error (docs/specs/030-forms/forms.md "Checking answers").
export function answerErrorMessage(q: FormQuestion, error: AnswerError): string {
  switch (error) {
    case 'required':
      return 'This question is required';
    case 'must_tick':
      return 'Tick this box to continue';
    case 'too_long':
      return q.type === 'link'
        ? 'That web address is too long'
        : `Keep it under ${(q.type === 'short' ? SHORT_ANSWER_MAX : PARAGRAPH_MAX).toLocaleString('en-GB')} characters`;
    case 'not_a_number':
      return 'Enter a number';
    case 'not_whole':
      return 'Enter a whole number';
    case 'below_min':
    case 'above_max':
      return rangeMessage(q);
    case 'not_an_email':
      return 'Enter an email address like name@example.com';
    case 'not_a_link':
      return 'Enter a web address like https://example.com';
    case 'not_a_date':
      return 'Enter a real date';
    case 'not_an_option':
      return 'Pick one of the options';
    case 'too_few':
      return `Pick at least ${q.min}`;
    case 'too_many':
      return `Pick at most ${q.max}`;
    case 'out_of_scale':
      return `Pick a rating from 1 to ${q.scale ?? 5}`;
  }
}

function rangeMessage(q: FormQuestion): string {
  const kind = q.whole ? 'a whole number' : 'a number';
  if (q.min !== undefined && q.max !== undefined) return `Enter ${kind} from ${q.min} to ${q.max}`;
  if (q.min !== undefined) return `Enter ${kind} of ${q.min} or more`;
  return `Enter ${kind} of ${q.max} or less`;
}
