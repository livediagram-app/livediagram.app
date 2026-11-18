import { describe, expect, it } from 'vitest';
import type { ItemTypeDef } from '@liveplanner/items';
import { answerErrorMessage, checkAnswer, type AnswerValue } from './answers';
import { ANSWER_VALUE_MAX, answerValues } from './answer-values';
import { responseCard } from './card';
import {
  addQuestion,
  addSection,
  blankContent,
  moveSection,
  placeSection,
  setQuestionType,
} from './edits';
import { fieldTakes } from './mapping';
import {
  formImageIds,
  partsOf,
  questionsOf,
  type FormDefinition,
  type FormQuestion,
} from './model';
import { readPrefill } from './prefill';
import { publicForm } from './public';
import { publishProblems } from './publish-check';
import { readForm } from './read';
import { responseRowWrite } from './sheet-row';
import { secondsLeft, partSeconds, timeLeftText } from './time-estimate';
import { typeQuestionFields } from './type-questions';

// The forms batch of 2026-11-18 (docs/specs/030-forms/forms.md): content blocks, pictures, a default answer, Width,
// Duration and Colour questions, more field kinds, reordering sections, the time left and answers as rule values.

const Q = (type: FormQuestion['type'], extra: Partial<FormQuestion> = {}): FormQuestion => ({
  id: `q-${type}`,
  type,
  prompt: type,
  ...extra,
});
const form = (questions: FormQuestion[], extra: Partial<FormDefinition> = {}): FormDefinition => ({
  v: 1,
  heading: 'F',
  sections: [{ id: 's-1', title: '', questions }],
  ...extra,
});
let n = 0;
const newId = (p: string) => `${p}-n${(n += 1)}`;

describe('content blocks', () => {
  it('ask nothing: no answer, no question, no problems, no prefill', () => {
    const c = blankContent('text', 'q-c');
    expect(checkAnswer(c, 'anything')).toEqual({});
    const f = form([c, Q('short')]);
    expect(questionsOf(f).map((q) => q.id)).toEqual(['q-short']);
    expect(partsOf(f).map((q) => q.id)).toEqual(['q-c', 'q-short']);
    expect(publishProblems(f, undefined)).toEqual([]);
    expect(readPrefill(f, '?q.q-c=x&q.q-short=Ada')).toEqual({ 'q-short': 'Ada' });
  });

  it('start as their kind: a callout as Info', () => {
    expect(blankContent('callout', 'q-1')).toEqual({
      id: 'q-1',
      type: 'content',
      prompt: '',
      block: 'callout',
      tone: 'info',
    });
    expect(blankContent('image', 'q-2').tone).toBeUndefined();
  });

  it('are read with only what their kind holds', () => {
    const f = readForm({
      v: 1,
      heading: 'F',
      sections: [
        {
          id: 's-1',
          title: '',
          questions: [
            {
              id: 'q-a',
              type: 'content',
              block: 'callout',
              tone: 'warning',
              help: 'Mind',
              required: true,
            },
            { id: 'q-b', type: 'content', block: 'callout', tone: 'loud' },
            { id: 'q-c', type: 'content', block: 'link', url: 'https://x.test/a', linkLabel: 'Go' },
            { id: 'q-d', type: 'content', block: 'link', url: 'javascript:alert(1)' },
            { id: 'q-e', type: 'content', block: 'image', imageId: 'img_1' },
            { id: 'q-f', type: 'content', block: 'image', imageId: 'bad id!' },
            { id: 'q-g', type: 'content', block: 'nonsense' },
          ],
        },
      ],
    })!;
    const [a, b, c, d, e, g, h] = f.sections[0]!.questions;
    expect(a).toEqual({
      id: 'q-a',
      type: 'content',
      prompt: '',
      block: 'callout',
      tone: 'warning',
      help: 'Mind',
    });
    expect(b!.tone).toBe('info');
    expect(c).toMatchObject({ url: 'https://x.test/a', linkLabel: 'Go' });
    expect(d!.url).toBeUndefined();
    expect(e!.imageId).toBe('img_1');
    expect(g!.imageId).toBeUndefined();
    expect(h!.block).toBe('text');
  });

  it('are added in a section, after a part or at its end, and never change type', () => {
    const two: FormDefinition = {
      v: 1,
      heading: 'F',
      sections: [
        { id: 's-1', title: '', questions: [Q('short')] },
        { id: 's-2', title: '', questions: [Q('number')] },
      ],
    };
    const atEnd = addQuestion(two, 'content', null, newId, { inSection: 's-1', block: 'link' });
    expect(atEnd.form.sections[0]!.questions.map((q) => q.block ?? q.type)).toEqual([
      'short',
      'link',
    ]);
    const plain = addQuestion(two, 'content', null, newId);
    expect(plain.form.sections[1]!.questions.at(-1)!.block).toBe('text');
    const after = addQuestion(two, 'short', 'q-short', newId, { inSection: 's-2' });
    expect(after.form.sections[0]!.questions).toHaveLength(2);
    const id = atEnd.form.sections[0]!.questions[1]!.id;
    expect(setQuestionType(atEnd.form, id, 'short')).toEqual(atEnd.form);
    expect(setQuestionType(atEnd.form, 'q-short', 'content')).toEqual(atEnd.form);
  });
});

