import { describe, expect, it } from 'vitest';
import type { CustomFieldDef, ItemTypeDef } from '@liveplanner/items';
import type { AnswerValue } from './answers';
import { responseCard } from './card';
import { brokenFixed, fixedCardFields, fixedFieldsOf } from './fixed';
import { MAPPABLE_KINDS, fieldChoices, fieldTakes, newFieldFor } from './mapping';
import type { FormDefinition, FormQuestion } from './model';
import { questionFromField, typeQuestionFields } from './type-questions';

// docs/specs/026-plan/item-types.md "Risk": a form asks a Risk field as a Choice question of the four levels, in
// order, and keeps the answer as its level's id.
const RISK: CustomFieldDef = { id: 'f-risk', label: 'Risk', kind: 'risk' };
const TYPE: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  glyph: 'bug',
  color: '#dc2626',
  fields: ['title', 'status', 'description', 'f-risk'],
  custom: [RISK],
};
const single = (options: string[], extra: Partial<FormQuestion> = {}): FormQuestion => ({
  id: 'q',
  type: 'single',
  prompt: 'Risk',
  options,
  ...extra,
});
const form = (questions: FormQuestion[]): FormDefinition => ({
  v: 1,
  heading: 'Report',
  sections: [{ id: 's', title: '', questions }],
  destination: { tabId: 'board', typeId: 'bug', status: 'new~1' },
});

describe('a Risk field as a question', () => {
  it('is asked as a Choice of the four levels, in order', () => {
    const fields = typeQuestionFields(TYPE);
    expect(fields.at(-1)).toEqual({ kind: 'field', field: RISK });
    expect(questionFromField({ kind: 'field', field: RISK }, TYPE, 'q1')).toEqual({
      id: 'q1',
      type: 'single',
      prompt: 'Risk',
      goesTo: { to: 'field', fieldId: 'f-risk' },
      options: ['Critical', 'High', 'Medium', 'Low'],
    });
  });

  it('takes a single question whose every option names a level, never one with Other', () => {
    expect(MAPPABLE_KINDS.single).toEqual(['choice', 'text', 'risk']);
    expect(fieldTakes(single(['high', 'Low']), RISK)).toBe(true);
    expect(fieldTakes(single(['High', 'Severe']), RISK)).toBe(false);
    expect(fieldTakes(single(['High'], { other: true }), RISK)).toBe(false);
    // A question with no options yet offers nothing a level could not hold (publishing asks for options).
    expect(fieldTakes({ id: 'q', type: 'single', prompt: 'Risk' }, RISK)).toBe(true);
    expect(fieldTakes({ ...single([]), type: 'multi', options: ['High'] }, RISK)).toBe(false);
    expect(fieldChoices(form([single(['High'])]), single(['High']), TYPE)).toEqual([
      { field: RISK },
    ]);
    // A choice with Other still falls back to a text field.
    expect(newFieldFor(single(['a'], { other: true }), 'f-x', 'X').kind).toBe('text');
  });

  it("keeps the answer as its level's id", () => {
    const q = single(['Critical', 'High', 'Medium', 'Low'], {
      goesTo: { to: 'field', fieldId: 'f-risk' },
    });
    const answers = new Map<string, AnswerValue>([['q', 'High']]);
    expect(responseCard(form([q]), 'tab', answers, TYPE, 1).fields['f-risk']).toBe('high');
  });
});

describe('a Risk set automatically', () => {
  it('is offered with the four levels as its options', () => {
    expect(fixedFieldsOf(TYPE)).toEqual([
      { id: 'f-risk', label: 'Risk', kind: 'risk', options: ['Critical', 'High', 'Medium', 'Low'] },
    ]);
  });

  it("puts a level on every card as its id, and a value naming none doesn't resolve", () => {
    expect(fixedCardFields({ 'f-risk': { value: 'High' } }, TYPE, 0)).toEqual({ 'f-risk': 'high' });
    expect(fixedCardFields({ 'f-risk': { value: 'low' } }, TYPE, 0)).toEqual({ 'f-risk': 'low' });
    expect(brokenFixed({ 'f-risk': { value: 'Severe' } }, TYPE)).toEqual(['f-risk']);
    expect(brokenFixed({ 'f-risk': { submitted: { days: 0 } } }, TYPE)).toEqual(['f-risk']);
  });
});
