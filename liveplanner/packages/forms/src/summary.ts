// A form's responses summed up (docs/specs/030-forms/forms.md "The Summary"): each question's answers read back from
// where its responses live, then counted. A response is only its card or its row, so the Summary reads those as
// they stand now: a card retitled or a cell retyped changes what it shows, and a deleted one is gone from it. Pure.
import { cellKey, type Cell } from '@liveplanner/sheets';
import { durationText, type ItemFields, type ItemTypeDef } from '@liveplanner/items';
import { OTHER_ANSWER } from './answers';
import { RATING_SCALE_DEFAULT } from './limits';
import { effectiveTarget } from './mapping';
import {
  promptOf,
  questionsOf,
  type CardTypeRule,
  type FormDefinition,
  type FormQuestion,
} from './model';
import { ruleTarget } from './type-rules';

// An answer as it reads back: text, a number, a tick, or a list of picks.
export type ReadBack = string | number | boolean | readonly string[];
export type ResponseAnswers = ReadonlyMap<string, ReadBack>;

// How many text answers a question's summary lists, newest first.
export const SUMMARY_TEXT_MAX = 5;
// How many distinct answers a question with no options of its own (a Colour) lists, most given first.
export const SUMMARY_ROWS_MAX = 12;

const PREVIEW_TITLE = /^Preview: /;

// The answers a card's Description holds, by prompt: responseCard writes each as its prompt on a line of its own,
// the answer under it, a blank line between answers. A block starts at a line that is one of `prompts` with a blank
// line (or nothing) above it, so an answer of several paragraphs stays whole.
function descriptionBlocks(text: string, prompts: ReadonlySet<string>): Map<string, string> {
  const out = new Map<string, string>();
  const lines = text.split('\n');
  let prompt: string | null = null;
  let body: string[] = [];
  const close = () => {
    if (prompt === null) return;
    const answer = body.join('\n').trim();
    if (answer && !out.has(prompt)) out.set(prompt, answer);
  };
  lines.forEach((line, i) => {
    if (prompts.has(line) && (i === 0 || lines[i - 1] === '')) {
      close();
      prompt = line;
      body = [];
    } else body.push(line);
  });
  close();
  return out;
}

const isEmpty = (v: unknown) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

// A card field's value as the answer it was made from.
function fieldAnswer(q: FormQuestion, kind: string, v: unknown): ReadBack | undefined {
  if (isEmpty(v)) return undefined;
  if (typeof v === 'number')
    return q.type === 'rating' && kind === 'percent'
      ? Math.round((v * (q.scale ?? RATING_SCALE_DEFAULT)) / 100)
      : v;
  if (typeof v === 'string' || typeof v === 'boolean') return v;
  if (!Array.isArray(v)) return undefined;
  // A checklist's ticked rows are the picks; any other list is the picks themselves.
  const picks = (v as unknown[]).flatMap((x) => {
    if (typeof x === 'string') return [x];
    const row = x as { text?: unknown; done?: unknown } | null;
    return row && typeof row === 'object' && row.done === true && typeof row.text === 'string'
      ? [row.text]
      : [];
  });
  return picks.length ? picks : undefined;
}

// A response's answers read back from its card: each question's from where its answer went (the Title, a field of
// the card's type, or its block of the Description). `rule` is the card type rule that made this card's type, when
// one did: its answers went where the rule maps them.
export function cardAnswers(
  form: FormDefinition,
  fields: ItemFields,
  type: ItemTypeDef | undefined,
  rule?: CardTypeRule,
): Map<string, ReadBack> {
  const out = new Map<string, ReadBack>();
  const questions = questionsOf(form).filter((q) => q.type !== 'content');
  const targets = questions.map((q) => ({
    q,
    target: rule && type ? ruleTarget(q, rule, type) : effectiveTarget(q, type),
  }));
  const described = targets.filter((t) => t.target.to !== 'title' && !t.target.field);
  const description = typeof fields['description'] === 'string' ? fields['description'] : '';
  const blocks = description
    ? descriptionBlocks(description, new Set(described.map((t) => promptOf(t.q))))
    : null;
  for (const { q, target } of targets) {
    if (target.to === 'title') {
      const title = typeof fields['title'] === 'string' ? fields['title'] : '';
      const answer = title.replace(PREVIEW_TITLE, '').trim();
      if (answer) out.set(q.id, answer);
    } else if (target.to === 'field' && target.field) {
      const answer = fieldAnswer(q, target.field.kind, fields[target.field.id]);
      if (answer !== undefined) out.set(q.id, answer);
    } else {
      const answer = blocks?.get(promptOf(q));
      if (answer) out.set(q.id, answer);
    }
  }
  return out;
}

// A sheet form's responses read back from its sheet, in row order: every row holding a response number in the #
// column, each question's answer from the column the form remembers for it (form.sheet.columns).
export function sheetResponses(
  form: FormDefinition,
  sheet: { layout: { rows: readonly string[] }; cells: ReadonlyMap<string, Cell> },
): Map<string, ReadBack>[] {
  const columns = form.sheet?.columns;
  const numbers = columns?.['#'];
  if (!columns || !numbers) return [];
  const questions = questionsOf(form).filter((q) => q.type !== 'content' && columns[q.id]);
  const out: Map<string, ReadBack>[] = [];
  for (const row of sheet.layout.rows) {
    const number = sheet.cells.get(cellKey(row, numbers))?.input;
    if (!number || !('n' in number)) continue;
    const answers = new Map<string, ReadBack>();
    for (const q of questions) {
      const input = sheet.cells.get(cellKey(row, columns[q.id]!))?.input;
      if (!input) continue;
      if ('n' in input) answers.set(q.id, input.n);
      else if ('b' in input) answers.set(q.id, input.b);
      else if ('s' in input && input.s.trim()) answers.set(q.id, input.s.trim());
    }
    out.push(answers);
  }
  return out;
}

