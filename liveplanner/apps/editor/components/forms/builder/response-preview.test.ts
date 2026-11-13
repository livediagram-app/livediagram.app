import { describe, expect, it } from 'vitest';
import {
  QUESTION_TYPES,
  checkAnswer,
  responseCard,
  type FormDefinition,
  type FormQuestion,
} from '@liveplanner/forms';
import type { ItemTypeDef } from '@liveplanner/items';
import {
  SAMPLE_EMAIL,
  SAMPLE_PARAGRAPH,
  SAMPLE_SHORT,
  previewCard,
  previewSheetRow,
  sampleAnswer,
  sampleAnswers,
} from './response-preview';

const NOW = new Date(2026, 10, 13, 10, 0);

const Q = (
  id: string,
  t: FormQuestion['type'],
  extra: Partial<FormQuestion> = {},
): FormQuestion => ({
  id,
  type: t,
  prompt: id,
  ...extra,
});

const type: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  glyph: 'star',
  color: '#2563eb',
  fields: ['title', 'status', 'description', 'priority', 'f-sev', 'f-email'],
  custom: [
    { id: 'f-sev', label: 'Severity', kind: 'choice', options: ['Low', 'High'] },
    { id: 'f-email', label: 'Reporter', kind: 'email' },
  ],
};

const form = (questions: FormQuestion[], extra: Partial<FormDefinition> = {}): FormDefinition => ({
  v: 1,
  heading: 'Bug Report',
  sections: [{ id: 's', title: '', questions }],
  destination: { tabId: 'board', typeId: 'bug', status: 'new' },
  ...extra,
});

describe('sampleAnswer', () => {
  it('answers by type, options and scale', () => {
    expect(sampleAnswer(Q('Rate it', 'rating'), NOW)).toBe(4);
    expect(sampleAnswer(Q('Rate it', 'rating', { scale: 10 }), NOW)).toBe(8);
    expect(sampleAnswer(Q('Pick', 'single', { options: ['Red', 'Blue'] }), NOW)).toBe('Red');
    expect(sampleAnswer(Q('Picks', 'multi', { options: ['A', 'B', 'C'] }), NOW)).toEqual([
      'A',
      'B',
    ]);
    expect(sampleAnswer(Q('Picks', 'multi', { options: ['A', 'B'], max: 1 }), NOW)).toEqual(['A']);
    expect(sampleAnswer(Q('Email', 'email'), NOW)).toBe(SAMPLE_EMAIL);
    expect(sampleAnswer(Q('When', 'date'), NOW)).toBe('2026-11-20');
    expect(sampleAnswer(Q('Range', 'daterange'), NOW)).toEqual(['2026-11-20', '2026-11-22']);
    expect(sampleAnswer(Q('Agree', 'checkbox'), NOW)).toBe(true);
    expect(sampleAnswer(Q('Tell us', 'paragraph'), NOW)).toBe(SAMPLE_PARAGRAPH);
  });

  it('keeps a number inside its bounds', () => {
    expect(sampleAnswer(Q('n', 'number'), NOW)).toBe(3);
    expect(sampleAnswer(Q('n', 'number', { min: 10 }), NOW)).toBe(10);
    expect(sampleAnswer(Q('n', 'number', { max: 1 }), NOW)).toBe(1);
  });

  it('reads a Short Answer from its wording, else a generic one', () => {
    expect(sampleAnswer(Q('Your name', 'short'), NOW)).toBe('Ana Silva');
    expect(sampleAnswer(Q('Summary of the bug', 'short'), NOW)).toBe('Export button does nothing');
    expect(sampleAnswer(Q('Anything else?', 'short'), NOW)).toBe(SAMPLE_SHORT);
  });

  it('gives every type an answer its own checks take', () => {
    for (const t of QUESTION_TYPES) {
      const q = Q('What', t, t === 'single' || t === 'multi' ? { options: ['A', 'B'] } : {});
      expect(checkAnswer(q, sampleAnswer(q, NOW)).error, t).toBeUndefined();
    }
    const timed = Q('When', 'daterange', { withTime: true });
    expect(checkAnswer(timed, sampleAnswer(timed, NOW)).error).toBeUndefined();
  });
});

