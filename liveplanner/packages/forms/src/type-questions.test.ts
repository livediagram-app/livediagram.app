import { describe, expect, it } from 'vitest';
import type { ItemTypeDef } from '@liveplanner/items';
import { effectiveTarget } from './mapping';
import { questionsOf, type FormDefinition, type FormQuestion } from './model';
import { typeQuestionFields, typeQuestionsToAdd, withTypeQuestions } from './type-questions';

// Questions from a card type's fields (docs/specs/030-forms/forms.md "Questions from the card type's fields").

const custom = [
  { id: 'f-text', label: 'Steps', kind: 'text' },
  { id: 'f-long', label: 'Details', kind: 'longtext' },
  { id: 'f-num', label: 'Count', kind: 'number' },
  { id: 'f-cost', label: 'Cost', kind: 'currency' },
  { id: 'f-mail', label: 'Email', kind: 'email', required: true },
  { id: 'f-tel', label: 'Phone', kind: 'phone' },
  { id: 'f-url', label: 'Page', kind: 'link' },
  { id: 'f-day', label: 'Seen On', kind: 'date' },
  { id: 'f-at', label: 'Seen At', kind: 'datetime' },
  { id: 'f-span', label: 'Away', kind: 'daterange' },
  { id: 'f-shift', label: 'Shift', kind: 'daterange', withTime: true },
  { id: 'f-sev', label: 'Severity', kind: 'choice', options: ['Low', 'High'] },
  { id: 'f-os', label: 'Systems', kind: 'multichoice', options: ['Mac', 'Windows'] },
  { id: 'f-stars', label: 'Mood', kind: 'rating', scale: 7 },
  { id: 'f-ok', label: 'Agreed', kind: 'checkbox' },
  // Left out: none a respondent can sensibly fill.
  { id: 'f-who', label: 'Owner', kind: 'person' },
  { id: 'f-tags', label: 'Tags', kind: 'labels' },
  { id: 'f-pr', label: 'Pull Request', kind: 'card' },
  { id: 'f-block', label: 'Blocked By', kind: 'card', blocks: true },
  { id: 'f-pics', label: 'Shots', kind: 'image' },
  { id: 'f-pct', label: 'Done', kind: 'percent' },
  { id: 'f-calc', label: 'Sum', kind: 'calculated' },
  // A kind from a newer liveplanner.
  { id: 'f-new', label: 'Future', kind: 'hologram' },
] as unknown as ItemTypeDef['custom'];

const workItem: ItemTypeDef = {
  id: 'work-item',
  label: 'Work Item',
  newTitle: 'New work item',
  glyph: 'task',
  color: '#2563eb',
  fields: ['title', 'status', 'assignee', 'description', ...custom!.map((f) => f.id)],
  fieldLabels: { title: 'Summary' },
  custom,
};

const form = (
  questions: FormQuestion[] = [],
  extra: Partial<FormDefinition> = {},
): FormDefinition => ({
  v: 1,
  heading: 'Work',
  sections: [{ id: 's-1', title: '', questions }],
  ...extra,
});

let n = 0;
const newId = () => `q-${String((n += 1)).padStart(6, '0')}`;

describe('typeQuestionFields', () => {
  it('lists Title, Description and the fillable custom fields, in order', () => {
    const ids = typeQuestionFields(workItem).map((f) => (f.kind === 'field' ? f.field.id : f.kind));
    expect(ids).toEqual([
      'title',
      'description',
      'f-text',
      'f-long',
      'f-num',
      'f-cost',
      'f-mail',
      'f-tel',
      'f-url',
      'f-day',
      'f-at',
      'f-span',
      'f-shift',
      'f-sev',
      'f-os',
      'f-stars',
      'f-ok',
    ]);
  });

  it('leaves Description out of a type without it', () => {
    const t = { ...workItem, fields: ['title'], custom: [] };
    expect(typeQuestionFields(t)).toEqual([{ kind: 'title' }]);
  });
});

