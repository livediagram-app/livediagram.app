import { describe, expect, it } from 'vitest';
import type { CustomFieldDef, ItemTypeDef } from '@livedesign/items';
import {
  MAPPABLE_KINDS,
  NEW_FIELD_KIND,
  canGoToTitle,
  effectiveTarget,
  fieldChoices,
  fieldTakes,
  newFieldFor,
  titleTakenBy,
} from './mapping';
import { QUESTION_TYPES, type FormQuestion } from './model';

const Q = (type: FormQuestion['type'], extra: Partial<FormQuestion> = {}): FormQuestion => ({
  id: 'q-1',
  type,
  prompt: 'P',
  ...extra,
});

const SEV: CustomFieldDef = {
  id: 'f-sev',
  label: 'Severity',
  kind: 'choice',
  options: ['Low', 'High'],
};
const NOTE: CustomFieldDef = { id: 'f-note', label: 'Note', kind: 'text' };
const SCORE: CustomFieldDef = { id: 'f-score', label: 'Score', kind: 'rating' };
const HIDDEN: CustomFieldDef = { id: 'f-hidden', label: 'Hidden', kind: 'text' };
const type: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  glyph: 'bug',
  color: '#dc2626',
  fields: ['title', 'status', 'f-sev', 'f-note', 'f-score'],
  custom: [SEV, NOTE, SCORE, HIDDEN],
};

describe('the mapping table', () => {
  it('names a new field kind each type may map to', () => {
    for (const t of QUESTION_TYPES) expect(MAPPABLE_KINDS[t]).toContain(NEW_FIELD_KIND[t]);
  });

  it('lets only some types be the title', () => {
    expect(canGoToTitle(Q('short'))).toBe(true);
    expect(canGoToTitle(Q('paragraph'))).toBe(false);
  });
});

describe('fieldTakes', () => {
  it('matches kinds', () => {
    expect(fieldTakes(Q('short'), NOTE)).toBe(true);
    expect(fieldTakes(Q('date'), NOTE)).toBe(false);
  });

  it('needs every option on a choice field, and no Other', () => {
    expect(fieldTakes(Q('single', { options: ['low', 'High'] }), SEV)).toBe(true);
    expect(fieldTakes(Q('single', { options: ['Low', 'Mid'] }), SEV)).toBe(false);
    expect(fieldTakes(Q('single', { options: ['Low'], other: true }), SEV)).toBe(false);
    expect(fieldTakes(Q('single'), { ...SEV, options: undefined })).toBe(true);
  });

  it('needs a rating scale at least the question’s', () => {
    expect(fieldTakes(Q('rating'), SCORE)).toBe(true);
    expect(fieldTakes(Q('rating', { scale: 10 }), SCORE)).toBe(false);
    expect(fieldTakes(Q('rating', { scale: 10 }), { ...SCORE, scale: 10 })).toBe(true);
  });
});

describe('effectiveTarget', () => {
  it('reads absent and Description as Description', () => {
    expect(effectiveTarget(Q('short'), type)).toEqual({ to: 'description' });
    expect(effectiveTarget(Q('short', { goesTo: { to: 'description' } }), type)).toEqual({
      to: 'description',
    });
  });

  it('keeps Title for a type that may take it', () => {
    expect(effectiveTarget(Q('short', { goesTo: { to: 'title' } }), type)).toEqual({ to: 'title' });
    expect(effectiveTarget(Q('paragraph', { goesTo: { to: 'title' } }), type)).toEqual({
      to: 'description',
      broken: true,
    });
  });

  it('resolves a field, and falls back when it is gone, hidden or no longer fits', () => {
    expect(
      effectiveTarget(Q('short', { goesTo: { to: 'field', fieldId: 'f-note' } }), type),
    ).toEqual({
      to: 'field',
      fieldId: 'f-note',
      field: NOTE,
    });
    for (const fieldId of ['f-gone', 'f-hidden', 'f-sev'])
      expect(effectiveTarget(Q('short', { goesTo: { to: 'field', fieldId } }), type)).toEqual({
        to: 'description',
        broken: true,
      });
    expect(
      effectiveTarget(Q('short', { goesTo: { to: 'field', fieldId: 'f-note' } }), undefined),
    ).toEqual({
      to: 'description',
      broken: true,
    });
  });
});

describe('choosing a field', () => {
  const form = {
    sections: [
      {
        id: 's',
        title: '',
        questions: [
          Q('short', { id: 'q-1' }),
          Q('short', { id: 'q-2', goesTo: { to: 'field', fieldId: 'f-note' } }),
          Q('short', { id: 'q-3', goesTo: { to: 'title' } }),
        ],
      },
    ],
  };

  it('lists the fields that fit, with the question using each', () => {
    const q1 = form.sections[0]!.questions[0]!;
    expect(fieldChoices(form, q1, type)).toEqual([
      { field: NOTE, takenBy: form.sections[0]!.questions[1] },
    ]);
    expect(fieldChoices(form, form.sections[0]!.questions[1]!, type)).toEqual([{ field: NOTE }]);
    expect(fieldChoices(form, q1, undefined)).toEqual([]);
  });

  it('names the question holding Title', () => {
    expect(titleTakenBy(form)?.id).toBe('q-3');
    expect(titleTakenBy(form, form.sections[0]!.questions[2])).toBeUndefined();
  });
});

describe('newFieldFor', () => {
  it('makes a field of the question’s kind, with its options or scale', () => {
    expect(newFieldFor(Q('short'), 'f-a', 'A')).toEqual({ id: 'f-a', label: 'A', kind: 'text' });
    expect(newFieldFor(Q('multi', { options: ['X'] }), 'f-a', 'A')).toEqual({
      id: 'f-a',
      label: 'A',
      kind: 'multichoice',
      options: ['X'],
    });
    expect(newFieldFor(Q('single'), 'f-a', 'A').options).toEqual([]);
    expect(newFieldFor(Q('rating', { scale: 10 }), 'f-a', 'A').scale).toBe(10);
    expect(newFieldFor(Q('rating'), 'f-a', 'A')).not.toHaveProperty('scale');
  });

  it('gives a choice with Other a text field, as no choice field takes an Other answer', () => {
    const opts: Partial<FormQuestion> = { options: ['X', 'Y'], other: true };
    expect(newFieldFor(Q('single', opts), 'f-a', 'A')).toEqual({
      id: 'f-a',
      label: 'A',
      kind: 'text',
    });
    expect(newFieldFor(Q('multi', opts), 'f-a', 'A')).toEqual({
      id: 'f-a',
      label: 'A',
      kind: 'longtext',
    });
  });

  // The field New Field makes is mapped at once, so it must never read as broken (the amber chip).
  it.each(
    QUESTION_TYPES.flatMap((t): [FormQuestion['type'], Partial<FormQuestion>][] => [
      [t, {}],
      [t, { options: ['X', 'Y'], other: true, scale: 10 }],
    ]),
  )('makes a field a %s question takes (%o)', (type, extra) => {
    const q = Q(type, extra);
    expect(fieldTakes(q, newFieldFor(q, 'f-a', 'A'))).toBe(true);
  });
});
