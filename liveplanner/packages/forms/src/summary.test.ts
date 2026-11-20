import { describe, expect, it } from 'vitest';
import { cellKey, type Cell } from '@liveplanner/sheets';
import type { ItemTypeDef } from '@liveplanner/items';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { FormDefinition, FormQuestion } from './model';
import { responseCard } from './card';
import type { AnswerValue } from './answers';
import {
  SUMMARY_ROWS_MAX,
  cardAnswers,
  sheetResponses,
  summariseResponses,
  type ReadBack,
} from './summary';

// The Summary (docs/specs/030-forms/forms.md "The Summary"): answers read back from cards and rows, then counted.

const TYPE: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  fields: ['title', 'description', 'f-sev', 'f-tags', 'f-score', 'f-pct', 'f-steps'],
  custom: [
    { id: 'f-sev', label: 'Severity', kind: 'choice', options: ['Low', 'High'] },
    { id: 'f-tags', label: 'Tags', kind: 'multichoice', options: ['UI', 'API'] },
    { id: 'f-score', label: 'Score', kind: 'rating' },
    { id: 'f-pct', label: 'Share', kind: 'percent' },
    { id: 'f-steps', label: 'Steps', kind: 'checklist' },
  ],
} as unknown as ItemTypeDef;

const q = (
  id: string,
  type: FormQuestion['type'],
  more: Partial<FormQuestion> = {},
): FormQuestion => ({ id, type, prompt: id, ...more });

const form = (questions: FormQuestion[], more: Partial<FormDefinition> = {}): FormDefinition => ({
  v: 1,
  heading: 'Report',
  sections: [{ id: 's', title: '', questions }],
  destination: { tabId: 't', typeId: 'bug', status: 'new' },
  ...more,
});

describe('cardAnswers', () => {
  const FORM = form([
    q('Name', 'short', { goesTo: { to: 'title' } }),
    q('Severity', 'single', {
      options: ['Low', 'High'],
      goesTo: { to: 'field', fieldId: 'f-sev' },
    }),
    q('Tags', 'multi', { options: ['UI', 'API'], goesTo: { to: 'field', fieldId: 'f-tags' } }),
    q('Score', 'rating', { goesTo: { to: 'field', fieldId: 'f-score' } }),
    q('Share', 'rating', { scale: 10, goesTo: { to: 'field', fieldId: 'f-pct' } }),
    q('Steps', 'multi', { options: ['One', 'Two'], goesTo: { to: 'field', fieldId: 'f-steps' } }),
    q('What happened?', 'paragraph'),
    q('Agree', 'checkbox'),
    q('Note', 'content'),
  ]);
  const answers = new Map<string, AnswerValue>([
    ['Name', 'Ada'],
    ['Severity', 'High'],
    ['Tags', ['UI', 'API']],
    ['Score', 4],
    ['Share', 7],
    ['Steps', ['Two']],
    ['What happened?', 'It broke.\n\nTwice.'],
    ['Agree', true],
  ]);

  it('reads back what responseCard wrote, from the title, the fields and the description', () => {
    const card = responseCard(FORM, 't', answers, TYPE, 3);
    const read = cardAnswers(FORM, card.fields, TYPE);
    expect(read.get('Name')).toBe('Ada');
    expect(read.get('Severity')).toBe('High');
    expect(read.get('Tags')).toEqual(['UI', 'API']);
    expect(read.get('Score')).toBe(4);
    expect(read.get('Share')).toBe(7);
    expect(read.get('Steps')).toEqual(['Two']);
    expect(read.get('What happened?')).toBe('It broke.\n\nTwice.');
    expect(read.get('Agree')).toBe('Yes');
    expect(read.has('Note')).toBe(false);
  });

  it("drops a preview's mark from the title, and reads nothing from a card with no answers", () => {
    const card = responseCard(FORM, 't', answers, TYPE, 3, true);
    expect(cardAnswers(FORM, card.fields, TYPE).get('Name')).toBe('Ada');
    expect(cardAnswers(FORM, {}, TYPE).size).toBe(0);
    expect(cardAnswers(FORM, { title: '  ', 'f-tags': [], 'f-sev': { odd: 1 } }, TYPE).size).toBe(
      0,
    );
    expect(cardAnswers(FORM, { 'f-steps': [{ text: 'One', done: false }, 7] }, TYPE).size).toBe(0);
  });

  it('reads a card with no type from its description alone', () => {
    const card = responseCard(FORM, 't', answers, TYPE, 3);
    const read = cardAnswers(FORM, { description: card.fields['description'] ?? '' }, undefined);
    expect(read.get('What happened?')).toBe('It broke.\n\nTwice.');
    expect(read.has('Severity')).toBe(false);
  });

  it("reads a rule's card where the rule mapped its answers", () => {
    const rule = {
      id: 'r',
      questionId: 'Severity',
      anyOf: ['High'],
      typeId: 'bug',
      status: 'new',
      fields: { Severity: 'f-sev' },
    };
    const plain = form([q('Severity', 'single', { options: ['Low', 'High'] })]);
    const card = responseCard(plain, 't', new Map([['Severity', 'High']]), TYPE, 1, false, 0, {
      rule,
      status: 'new',
    });
    expect(cardAnswers(plain, card.fields, TYPE, rule).get('Severity')).toBe('High');
    // Without the rule it would be looked for in the Description, where it is not.
    expect(cardAnswers(plain, card.fields, TYPE).has('Severity')).toBe(false);
  });
});