describe('pictures', () => {
  it('reads a cover picture with its focus and credit, and lists every picture once', () => {
    const f = readForm({
      v: 1,
      heading: 'F',
      cover: { imageId: 'img_1', focus: 30, credit: '"Sky" by Ana, CC BY 4.0' },
      sections: [
        {
          id: 's-1',
          title: '',
          questions: [
            { id: 'q-a', type: 'content', block: 'image', imageId: 'img_1' },
            { id: 'q-b', type: 'content', block: 'image', imageId: 'img_2' },
            { id: 'q-c', type: 'content', block: 'image' },
          ],
        },
      ],
    })!;
    expect(f.cover).toEqual({ imageId: 'img_1', focus: 30, credit: '"Sky" by Ana, CC BY 4.0' });
    expect(formImageIds(f)).toEqual(['img_1', 'img_2']);
    expect(readForm({ ...f, cover: { imageId: 'img_1', focus: 101 } })!.cover).toEqual({
      imageId: 'img_1',
    });
    expect(readForm({ ...f, cover: { imageId: '../x' } })!.cover).toBeUndefined();
    expect(formImageIds(form([]))).toEqual([]);
  });
});

describe('Width', () => {
  it('is kept only as wide, and shown on the link', () => {
    expect(readForm({ v: 1, heading: 'F', sections: [], width: 'wide' })!.width).toBe('wide');
    expect(readForm({ v: 1, heading: 'F', sections: [], width: 'huge' })!.width).toBeUndefined();
    expect(publicForm(form([], { width: 'wide' })).width).toBe('wide');
    expect(publicForm(form([])).width).toBeUndefined();
  });
});

describe('a checkbox’s words and a default answer', () => {
  const read = (q: Record<string, unknown>) =>
    readForm({ v: 1, heading: 'F', sections: [{ id: 's-1', title: '', questions: [q] }] })!
      .sections[0]!.questions[0]!;

  it('keeps a checkbox’s own words', () => {
    expect(
      read({ id: 'q-1', type: 'checkbox', prompt: 'Ok', checkLabel: ' I agree ' }).checkLabel,
    ).toBe('I agree');
    expect(
      read({ id: 'q-1', type: 'short', prompt: 'Ok', checkLabel: 'x' }).checkLabel,
    ).toBeUndefined();
  });

  it('keeps a default the question takes, as checked, and never on a required question', () => {
    expect(read({ id: 'q-1', type: 'number', prompt: 'N', fallback: '5' }).fallback).toBe(5);
    expect(read({ id: 'q-1', type: 'duration', prompt: 'D', fallback: '1h' }).fallback).toBe(60);
    expect(
      read({ id: 'q-1', type: 'multi', prompt: 'M', options: ['A', 'B'], fallback: ['B'] })
        .fallback,
    ).toEqual(['B']);
    expect(
      read({ id: 'q-1', type: 'number', prompt: 'N', fallback: 'x' }).fallback,
    ).toBeUndefined();
    expect(
      read({ id: 'q-1', type: 'short', prompt: 'S', fallback: 'x', required: true }).fallback,
    ).toBeUndefined();
    expect(
      read({ id: 'q-1', type: 'checkbox', prompt: 'C', fallback: 'x' }).fallback,
    ).toBeUndefined();
    expect(
      read({ id: 'q-1', type: 'short', prompt: 'S', fallback: { x: 1 } }).fallback,
    ).toBeUndefined();
  });

  it('answers an empty question with its default', () => {
    expect(checkAnswer(Q('short', { fallback: 'Guest' }), '')).toEqual({ value: 'Guest' });
    expect(checkAnswer(Q('short'), '')).toEqual({});
  });
});

