// What a response makes, while building (docs/specs/030-forms/forms.md "Responses Go To and Settings", "What a
// response makes"): a plausible answer to each question, and the card or sheet row those answers make, through the
// same pure code the api runs on a real response (responseCard, responseRowWrite), so the preview never drifts from
// what really happens. O(questions): each question is answered once and placed once.
import {
  answerText,
  CHECKBOX_TICKED,
  effectiveTarget,
  ruleTarget,
  fixedFieldsOf,
  questionsOf,
  responseCard,
  responseRowWrite,
  sheetHeaders,
  type AnswerValue,
  type CardTypeRule,
  type FormDefinition,
  type FormQuestion,
} from '@liveplanner/forms';
import {
  DESCRIPTION_RICH_FIELD,
  fromLocalInput,
  isPriority,
  PRIORITY_LABELS,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import { dayKey } from '@/components/plan/day-label';

// The response number the preview stands for: its first.
const PREVIEW_NUMBER = 1;

// A Short Answer's sample, from what its wording asks for (the first match wins); else a generic one.
const SHORT_SAMPLES: readonly [RegExp, string][] = [
  [/\bemail\b/i, 'ana@example.com'],
  [/\b(full |first |your )?name\b/i, 'Ana Silva'],
  [/\b(company|organi[sz]ation|team|business)\b/i, 'Northwind'],
  [/\b(title|summary|subject|headline)\b/i, 'Export button does nothing'],
  [/\b(city|town|location|country|where)\b/i, 'Lisbon'],
  [/\b(role|job|position)\b/i, 'Product Designer'],
  [/\b(browser|device|platform)\b/i, 'Chrome on macOS'],
  [/\b(version|build)\b/i, '2.4.1'],
  [/\b(url|website|page)\b/i, 'https://example.com/pricing'],
];

export const SAMPLE_SHORT = 'Sample answer';
export const SAMPLE_PARAGRAPH =
  'A few sentences in the respondent’s own words, as a real answer would read.';
export const SAMPLE_EMAIL = 'ana@example.com';
export const SAMPLE_PHONE = '+44 20 7946 0958';
export const SAMPLE_LINK = 'https://example.com';

// A plausible answer to `q`, one its own checks would take: its type, options, bounds and scale. `now` fixes the
// dates (a week away; a range of that day to two days later), so a test reads the same every day.
export function sampleAnswer(q: FormQuestion, now: Date = new Date()): AnswerValue {
  switch (q.type) {
    case 'short':
      return SHORT_SAMPLES.find(([re]) => re.test(q.prompt))?.[1] ?? SAMPLE_SHORT;
    case 'paragraph':
      return SAMPLE_PARAGRAPH;
    case 'number': {
      // Three, kept inside its bounds.
      const n = Math.max(q.min ?? -Infinity, Math.min(q.max ?? Infinity, 3));
      return q.whole ? Math.ceil(n) : n;
    }
    case 'email':
      return SAMPLE_EMAIL;
    case 'phone':
      return SAMPLE_PHONE;
    case 'link':
      return SAMPLE_LINK;
    case 'date':
      return dayKey(7, now);
    case 'datetime':
      return fromLocalInput(`${dayKey(7, now)}T17:00`) ?? dayKey(7, now);
    case 'daterange':
      return q.withTime
        ? [
            fromLocalInput(`${dayKey(7, now)}T09:00`) ?? dayKey(7, now),
            fromLocalInput(`${dayKey(9, now)}T17:00`) ?? dayKey(9, now),
          ]
        : [dayKey(7, now), dayKey(9, now)];
    case 'single':
      return q.options?.[0] ?? 'Option 1';
    case 'multi': {
      // Two picks where it allows them (at least its fewest), in option order.
      const options = q.options?.length ? q.options : ['Option 1'];
      const want = Math.min(options.length, q.max ?? 2, Math.max(q.min ?? 0, 2));
      return options.slice(0, Math.max(1, want));
    }
    case 'rating': {
      // Four of five: most of the way up the scale.
      const scale = q.scale ?? 5;
      return Math.max(1, Math.min(scale, Math.round(scale * 0.8)));
    }
    case 'checkbox':
      return true;
  }
}

// A sample answer to every question, in form order.
export function sampleAnswers(
  form: Pick<FormDefinition, 'sections'>,
  now?: Date,
): Map<string, AnswerValue> {
  return new Map(questionsOf(form).map((q) => [q.id, sampleAnswer(q, now)]));
}

// One line of the preview's list: where an answer lands and what it reads there. `questionId` absent: a field the
// destination sets automatically.
export type PreviewLine = { label: string; value: string; questionId?: string };

// One Description block, as the real card writes it: the prompt (bold on the card), then the answer.
export type PreviewBlock = { questionId?: string; prompt: string; answer: string };

export type CardPreview = {
  // A card for PlanCardFace, its fields the real responseCard's.
  item: Item;
  // Title, then each mapped field, then the fields set automatically.
  lines: PreviewLine[];
  // The answers that land in Description, in form order.
  description: PreviewBlock[];
};

const FORM_PERSON = (heading: string) => ({
  id: 'form-preview',
  name: `${heading || 'Untitled'} form`,
  color: '#0d9488',
});

// A set value as text: its words, a priority's name, a list joined.
function fixedText(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).join(', ');
  if (typeof v === 'string' && isPriority(v)) return PRIORITY_LABELS[v];
  return String(v);
}