describe('previewCard', () => {
  const questions = [
    Q('Summary', 'short', { goesTo: { to: 'title' } }),
    Q('Severity', 'single', {
      options: ['High', 'Low'],
      goesTo: { to: 'field', fieldId: 'f-sev' },
    }),
    Q('Steps', 'paragraph'),
    Q('How bad', 'rating'),
  ];

  it('is the card responseCard makes from the sample answers', () => {
    const f = form(questions);
    const made = responseCard(f, 'form', sampleAnswers(f, NOW), type, 1, false, NOW.getTime());
    expect(previewCard(f, 'form', type, NOW).item.fields).toEqual(made.fields);
  });

  it('puts a mapped answer in its field and an unmapped one under Description', () => {
    const p = previewCard(form(questions), 'form', type, NOW);
    expect(p.item.fields['title']).toBe('Export button does nothing');
    expect(p.item.fields['f-sev']).toBe('High');
    expect(p.lines).toEqual([
      { label: 'Title', value: 'Export button does nothing', questionId: 'Summary' },
      { label: 'Severity', value: 'High', questionId: 'Severity' },
    ]);
    expect(p.description).toEqual([
      { questionId: 'Steps', prompt: 'Steps', answer: SAMPLE_PARAGRAPH },
      { questionId: 'How bad', prompt: 'How bad', answer: '4 / 5' },
    ]);
    expect(p.item.fields['description']).toBe(`Steps\n${SAMPLE_PARAGRAPH}\n\nHow bad\n4 / 5`);
  });

  it('titles a card with no Title question by the form and its number, and lists set values', () => {
    const f = form([Q('Steps', 'paragraph')], {
      destination: {
        tabId: 'board',
        typeId: 'bug',
        status: 'new',
        fixed: { priority: { value: 'high' } },
      },
    });
    const p = previewCard(f, 'form', type, NOW);
    expect(p.lines[0]).toEqual({ label: 'Title', value: 'Bug Report #1', questionId: undefined });
    expect(p.lines).toContainEqual({ label: 'Priority', value: 'High' });
  });
});

describe('previewCard for a card type rule', () => {
  // forms.md "Choosing the card type by an answer": the rule's answer is picked, its type made, its fields mapped.
  it('answers the rule’s question with its answer and maps by the rule on its type', () => {
    const f = form([
      Q('q-kind', 'single', { options: ['Task', 'Bug'] }),
      Q('q-who', 'email'),
      Q('q-c', 'checkbox'),
      Q('q-m', 'multi', { options: ['A', 'B'] }),
    ]);
    const rule = {
      id: 'r-1',
      questionId: 'q-kind',
      anyOf: ['Bug'],
      typeId: 'bug',
      status: 'triage',
      fields: { 'q-who': 'f-email' },
    };
    const p = previewCard(f, 'form', type, NOW, rule);
    expect(p.item.fields).toMatchObject({ status: 'triage', 'f-email': 'ana@example.com' });
    expect(p.lines).toContainEqual({
      label: 'Reporter',
      value: 'ana@example.com',
      questionId: 'q-who',
    });
    expect(p.description.find((d) => d.questionId === 'q-kind')?.answer).toBe('Bug');
    // A Checkbox rule's Not Ticked is an unticked box; a Multiple Choice rule its one pick.
    const unticked = previewCard(f, 'form', type, NOW, {
      ...rule,
      questionId: 'q-c',
      anyOf: ['Not Ticked'],
    });
    expect(unticked.description.find((d) => d.questionId === 'q-c')?.answer).toBe('No');
    const picked = previewCard(f, 'form', type, NOW, { ...rule, questionId: 'q-m', anyOf: ['B'] });
    expect(picked.description.find((d) => d.questionId === 'q-m')?.answer).toBe('B');
    // A rule whose question went still previews its type.
    expect(previewCard(f, 'form', type, NOW, { ...rule, questionId: 'q-gone' }).item.type).toBe(
      'bug',
    );
  });
});

describe('previewSheetRow', () => {
  it('is the row responseRowWrite adds: #, Submitted, then a column per question', () => {
    const row = previewSheetRow(
      form([
        Q('Name', 'short'),
        Q('Score', 'rating'),
        Q('Likes', 'multi', { options: ['A', 'B'] }),
      ]),
      NOW,
    );
    expect(row.map((c) => c.header)).toEqual(['#', 'Submitted', 'Name', 'Score', 'Likes']);
    expect(row[0]!.value).toBe('1');
    expect(row.slice(2)).toEqual([
      { header: 'Name', value: 'Ana Silva', questionId: 'Name' },
      { header: 'Score', value: '4', questionId: 'Score' },
      { header: 'Likes', value: 'A, B', questionId: 'Likes' },
    ]);
  });
});