describe('cardAnswers, the edges', () => {
  it('keeps the first of two blocks under one prompt, and none for a prompt with nothing under it', () => {
    const f = form([q('Why', 'paragraph'), q('How', 'paragraph')]);
    const read = cardAnswers(f, { description: 'Why\nFirst\n\nWhy\nSecond\n\nHow\n' }, undefined);
    expect([...read]).toEqual([['Why', 'First']]);
  });

  it('reads a rating kept as a share back onto its own scale, five steps unless it says', () => {
    const f = form([q('Stars', 'rating', { goesTo: { to: 'field', fieldId: 'f-pct' } })]);
    expect(cardAnswers(f, { 'f-pct': 80 }, TYPE).get('Stars')).toBe(4);
  });
});

describe('sheetResponses', () => {
  const FORM = form(
    [q('Name', 'short'), q('Age', 'number'), q('Agree', 'checkbox'), q('Unplaced', 'short')],
    {
      sheet: {
        tabId: 't',
        sheetId: 's',
        columns: { '#': 'c0', Name: 'c1', Age: 'c2', Agree: 'c3' },
      },
    },
  );
  const cells = new Map<string, Cell>([
    [cellKey('r0', 'c0'), { input: { s: '#' } }],
    [cellKey('r1', 'c0'), { input: { n: 1 } }],
    [cellKey('r1', 'c1'), { input: { s: ' Ada ' } }],
    [cellKey('r1', 'c2'), { input: { n: 36 } }],
    [cellKey('r1', 'c3'), { input: { b: true } }],
    [cellKey('r2', 'c0'), { input: { n: 2 } }],
    [cellKey('r2', 'c1'), { input: { s: '  ' } }],
    [cellKey('r2', 'c2'), { input: { f: {} as never } }],
    [cellKey('r3', 'c1'), { input: { s: 'No number: not a response' } }],
  ]);
  const sheet = { layout: { rows: ['r0', 'r1', 'r2', 'r3'] }, cells };

  it('reads each numbered row, each answer from its remembered column', () => {
    const rows = sheetResponses(FORM, sheet);
    expect(rows).toHaveLength(2);
    expect([...rows[0]!]).toEqual([
      ['Name', 'Ada'],
      ['Age', 36],
      ['Agree', true],
    ]);
    expect(rows[1]!.size).toBe(0);
  });

  it('reads nothing until the form remembers its columns', () => {
    expect(sheetResponses(form([q('Name', 'short')]), sheet)).toEqual([]);
    expect(
      sheetResponses(form([], { sheet: { tabId: 't', sheetId: 's', columns: {} } }), sheet),
    ).toEqual([]);
  });
});

