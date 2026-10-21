// A question as an agent gives it (docs/specs/030-forms/forms.md "Agents", blueprint §15 "Question input"), made
// through the builder's own edits so it equals one made in the builder: a type's blank question, then its settings,
// each checked against the type and the limits the builder keeps. Where its answer goes is the mapping's
// (form-mapping.ts).
import {
  HELP_MAX,
  OPTION_MAX,
  OPTIONS_MAX,
  PLACEHOLDER_MAX,
  PROMPT_MAX,
  QUESTION_TYPES,
  QUESTION_TYPE_NAMES,
  RATING_SCALE_MAX,
  RATING_SCALE_MIN,
  SCALE_LABEL_MAX,
  blankQuestion,
  type FormQuestion,
  type QuestionType,
} from '@liveplanner/forms';
import { refuse, type Named } from './form-names';

export interface QuestionInput {
  type: QuestionType;
  prompt: string;
  help?: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  other?: boolean;
  dropdown?: boolean;
  min?: number;
  max?: number;
  whole?: boolean;
  scale?: number;
  style?: 'stars' | 'numbers';
  lowLabel?: string;
  highLabel?: string;
  // Title, Description, or a card field's name.
  goesTo?: string;
}

export type QuestionSet = Partial<QuestionInput>;

type Setting = Exclude<keyof QuestionInput, 'type' | 'prompt' | 'help' | 'required' | 'goesTo'>;

// The settings each type has, as its settings block shows them.
const TEXT_BOX: readonly Setting[] = ['placeholder'];
const TYPE_SETTINGS: Readonly<Record<QuestionType, readonly Setting[]>> = {
  short: TEXT_BOX,
  paragraph: TEXT_BOX,
  number: ['placeholder', 'min', 'max', 'whole'],
  email: TEXT_BOX,
  link: TEXT_BOX,
  date: [],
  single: ['options', 'other', 'dropdown'],
  multi: ['options', 'other', 'min', 'max'],
  rating: ['scale', 'style', 'lowLabel', 'highLabel'],
  checkbox: [],
};

const SETTINGS: readonly Setting[] = [
  'placeholder',
  'options',
  'other',
  'dropdown',
  'min',
  'max',
  'whole',
  'scale',
  'style',
  'lowLabel',
  'highLabel',
];

const typeList = () => QUESTION_TYPES.map((t) => `${t} (${QUESTION_TYPE_NAMES[t]})`).join(', ');

function cleanText(value: string, max: number, what: string): Named<{ text: string | undefined }> {
  const text = value.trim();
  if ([...text].length > max) return refuse('too_long', `${what} holds at most ${max} characters.`);
  return { ok: true, text: text || undefined };
}

// Options: each 1 to OPTION_MAX characters, unique ignoring case, 1 to OPTIONS_MAX of them.
function cleanOptions(options: readonly string[]): Named<{ options: string[] }> {
  const out: string[] = [];
  for (const raw of options) {
    const o = raw.trim();
    if (!o) return refuse('option_empty', 'An option needs wording.');
    if ([...o].length > OPTION_MAX)
      return refuse('too_long', `An option holds at most ${OPTION_MAX} characters ("${o}").`);
    if (out.some((x) => x.toLowerCase() === o.toLowerCase()))
      return refuse('options_repeat', `"${o}" is offered twice: options differ, case aside.`);
    out.push(o);
  }
  if (out.length === 0)
    return refuse('options_none', 'A choice question offers at least one option.');
  if (out.length > OPTIONS_MAX)
    return refuse('options_full', `A choice question offers at most ${OPTIONS_MAX} options.`);
  return { ok: true, options: out };
}

// `q` with `set` applied (its type already set): every setting checked against the type and its limits.
export function applyQuestionSet(
  q: FormQuestion,
  set: QuestionSet,
): Named<{ question: FormQuestion }> {
  const next: FormQuestion = { ...q };
  const allowed = TYPE_SETTINGS[q.type];
  for (const key of SETTINGS) {
    if (set[key] === undefined || allowed.includes(key)) continue;
    return refuse(
      'setting_not_for_type',
      `A ${QUESTION_TYPE_NAMES[q.type]} question has no ${key}. Its settings: ${
        allowed.length ? allowed.join(', ') : 'none beyond prompt, help and required'
      }.`,
    );
  }
  if (set.prompt !== undefined) {
    const p = cleanText(set.prompt, PROMPT_MAX, 'A prompt');
    if (!p.ok) return p;
    if (!p.text) return refuse('prompt_empty', 'A question needs a prompt.');
    next.prompt = p.text;
  }
  const optional = [
    ['help', HELP_MAX, 'Help text'],
    ['placeholder', PLACEHOLDER_MAX, 'A placeholder'],
    ['lowLabel', SCALE_LABEL_MAX, 'A low label'],
    ['highLabel', SCALE_LABEL_MAX, 'A high label'],
  ] as const;
  for (const [key, max, what] of optional) {
    const value = set[key];
    if (value === undefined) continue;
    const t = cleanText(value, max, what);
    if (!t.ok) return t;
    if (t.text) next[key] = t.text;
    else delete next[key];
  }
  for (const key of ['required', 'other', 'dropdown', 'whole'] as const) {
    if (set[key] === undefined) continue;
    if (set[key]) next[key] = true;
    else delete next[key];
  }
  if (set.options !== undefined) {
    const o = cleanOptions(set.options);
    if (!o.ok) return o;
    next.options = o.options;
  }
  if (set.style !== undefined) next.style = set.style;
  if (set.scale !== undefined) {
    if (
      !Number.isInteger(set.scale) ||
      set.scale < RATING_SCALE_MIN ||
      set.scale > RATING_SCALE_MAX
    )
      return refuse(
        'scale_out_of_range',
        `A rating's scale is a whole number from ${RATING_SCALE_MIN} to ${RATING_SCALE_MAX}.`,
      );
    next.scale = set.scale;
  }
  for (const key of ['min', 'max'] as const) {
    if (set[key] === undefined) continue;
    if (!Number.isFinite(set[key])) return refuse('invalid_value', `${key} is a number.`);
    next[key] = set[key];
  }
  // A labelled end belongs to a numbered scale; stars draw none.
  if ((next.lowLabel || next.highLabel) && next.type === 'rating' && next.style !== 'numbers')
    return refuse(
      'labels_need_numbers',
      'Low and high labels show on a rating whose style is "numbers".',
    );
  if (next.type === 'multi') {
    const count = next.options?.length ?? 0;
    for (const key of ['min', 'max'] as const) {
      const v = next[key];
      if (v !== undefined && (!Number.isInteger(v) || v < 0 || v > count))
        return refuse(
          'picks_out_of_range',
          `A Multiple Choice's ${key} picks is a whole number from 0 to its ${count} options.`,
        );
    }
  }
  if (next.min !== undefined && next.max !== undefined && next.min > next.max)
    return refuse('min_over_max', 'min is at most max.');
  return { ok: true, question: next };
}

// A new question from an agent's input, its id `id`.
export function questionFrom(input: QuestionInput, id: string): Named<{ question: FormQuestion }> {
  if (!(QUESTION_TYPES as readonly string[]).includes(input.type))
    return refuse('type_unknown', `No question type "${input.type}". Types: ${typeList()}.`);
  const { type, goesTo: _goesTo, ...set } = input;
  return applyQuestionSet(blankQuestion(type, id), set);
}