// The answer that makes `rule` match: its first answer, as its question's type gives one.
function ruleAnswer(q: FormQuestion, rule: CardTypeRule): AnswerValue {
  const first = rule.anyOf[0] ?? '';
  if (q.type === 'checkbox') return first === CHECKBOX_TICKED;
  return q.type === 'multi' ? [first] : first;
}

// The card the sample answers make on `type`, through responseCard, and the lines that say where each answer went.
// With `rule` (a card type rule, `type` its type), its question takes the rule's first answer and the card is made as
// the rule makes it (forms.md "Choosing the card type by an answer").
export function previewCard(
  form: FormDefinition,
  tabId: string,
  type: ItemTypeDef,
  now: Date = new Date(),
  rule?: CardTypeRule,
): CardPreview {
  const answers = sampleAnswers(form, now);
  const ruled = rule ? questionsOf(form).find((q) => q.id === rule.questionId) : undefined;
  if (rule && ruled) answers.set(ruled.id, ruleAnswer(ruled, rule));
  const at = now.getTime();
  const chosen = rule ? { rule, status: rule.status } : undefined;
  const made = responseCard(form, tabId, answers, type, PREVIEW_NUMBER, false, at, chosen);
  const fields = made.fields;
  const lines: PreviewLine[] = [];
  const toDescription: FormQuestion[] = [];
  let titleFrom: string | undefined;
  for (const q of questionsOf(form)) {
    const target = rule ? ruleTarget(q, rule, type) : effectiveTarget(q, type);
    if (target.to === 'title') titleFrom = q.id;
    else if (target.to === 'field' && target.field) {
      const kept = fields[target.field.id];
      lines.push({
        label: target.field.label || 'Untitled',
        value: kept === undefined ? '' : answerText(q, kept as AnswerValue),
        questionId: q.id,
      });
    } else toDescription.push(q);
  }
  lines.unshift({
    label: 'Title',
    value: typeof fields['title'] === 'string' ? fields['title'] : '',
    questionId: titleFrom,
  });
  const fixed = form.destination?.fixed ?? {};
  for (const f of fixedFieldsOf(type)) {
    if (fixed[f.id] === undefined || fields[f.id] === undefined) continue;
    lines.push({ label: f.label, value: fixedText(fields[f.id]) });
  }
  const person = FORM_PERSON(form.heading);
  return {
    item: {
      id: 'form-preview',
      type: made.type,
      key: PREVIEW_NUMBER,
      rank: 'a',
      fields,
      rev: 1,
      createdAt: at,
      updatedAt: at,
      createdBy: person,
      updatedBy: person,
    },
    lines,
    description: descriptionBlocks(fields, toDescription),
  };
}

// The card's Description read back as its blocks: each bold run (a prompt) starts one, the answer after it. Matched
// to the questions that went there in order, as responseCard writes them; a Description too long to keep its runs
// is one block of its plain text.
function descriptionBlocks(
  fields: Item['fields'],
  questions: readonly FormQuestion[],
): PreviewBlock[] {
  const runs = fields[DESCRIPTION_RICH_FIELD] as { text: string; bold?: true }[] | undefined;
  if (!runs) {
    const plain = fields['description'];
    return typeof plain === 'string' && plain ? [{ prompt: '', answer: plain }] : [];
  }
  const out: PreviewBlock[] = [];
  for (const run of runs) {
    if (run.bold) out.push({ questionId: questions[out.length]?.id, prompt: run.text, answer: '' });
    else if (out.length && run.text.startsWith('\n') && !run.text.startsWith('\n\n'))
      out[out.length - 1]!.answer = run.text.slice(1);
  }
  return out;
}

export type SheetPreviewCell = { header: string; value: string; questionId?: string };

// A seeded id maker, so the planned columns come out the same each time.
function seeded(): () => number {
  let s = 0x2f6b;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

// The row the sample answers add to an empty sheet, through responseRowWrite: each column's header and its value,
// in the order the sheet would lay them out.
export function previewSheetRow(form: FormDefinition, now: Date = new Date()): SheetPreviewCell[] {
  const answers = sampleAnswers(form, now);
  const write = responseRowWrite({
    form,
    answers,
    number: PREVIEW_NUMBER,
    preview: false,
    at: now.getTime(),
    layout: { rows: [], cols: [] },
    usedRows: new Set(),
    rand: seeded(),
  });
  const cols: string[] = [];
  const rows: string[] = [];
  if (write.kind === 'layout') {
    for (const c of write.changes) {
      if (c.k === 'insertCols') cols.push(...c.ids);
      else if (c.k === 'insertRows') rows.push(...c.ids);
    }
  }
  const [headerRow, valueRow] = rows;
  const text = (i: { s?: string; n?: number; b?: boolean } | null | undefined) =>
    i?.s ?? (i?.n !== undefined ? String(i.n) : i?.b !== undefined ? (i.b ? 'TRUE' : 'FALSE') : '');
  const header = new Map<string, string>();
  const value = new Map<string, string>();
  for (const cell of ('cells' in write ? write.cells : undefined) ?? []) {
    const input = cell.i as { s?: string; n?: number; b?: boolean } | null | undefined;
    if (cell.r === headerRow) header.set(cell.c, text(input));
    else if (cell.r === valueRow) value.set(cell.c, text(input));
  }
  // The question each header names (sheetHeaders gives each a distinct wording).
  const byHeader = new Map(sheetHeaders(form).map((h) => [h.header, h.question?.id] as const));
  return cols.map((c) => {
    const h = header.get(c) ?? '';
    return { header: h, value: value.get(c) ?? '', questionId: byHeader.get(h) };
  });
}
