import { describe, expect, it } from 'vitest';
import {
  READY_MADE_CARD_TYPES,
  validateItemTypeCatalogue,
  type ItemTypeDef,
} from '@livediagram/items';
import { effectiveTarget } from './mapping';
import { STARTER_IDS, questionsOf } from './model';
import { readForm } from './read';
import { FORM_STARTERS, buildStarter, formStarter, starterBaseType } from './starters';
import { newFormPartId } from './ids';

let n = 0;
const newId = () => `x-${(n += 1)}`;

describe('the starters', () => {
  it('offers one of each starter, in the spec’s order', () => {
    expect(FORM_STARTERS.map((s) => s.id)).toEqual([...STARTER_IDS]);
    expect(formStarter('rsvp').name).toBe('Event RSVP');
    expect(formStarter('nope' as never).id).toBe('blank');
  });

  it.each(FORM_STARTERS.map((s) => [s.id, s] as const))(
    '%s builds a valid form whose every mapping resolves on its type',
    (_id, starter) => {
      const base = starterBaseType(starter, [], 'form-type');
      const { form, type } = buildStarter(starter, base, newId);
      expect(readForm(form)).toEqual(form);
      for (const q of questionsOf(form)) expect(effectiveTarget(q, type).broken).toBeUndefined();
      const check = validateItemTypeCatalogue({ version: 1, types: [type] });
      expect(check.ok).toBe(true);
    },
  );

  it('uses the ready-made type, the document’s own copy first', () => {
    const bug = FORM_STARTERS.find((s) => s.id === 'bug-report')!;
    expect(starterBaseType(bug, [], 'x')).toBe(READY_MADE_CARD_TYPES.find((t) => t.id === 'bug'));
    const own = { ...READY_MADE_CARD_TYPES.find((t) => t.id === 'bug')!, label: 'Defect' };
    expect(starterBaseType(bug, [own], 'x')).toBe(own);
  });

  it('makes a type named after the form otherwise', () => {
    const fb = starterBaseType(formStarter('feedback'), [], 'feedback');
    expect(fb).toMatchObject({
      id: 'feedback',
      label: 'Feedback',
      glyph: 'checklist',
      color: '#0d9488',
    });
    expect(starterBaseType(formStarter('blank'), [], 'response').label).toBe('Response');
  });

  it('reuses a field of the same name and kind, adding options it lacks', () => {
    const base: ItemTypeDef = {
      id: 'bug',
      label: 'Bug',
      newTitle: 'New bug',
      glyph: 'bug',
      color: '#dc2626',
      fields: ['title', 'status'],
      custom: [
        { id: 'f-severity', label: 'severity', kind: 'choice', options: ['Low', 'Blocker'] },
        { id: 'f-mail', label: 'Email', kind: 'email' },
      ],
    };
    const { form, type } = buildStarter(formStarter('bug-report'), base, newId);
    expect(type.custom).toEqual([
      {
        id: 'f-severity',
        label: 'severity',
        kind: 'choice',
        options: ['Low', 'Blocker', 'Medium', 'High', 'Critical'],
      },
      { id: 'f-mail', label: 'Email', kind: 'email' },
    ]);
    expect(type.fields).toEqual(['title', 'status', 'f-severity', 'f-mail']);
    expect(questionsOf(form).map((q) => q.goesTo)).toEqual([
      { to: 'title' },
      undefined,
      { to: 'field', fieldId: 'f-severity' },
      { to: 'field', fieldId: 'f-mail' },
    ]);
  });

  it('fills in a choice field stored without options, and falls back from an unknown ready type', () => {
    const base: ItemTypeDef = {
      ...starterBaseType(formStarter('rsvp'), [], 'rsvp'),
      custom: [{ id: 'f-attending', label: 'Attending', kind: 'choice' }],
    };
    const { type } = buildStarter(formStarter('rsvp'), base, newId);
    expect(type.custom?.[0]?.options).toEqual(['Yes', 'No', 'Maybe']);
    const odd = { ...formStarter('bug-report'), readyType: 'nope' as never };
    expect(starterBaseType(odd, [], 'odd').id).toBe('odd');
  });

  it('returns the same type when nothing is added', () => {
    const base = starterBaseType(formStarter('blank'), [], 'response');
    expect(buildStarter(formStarter('blank'), base, newId).type).toBe(base);
    const first = buildStarter(
      formStarter('feedback'),
      starterBaseType(formStarter('feedback'), [], 'f'),
      newId,
    ).type;
    expect(buildStarter(formStarter('feedback'), first, newId).type).toBe(first);
    const rsvp = buildStarter(
      formStarter('rsvp'),
      starterBaseType(formStarter('rsvp'), [], 'r'),
      newId,
    ).type;
    expect(buildStarter(formStarter('rsvp'), rsvp, newId).type).toBe(rsvp);
  });
});

describe('newFormPartId', () => {
  it('is a prefix and six base-36 characters', () => {
    expect(newFormPartId('q')).toMatch(/^q-[a-z0-9]{6}$/);
    expect(newFormPartId('s', () => 0)).toBe('s-000000');
  });
});
