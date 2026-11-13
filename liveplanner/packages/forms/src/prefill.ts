// Pre-filled answers (docs/specs/030-forms/forms.md "Filling in a form", blueprint §4a): a form link carries answers
// in its address as `?q.<questionId>=<value>`. Read through the same checks as a typed answer and never trusted: a
// parameter naming no question, a value its question refuses and an Other option are each ignored, so a bad link still
// opens the form. Share Form's Pre-filled Link writes them with `prefillSearch`, the same rule backwards.
import { checkAnswer, OTHER_ANSWER, type AnswerValue } from './answers';
import type { FormQuestion } from './model';

export const PREFILL_PREFIX = 'q.';

type Questions = { sections: readonly { questions: readonly Omit<FormQuestion, 'goesTo'>[] }[] };

const TICKED = new Set(['true', '1', 'yes', 'on']);

// An answer with its Other pick left out: an Other stands for typed text, which an address never carries.
function withoutOther(q: Omit<FormQuestion, 'goesTo'>, raw: unknown): unknown {
  if (q.type === 'single' && raw === OTHER_ANSWER) return undefined;
  if (q.type === 'multi' && Array.isArray(raw)) return raw.filter((v) => v !== OTHER_ANSWER);
  return raw;
}

// The raw answer a question's parameters stand for, or undefined when they cannot be one.
function rawAnswer(q: Omit<FormQuestion, 'goesTo'>, values: readonly string[]): unknown {
  switch (q.type) {
    case 'multi':
      return values;
    case 'daterange':
      return values.length === 2 ? [...values] : undefined;
    case 'checkbox':
      return TICKED.has(values[0]!.trim().toLowerCase()) ? true : undefined;
    default:
      return values[0];
  }
}

// The answer kept for a question, or undefined: checked as an unrequired question (a pre-fill is never "missing"), a
// Multiple Choice without its minimum (the respondent adds the rest; Next checks it).
function kept(q: Omit<FormQuestion, 'goesTo'>, raw: unknown): AnswerValue | undefined {
  const { required: _required, ...loose } = q;
  const { min: _min, ...noMin } = loose;
  const r = checkAnswer(q.type === 'multi' ? noMin : loose, raw);
  return r.error ? undefined : r.value;
}

export function readPrefill(
  form: Questions,
  search: string | URLSearchParams,
): Record<string, AnswerValue> {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const out: Record<string, AnswerValue> = {};
  for (const section of form.sections) {
    for (const q of section.questions) {
      const values = params.getAll(`${PREFILL_PREFIX}${q.id}`);
      if (values.length === 0) continue;
      const value = kept(q, withoutOther(q, rawAnswer(q, values)));
      if (value !== undefined) out[q.id] = value;
    }
  }
  return out;
}

// The address's query (no `?`) carrying every answer `readPrefill` would keep, in question order; '' for none.
export function prefillSearch(form: Questions, answers: Readonly<Record<string, unknown>>): string {
  const params = new URLSearchParams();
  for (const section of form.sections) {
    for (const q of section.questions) {
      const value = kept(q, withoutOther(q, answers[q.id]));
      if (value === undefined) continue;
      for (const part of Array.isArray(value) ? value : [value])
        params.append(`${PREFILL_PREFIX}${q.id}`, String(part));
    }
  }
  return params.toString();
}