export type SummaryRow = { label: string; count: number };

export type QuestionSummary = { question: FormQuestion; answered: number } & (
  | { kind: 'choices'; rows: SummaryRow[] }
  | { kind: 'rating'; scale: number; average: number | null; counts: number[] }
  | { kind: 'number'; average: number | null; min: number | null; max: number | null }
  | { kind: 'text'; latest: string[] }
);

// The picks a Multiple Choice answer kept as one text ("A, B") holds: its options read off the front, longest first,
// so an option with a comma of its own is still one pick; whatever is left over is the Other answer.
function picksIn(text: string, options: readonly string[]): string[] {
  const byLength = [...options].sort((a, b) => b.length - a.length);
  const out: string[] = [];
  let rest = text.trim();
  while (rest) {
    const lower = rest.toLowerCase();
    const hit = byLength.find(
      (o) =>
        lower.startsWith(o.toLowerCase()) &&
        (rest.length === o.length || rest.startsWith(', ', o.length)),
    );
    if (!hit) {
      out.push(rest);
      break;
    }
    out.push(hit);
    rest = rest.slice(hit.length + 2);
  }
  return out;
}

const OTHER_LABEL = 'Other';

function choiceRows(q: FormQuestion, answers: readonly ReadBack[]): SummaryRow[] {
  const options = q.options ?? [];
  const optionOf = new Map(options.map((o) => [o.toLowerCase(), o]));
  const counts = new Map<string, number>(options.map((o) => [o, 0]));
  let other = 0;
  for (const a of answers) {
    const picks =
      typeof a === 'string' ? (q.type === 'multi' ? picksIn(a, options) : [a]) : (a as string[]);
    // One response counts once for an option, and once for Other however many of its picks are not options.
    const seen = new Set<string | null>();
    for (const p of picks)
      seen.add(p === OTHER_ANSWER ? null : (optionOf.get(p.trim().toLowerCase()) ?? null));
    for (const option of seen)
      if (option === null) other += 1;
      else counts.set(option, counts.get(option)! + 1);
  }
  const rows = [...counts].map(([label, count]) => ({ label, count }));
  return other || q.other ? [...rows, { label: OTHER_LABEL, count: other }] : rows;
}

// Distinct answers, most given first (ties in the order first given), for a question with no options of its own.
function tallyRows(answers: readonly ReadBack[]): SummaryRow[] {
  const counts = new Map<string, number>();
  for (const a of answers) {
    const label = String(a).trim().toLowerCase();
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, SUMMARY_ROWS_MAX);
}

const tick = (a: ReadBack): boolean | null =>
  typeof a === 'boolean'
    ? a
    : /^(yes|true)$/i.test(String(a))
      ? true
      : /^(no|false)$/i.test(String(a))
        ? false
        : null;

// A number an answer holds: itself, or the number its text starts with ("4 / 5").
function numberOf(a: ReadBack): number | null {
  if (typeof a === 'number') return Number.isFinite(a) ? a : null;
  if (typeof a !== 'string') return null;
  const m = /^-?\d+(?:\.\d+)?/.exec(a.trim());
  return m ? Number(m[0]) : null;
}

const mean = (xs: readonly number[]) =>
  xs.length ? xs.reduce((sum, x) => sum + x, 0) / xs.length : null;

function textOf(q: FormQuestion, a: ReadBack): string {
  if (q.type === 'duration' && typeof a === 'number') return durationText(a);
  return Array.isArray(a) ? a.join(', ') : String(a);
}

// Every question's summary, in form order (content blocks ask nothing and have none). `responses` oldest first:
// a text question lists its newest answers.
export function summariseResponses(
  form: FormDefinition,
  responses: readonly ResponseAnswers[],
): QuestionSummary[] {
  return questionsOf(form)
    .filter((q) => q.type !== 'content')
    .map((question): QuestionSummary => {
      const answers = responses.flatMap((r) => {
        const a = r.get(question.id);
        return a === undefined ? [] : [a];
      });
      const answered = answers.length;
      switch (question.type) {
        case 'single':
        case 'multi':
          return { question, answered, kind: 'choices', rows: choiceRows(question, answers) };
        case 'colour':
          return { question, answered, kind: 'choices', rows: tallyRows(answers) };
        case 'checkbox': {
          const ticks = answers.map(tick);
          return {
            question,
            answered,
            kind: 'choices',
            rows: [
              { label: 'Yes', count: ticks.filter((t) => t === true).length },
              { label: 'No', count: ticks.filter((t) => t === false).length },
            ],
          };
        }
        case 'rating': {
          const scale = question.scale ?? RATING_SCALE_DEFAULT;
          const given = answers
            .map(numberOf)
            .filter((n): n is number => n !== null && n >= 1 && n <= scale)
            .map(Math.round);
          const counts = Array.from(
            { length: scale },
            (_, i) => given.filter((n) => n === i + 1).length,
          );
          return {
            question,
            answered: given.length,
            kind: 'rating',
            scale,
            average: mean(given),
            counts,
          };
        }
        case 'number': {
          const given = answers.map(numberOf).filter((n): n is number => n !== null);
          return {
            question,
            answered: given.length,
            kind: 'number',
            average: mean(given),
            min: given.length ? Math.min(...given) : null,
            max: given.length ? Math.max(...given) : null,
          };
        }
        default:
          return {
            question,
            answered,
            kind: 'text',
            latest: answers
              .slice(-SUMMARY_TEXT_MAX)
              .reverse()
              .map((a) => textOf(question, a)),
          };
      }
    });
}
