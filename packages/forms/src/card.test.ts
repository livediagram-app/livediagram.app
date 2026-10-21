import { describe, expect, it } from 'vitest';
import { ITEM_DESCRIPTION_MAX, normaliseRichRuns, type ItemTypeDef } from '@liveplanner/items';
import {
  FROM_FORM_FIELD,
  answerText,
  fromFormValue,
  numberedTitle,
  readFromForm,
  responseCard,
} from './card';
import type { AnswerValue } from './answers';
import type { FormDefinition, FormQuestion } from './model';

const type: ItemTypeDef = {
  id: 'guest',
  label: 'Guest',
  newTitle: 'New guest',
  glyph: 'star',
  color: '#2563eb',
  fields: [
    'title',
    'status',
    'description',
    'f-email',
    'f-price',
    'f-notes',
    'f-diet',
    'f-score',
    'f-pick',
  ],
  custom: [
    { id: 'f-email', label: 'Email', kind: 'email' },
    { id: 'f-price', label: 'Price', kind: 'currency' },
    { id: 'f-notes', label: 'Notes', kind: 'longtext' },
    { id: 'f-diet', label: 'Diet', kind: 'multichoice', options: ['Vegan', 'Halal'] },
    { id: 'f-score', label: 'Score', kind: 'rating', scale: 10 },
    { id: 'f-pick', label: 'Pick', kind: 'text' },
  ],
};

const Q = (
  id: string,
  t: FormQuestion['type'],
  extra: Partial<FormQuestion> = {},
): FormQuestion => ({
  id,
  type: t,
  prompt: id.toUpperCase(),
  ...extra,
});

const form = (questions: FormQuestion[]): FormDefinition => ({
  v: 1,
  heading: 'RSVP',
  sections: [{ id: 's', title: '', questions }],
  destination: { tabId: 'board', typeId: 'guest', status: 'new~1' },
});

const answers = (o: Record<string, AnswerValue>) => new Map(Object.entries(o));