describe('Duration and Colour', () => {
  it('check their answers', () => {
    expect(checkAnswer(Q('duration'), '2h 30m')).toEqual({ value: 150 });
    expect(checkAnswer(Q('duration'), 45)).toEqual({ value: 45 });
    expect(checkAnswer(Q('duration'), 'soon')).toEqual({ error: 'not_a_duration' });
    expect(checkAnswer(Q('duration'), ['1h'])).toEqual({ error: 'not_a_duration' });
    expect(checkAnswer(Q('colour'), ' #AABBCC ')).toEqual({ value: '#aabbcc' });
    expect(checkAnswer(Q('colour'), 'red')).toEqual({ error: 'not_a_colour' });
    expect(checkAnswer(Q('colour'), 3)).toEqual({ error: 'not_a_colour' });
    expect(answerErrorMessage(Q('duration'), 'not_a_duration')).toBe(
      'Enter a duration like 2h 30m, 90m or 1.5h',
    );
    expect(answerErrorMessage(Q('colour'), 'not_a_colour')).toBe('Pick a colour');
  });

  it('write a duration as people do, in a card and a sheet', () => {
    const f = form([Q('duration')]);
    const type: ItemTypeDef = {
      id: 't',
      label: 'T',
      newTitle: '',
      glyph: 'task',
      color: '#000',
      fields: ['title', 'description'],
    };
    const card = responseCard(f, 'tab', new Map([['q-duration', 150]]), type, 1);
    expect(card.fields['description']).toContain('2h 30m');
    const w = responseRowWrite({
      form: f,
      answers: new Map([['q-duration', 150]]),
      number: 1,
      preview: false,
      at: 0,
      layout: { rows: ['r1', 'r2'], cols: ['ca', 'cb', 'cc'] },
      header: new Map(),
      usedRows: new Set(),
      rand: () => 0.5,
    });
    const cells = w.kind === 'title' ? [] : (w.cells ?? []);
    expect(cells.find((c) => c.r === 'r2' && c.c === 'cc')?.i).toEqual({ s: '2h 30m' });
  });
});

describe('more field kinds', () => {
  const custom = [
    { id: 'f-pct', label: 'Done', kind: 'percent' },
    { id: 'f-tags', label: 'Tags', kind: 'labels' },
    { id: 'f-list', label: 'Steps', kind: 'checklist' },
    { id: 'f-pr', label: 'PR', kind: 'pullrequest' },
    { id: 'f-mins', label: 'Minutes', kind: 'number' },
    { id: 'f-spent', label: 'Spent', kind: 'duration', timeSpent: true },
  ] as unknown as NonNullable<ItemTypeDef['custom']>;
  const type: ItemTypeDef = {
    id: 't',
    label: 'T',
    newTitle: '',
    glyph: 'task',
    color: '#000',
    fields: ['title', ...custom.map((f) => f.id)],
    custom,
  };
  const field = (id: string) => custom.find((f) => f.id === id)!;
  const to = (fieldId: string) => ({ goesTo: { to: 'field' as const, fieldId } });

  it('takes a whole Number from 0 to 100 or a Rating as a Percent, never Time Spent', () => {
    expect(fieldTakes(Q('number', { whole: true, min: 0, max: 100 }), field('f-pct'))).toBe(true);
    expect(fieldTakes(Q('number'), field('f-pct'))).toBe(false);
    expect(fieldTakes(Q('rating'), field('f-pct'))).toBe(true);
    expect(fieldTakes(Q('duration'), field('f-spent'))).toBe(false);
    expect(
      typeQuestionFields(type).some((f) => f.kind === 'field' && f.field.id === 'f-spent'),
    ).toBe(false);
  });

  it('fills each kind from its answer', () => {
    const qs = [
      Q('rating', { id: 'q-r', scale: 4, ...to('f-pct') }),
      Q('multi', { id: 'q-m', options: ['A', 'B'], ...to('f-tags') }),
      Q('multi', { id: 'q-c', options: ['One', 'Two'], ...to('f-list') }),
      Q('link', { id: 'q-l', ...to('f-pr') }),
      Q('duration', { id: 'q-d', ...to('f-mins') }),
    ];
    const answers = new Map<string, AnswerValue>([
      ['q-r', 3],
      ['q-m', ['B']],
      ['q-c', ['Two', 'Extra']],
      ['q-l', 'https://example.com/not-a-pr'],
      ['q-d', 90],
    ]);
    const fields = responseCard(form(qs), 'tab', answers, type, 1).fields;
    expect(fields['f-pct']).toBe(75);
    expect(fields['f-tags']).toEqual(['B']);
    expect(fields['f-list']).toEqual([
      { text: 'One', done: false },
      { text: 'Two', done: true },
      { text: 'Extra', done: true },
    ]);
    expect(fields['f-pr']).toBe('https://example.com/not-a-pr');
    expect(fields['f-mins']).toBe(90);
    const num = responseCard(
      form([Q('number', { id: 'q-n', whole: true, min: 0, max: 100, ...to('f-pct') })]),
      'tab',
      new Map([['q-n', 140]]),
      type,
      1,
    ).fields;
    expect(num['f-pct']).toBe(100);
    const one = responseCard(
      form([Q('single', { id: 'q-s', options: ['X'], ...to('f-tags') })]),
      'tab',
      new Map([['q-s', 'X']]),
      type,
      1,
    ).fields;
    expect(one['f-tags']).toEqual(['X']);
    const plain = responseCard(
      form([
        Q('rating', { id: 'q-r', ...to('f-pct') }),
        Q('multi', { id: 'q-m', ...to('f-list') }),
      ]),
      'tab',
      new Map<string, AnswerValue>([
        ['q-r', 4],
        ['q-m', ['Mine']],
      ]),
      type,
      1,
    ).fields;
    expect(plain['f-pct']).toBe(80);
    expect(plain['f-list']).toEqual([{ text: 'Mine', done: true }]);
  });
});