describe('withTypeQuestions on an empty form', () => {
  const made = questionsOf(withTypeQuestions(form(), workItem, newId));
  const byPrompt = new Map(made.map((q) => [q.prompt, q]));

  it('makes each field its question kind, mapped to it', () => {
    expect(made.map((q) => [q.prompt, q.type])).toEqual([
      ['Summary', 'short'],
      ['Description', 'paragraph'],
      ['Steps', 'short'],
      ['Details', 'paragraph'],
      ['Count', 'number'],
      ['Cost', 'number'],
      ['Email', 'email'],
      ['Phone', 'phone'],
      ['Page', 'link'],
      ['Seen On', 'date'],
      ['Seen At', 'datetime'],
      ['Away', 'daterange'],
      ['Shift', 'daterange'],
      ['Severity', 'single'],
      ['Systems', 'multi'],
      ['Mood', 'rating'],
      ['Agreed', 'checkbox'],
    ]);
    // Each fits its field (fieldTakes), so none falls back to Description.
    for (const q of made) expect(effectiveTarget(q, workItem).broken).toBeUndefined();
    expect(byPrompt.get('Summary')?.goesTo).toEqual({ to: 'title' });
    expect(effectiveTarget(byPrompt.get('Description')!, workItem).to).toBe('description');
    expect(byPrompt.get('Steps')?.goesTo).toEqual({ to: 'field', fieldId: 'f-text' });
  });

  it('keeps options, scales, times and required', () => {
    expect(byPrompt.get('Severity')?.options).toEqual(['Low', 'High']);
    expect(byPrompt.get('Systems')?.options).toEqual(['Mac', 'Windows']);
    expect(byPrompt.get('Mood')).toMatchObject({ scale: 7, style: 'stars' });
    expect(byPrompt.get('Shift')?.withTime).toBe(true);
    expect(byPrompt.get('Away')?.withTime).toBeUndefined();
    expect(byPrompt.get('Email')?.required).toBe(true);
    expect(byPrompt.get('Steps')?.required).toBeUndefined();
  });

  it('makes ordinary questions with ids of their own', () => {
    expect(new Set(made.map((q) => q.id)).size).toBe(made.length);
  });
});

describe('typeQuestionsToAdd on a form with questions', () => {
  it('offers only the fields no question asks yet, nor one set automatically', () => {
    const asked = form(
      [
        { id: 'q-a', type: 'short', prompt: 'Name', goesTo: { to: 'title' } },
        { id: 'q-b', type: 'short', prompt: 'Steps', goesTo: { to: 'field', fieldId: 'f-text' } },
        { id: 'q-c', type: 'paragraph', prompt: 'Anything else' },
      ],
      {
        destination: {
          tabId: 't',
          typeId: 'work-item',
          status: 's',
          fixed: { 'f-sev': { value: 'Low' } },
        },
      },
    );
    const left = typeQuestionsToAdd(asked, workItem).map((f) =>
      f.kind === 'field' ? f.field.id : f.kind,
    );
    expect(left).not.toContain('title');
    expect(left).not.toContain('description');
    expect(left).not.toContain('f-text');
    expect(left).not.toContain('f-sev');
    expect(left).toContain('f-long');
    const added = withTypeQuestions(asked, workItem, newId);
    expect(questionsOf(added).slice(0, 3)).toEqual(asked.sections[0]!.questions);
    expect(questionsOf(added)).toHaveLength(3 + left.length);
  });

  it('adds to the last section, and nothing when every field is asked', () => {
    const two: FormDefinition = {
      ...form(),
      sections: [
        { id: 's-1', title: '', questions: [] },
        { id: 's-2', title: 'More', questions: [] },
      ],
    };
    const added = withTypeQuestions(two, workItem, newId);
    expect(added.sections[0]!.questions).toEqual([]);
    expect(added.sections[1]!.questions.length).toBeGreaterThan(0);
    expect(withTypeQuestions(added, workItem, newId)).toBe(added);
  });

  it('stops at the most questions a form holds', () => {
    const full = form(
      Array.from({ length: 99 }, (_, i) => ({
        id: `q-x${String(i).padStart(4, '0')}`,
        type: 'checkbox' as const,
        prompt: `Q${i}`,
      })),
    );
    expect(questionsOf(withTypeQuestions(full, workItem, newId))).toHaveLength(100);
    const brim = form(
      Array.from({ length: 101 }, (_, i) => ({
        id: `q-y${String(i).padStart(4, '0')}`,
        type: 'checkbox' as const,
        prompt: `Q${i}`,
      })),
    );
    expect(withTypeQuestions(brim, workItem, newId)).toBe(brim);
  });
});