describe('summariseResponses', () => {
  const one = (question: FormQuestion, answers: (ReadBack | undefined)[]) =>
    summariseResponses(
      form([question]),
      answers.map((a) => new Map(a === undefined ? [] : [[question.id, a]])),
    )[0]!;

  it('counts a Single Choice by option, anything else as Other', () => {
    const s = one(q('Size', 'single', { options: ['S', 'M'], other: true }), [
      'S',
      'm',
      'Huge',
      '__other__',
      undefined,
    ]);
    expect(s).toMatchObject({ kind: 'choices', answered: 4 });
    expect(s.kind === 'choices' && s.rows).toEqual([
      { label: 'S', count: 1 },
      { label: 'M', count: 1 },
      { label: 'Other', count: 2 },
    ]);
  });

  it('shows no Other row when nobody gave one and the question offers none', () => {
    const s = one(q('Size', 'single', { options: ['S', 'M'] }), ['S']);
    expect(s.kind === 'choices' && s.rows.map((r) => r.label)).toEqual(['S', 'M']);
  });

  it('counts each pick of a Multiple Choice, from a list or from its text', () => {
    const options = ['Red', 'Red, White and Blue', 'Green'];
    const s = one(q('Flags', 'multi', { options }), [
      ['Red', 'Green'],
      'Red, White and Blue, Green',
      'Red, Teal, Mauve',
      'Green',
    ]);
    expect(s.kind === 'choices' && s.rows).toEqual([
      { label: 'Red', count: 2 },
      { label: 'Red, White and Blue', count: 1 },
      { label: 'Green', count: 3 },
      { label: 'Other', count: 1 },
    ]);
  });

  it('counts every answer of a choice with no options as Other', () => {
    const s = one(q('Size', 'single'), ['S']);
    expect(s.kind === 'choices' && s.rows).toEqual([{ label: 'Other', count: 1 }]);
  });

  it('counts a Checkbox as Yes and No, from ticks or their text', () => {
    const s = one(q('Agree', 'checkbox'), [true, 'Yes', false, 'no', 'maybe']);
    expect(s.kind === 'choices' && s.rows).toEqual([
      { label: 'Yes', count: 2 },
      { label: 'No', count: 2 },
    ]);
  });

  it('lists a Colour by how often it was given, capped', () => {
    const many = Array.from({ length: 20 }, (_, i) => `#0000${String(i).padStart(2, '0')}`);
    const s = one(q('Hue', 'colour'), ['#FF0000', '#00ff00', '#ff0000', ...many]);
    expect(s.kind === 'choices' && s.rows[0]).toEqual({ label: '#ff0000', count: 2 });
    expect(s.kind === 'choices' && s.rows).toHaveLength(SUMMARY_ROWS_MAX);
  });

  it('averages a Rating and counts each step, from numbers or "4 / 5"', () => {
    const s = one(q('Stars', 'rating'), [4, '5 / 5', '2', 9, 'n/a', ['x']]);
    expect(s).toMatchObject({ kind: 'rating', scale: 5, answered: 3, counts: [0, 1, 0, 1, 1] });
    expect(s.kind === 'rating' && s.average).toBeCloseTo(11 / 3);
    expect(one(q('Stars', 'rating', { scale: 3 }), [])).toMatchObject({
      average: null,
      counts: [0, 0, 0],
    });
  });

  it('gives a Number its average and range', () => {
    expect(one(q('Age', 'number'), [10, '20', -3.5, 'old', Infinity])).toMatchObject({
      kind: 'number',
      answered: 3,
      min: -3.5,
      max: 20,
    });
    expect(one(q('Age', 'number'), [])).toMatchObject({ average: null, min: null, max: null });
  });

  it('lists the newest text answers first, a duration as people write it', () => {
    const s = one(q('Why', 'paragraph'), ['a', 'b', 'c', 'd', 'e', 'f', ['x', 'y']]);
    expect(s.kind === 'text' && s.latest).toEqual(['x, y', 'f', 'e', 'd', 'c']);
    const d = one(q('How long', 'duration'), [150, '45m']);
    expect(d.kind === 'text' && d.latest).toEqual(['45m', '2h 30m']);
  });

  it('skips content blocks', () => {
    expect(summariseResponses(form([q('Note', 'content'), q('Name', 'short')]), [])).toHaveLength(
      1,
    );
  });

  it('sums up a full project of responses within its budget', () => {
    const questions = Array.from({ length: 30 }, (_, i) =>
      i % 3 === 0
        ? q(`q${i}`, 'multi', { options: Array.from({ length: 20 }, (_, o) => `Option ${o}`) })
        : i % 3 === 1
          ? q(`q${i}`, 'rating')
          : q(`q${i}`, 'paragraph'),
    );
    const responses = Array.from(
      { length: 5000 },
      (_, r) =>
        new Map<string, ReadBack>(
          questions.map((x, i) => [
            x.id,
            i % 3 === 0
              ? `Option ${r % 20}, Option ${(r + 7) % 20}`
              : i % 3 === 1
                ? (r % 5) + 1
                : `Answer ${r}`,
          ]),
        ),
    );
    const ms = cpuMsOf(() => summariseResponses(form(questions), responses));
    expect(ms).toBeLessThan(cpuBudgetMs(400));
  });
});