describe('reordering sections', () => {
  const three: FormDefinition = {
    v: 1,
    heading: 'F',
    sections: [
      { id: 's-1', title: 'A', questions: [Q('single', { options: ['Y'] })] },
      { id: 's-2', title: 'B', questions: [], showIf: { questionId: 'q-single', anyOf: ['Y'] } },
      { id: 's-3', title: 'C', questions: [] },
    ],
  };
  const ids = (f: FormDefinition) => f.sections.map((s) => s.id);

  it('moves a section, its rule dropped when it becomes first', () => {
    expect(ids(placeSection(three, 's-3', 0))).toEqual(['s-3', 's-1', 's-2']);
    const first = placeSection(three, 's-2', -4);
    expect(ids(first)).toEqual(['s-2', 's-1', 's-3']);
    expect(first.sections[0]!.showIf).toBeUndefined();
    expect(placeSection(three, 's-1', 0)).toBe(three);
    expect(placeSection(three, 'nope', 1)).toBe(three);
    expect(ids(moveSection(three, 's-1', 1))).toEqual(['s-2', 's-1', 's-3']);
    expect(moveSection(three, 'nope', 1)).toBe(three);
  });

  it('adds an empty section after the one named, else at the end', () => {
    expect(ids(addSection(three, newId, null, 's-1').form)[1]).toMatch(/^s-n/);
    expect(ids(addSection(three, newId, null, 'gone').form)[3]).toMatch(/^s-n/);
  });
});

describe('the time left', () => {
  const f: FormDefinition = {
    v: 1,
    heading: 'F',
    sections: [
      {
        id: 's-1',
        title: '',
        questions: [
          Q('short'),
          Q('checkbox'),
          { ...blankContent('text', 'q-t'), help: 'one two three' },
        ],
      },
      { id: 's-2', title: '', questions: [Q('paragraph')] },
    ],
  };

  it('counts each unanswered question and each block’s reading', () => {
    expect(partSeconds(Q('short'), undefined)).toBe(20);
    expect(partSeconds(Q('short'), 'Ada')).toBe(0);
    expect(partSeconds(blankContent('text', 'x'), undefined)).toBe(3);
    const long = {
      ...blankContent('text', 'x'),
      prompt: 'Heading',
      help: Array(400).fill('w').join(' '),
    };
    expect(partSeconds(long, undefined)).toBe(120);
    const left = secondsLeft(f, { 'q-short': 'Ada' }, [0, 1], 0);
    expect(left.bySection.get(0)).toBe(7);
    expect(left.total).toBe(67);
    expect(secondsLeft(f, {}, [0, 1, 5], 1).total).toBe(60);
  });

  it('says it in words', () => {
    expect(timeLeftText(0)).toBeNull();
    expect(timeLeftText(30)).toBe('Under a minute left');
    expect(timeLeftText(200)).toBe('About 3 min left');
  });
});

describe('answers as rule values', () => {
  it('gives each question’s answer as text by its words, the first wording winning', () => {
    const f = form([
      Q('short', { id: 'q-a', prompt: 'Company' }),
      Q('short', { id: 'q-b', prompt: 'Company' }),
      Q('multi', { id: 'q-c', prompt: 'Picks', options: ['A', 'B'] }),
      Q('short', { id: 'q-d', prompt: '  ' }),
      Q('paragraph', { id: 'q-e', prompt: 'Notes' }),
      blankContent('text', 'q-t'),
    ]);
    const values = answerValues(
      f,
      new Map<string, AnswerValue>([
        ['q-a', 'Acme'],
        ['q-b', 'Other'],
        ['q-c', ['A', 'B']],
        ['q-e', 'x'.repeat(ANSWER_VALUE_MAX + 5)],
      ]),
    );
    expect(values['Company']).toBe('Acme');
    expect(values['Picks']).toBe('A, B');
    expect(values['Notes']).toHaveLength(ANSWER_VALUE_MAX);
    // A blank wording reads as any untitled question's.
    expect(Object.keys(values)).toEqual(['Company', 'Picks', 'Untitled Question', 'Notes']);
    expect(answerValues(f, { 'q-a': 'Plain' })['Company']).toBe('Plain');
    expect(answerValues(f, {})['Company']).toBe('');
  });
});