describe('responseCard', () => {
  it('numbers the title when nothing goes to Title, and files it in the status', () => {
    const card = responseCard(form([Q('a', 'short')]), 'tab-f', answers({}), type, 14);
    expect(card).toEqual({
      type: 'guest',
      fields: { title: 'RSVP #14', status: 'new~1', [FROM_FORM_FIELD]: 'tab-f:14' },
    });
  });

  it('puts mapped answers in their fields, converted to each kind', () => {
    const f = form([
      Q('name', 'short', { goesTo: { to: 'title' } }),
      Q('mail', 'email', { goesTo: { to: 'field', fieldId: 'f-email' } }),
      Q('price', 'number', { goesTo: { to: 'field', fieldId: 'f-price' } }),
      Q('diet', 'multi', {
        options: ['Vegan', 'Halal'],
        goesTo: { to: 'field', fieldId: 'f-notes' },
      }),
      Q('long', 'short', { goesTo: { to: 'field', fieldId: 'f-notes' } }),
      Q('diet2', 'multi', { options: ['Vegan'], goesTo: { to: 'field', fieldId: 'f-diet' } }),
      Q('score', 'rating', { goesTo: { to: 'field', fieldId: 'f-score' } }),
      Q('pick', 'single', { options: ['A'], goesTo: { to: 'field', fieldId: 'f-pick' } }),
    ]);
    const card = responseCard(
      f,
      'tab-f',
      answers({
        name: 'Ada',
        mail: 'ada@x.io',
        price: 12.345,
        diet: ['Vegan', 'Halal'],
        diet2: ['Vegan'],
        long: 'Hello',
        score: 4,
        pick: 'A',
      }),
      type,
      1,
    );
    expect(card.fields).toMatchObject({
      title: 'Ada',
      'f-email': 'ada@x.io',
      'f-price': 12.35,
      'f-notes': 'Hello',
      'f-diet': ['Vegan'],
      'f-score': 4,
      'f-pick': 'A',
    });
    expect(card.fields).not.toHaveProperty('description');
  });

  it('writes the rest into Description under their prompts, bold in its formatting', () => {
    const f = form([
      Q('a', 'paragraph', { prompt: 'What happened?' }),
      Q('b', 'checkbox', { prompt: 'Agree' }),
      Q('c', 'rating', { prompt: 'Score', goesTo: { to: 'field', fieldId: 'f-gone' } }),
      Q('d', 'short', { prompt: '' }),
    ]);
    const card = responseCard(f, 't', answers({ a: 'It broke', b: true, c: 3 }), type, 2);
    expect(card.fields['description']).toBe(
      'What happened?\nIt broke\n\nAgree\nYes\n\nScore\n3 / 5',
    );
    const runs = card.fields['descriptionRich'];
    expect(normaliseRichRuns(runs)).toEqual(runs);
    expect(
      (runs as { text: string; bold?: boolean }[]).filter((r) => r.bold).map((r) => r.text),
    ).toEqual(['What happened?', 'Agree', 'Score']);
  });

  it('cuts a Description too long to keep, without its formatting', () => {
    const long = 'x'.repeat(2000);
    const qs = Array.from({ length: 6 }, (_, i) => Q(`q${i}`, 'paragraph'));
    const card = responseCard(
      form(qs),
      't',
      answers(Object.fromEntries(qs.map((q) => [q.id, long]))),
      type,
      1,
    );
    expect((card.fields['description'] as string).length).toBe(ITEM_DESCRIPTION_MAX);
    expect(card.fields['description'] as string).toMatch(/…$/);
    expect(card.fields).not.toHaveProperty('descriptionRich');
  });

  it('leaves the status out without a destination, and falls back from a blank title', () => {
    const f = { ...form([Q('n', 'short', { goesTo: { to: 'title' } })]), destination: undefined };
    const card = responseCard(f, 't', answers({ n: '   ' }), type, 3);
    expect(card.fields['title']).toBe('RSVP #3');
    expect(card.fields).not.toHaveProperty('status');
  });

  it('titles a Preview’s card "Preview: …", a response only when it takes a number', () => {
    const f = form([Q('n', 'short', { goesTo: { to: 'title' } }), Q('a', 'paragraph')]);
    const named = responseCard(f, 't', answers({ n: 'Ada', a: 'Hi' }), type, null, true);
    expect(named.fields['title']).toBe('Preview: Ada');
    expect(named.fields['status']).toBe('new~1');
    expect(named.fields['description']).toBe('A\nHi');
    expect(named.fields).not.toHaveProperty(FROM_FORM_FIELD);
    const counted = responseCard(f, 't', answers({}), type, 7, true);
    expect(counted.fields['title']).toBe('Preview: RSVP');
    // A preview of a published form is a counted response: it takes its number.
    expect(counted.fields[FROM_FORM_FIELD]).toBe('t:7');
    // A card with no number is named after the form alone.
    expect(responseCard(f, 't', answers({}), type, null).fields['title']).toBe('RSVP');
  });
});

describe('helpers', () => {
  it('answerText', () => {
    expect(answerText(Q('a', 'multi'), ['A', 'B'])).toBe('A, B');
    expect(answerText(Q('a', 'checkbox'), false)).toBe('No');
    expect(answerText(Q('a', 'rating', { scale: 10 }), 7)).toBe('7 / 10');
    expect(answerText(Q('a', 'number'), 3)).toBe('3');
  });

  it('numberedTitle', () => {
    expect(numberedTitle('Bug Report', 14)).toBe('Bug Report #14');
  });

  it('reads the From Form field back', () => {
    expect(readFromForm(fromFormValue('tab:1', 9))).toEqual({ tabId: 'tab:1', number: 9 });
    expect(readFromForm('x')).toBeNull();
    expect(readFromForm(':4')).toBeNull();
    expect(readFromForm('t:0')).toBeNull();
    expect(readFromForm(4)).toBeNull();
  });
});
