import { describe, expect, it } from 'vitest';
import { ruleSetsFields, setFieldRefusal } from './set-field-check';
import type { AutomationAction, AutomationStep } from './types';
import { BUG, ruleBody } from './test-fixtures';

// docs/specs/026-plan/automations.md "Actions": a Checkbox field is set to Yes or No, refused otherwise on save.
const TYPES = [
  {
    ...BUG,
    custom: [...BUG.custom!, { id: 'f-ok', label: 'Signed Off', kind: 'checkbox' as const }],
  },
];
const set = (value: object, field = 'f-ok') =>
  ({ kind: 'set_field', field, value }) as AutomationAction;
const refusal = (steps: AutomationStep[]) => setFieldRefusal(ruleBody({ steps }), TYPES);

describe('setFieldRefusal', () => {
  it('lets a Checkbox take Yes or No, a value filled in or another field', () => {
    expect(
      refusal([
        set({ text: 'true' }),
        set({ text: 'No' }),
        set({ text: '{{card.field.Signed Off}}' }),
        set({ from: 'f-ok' }),
        set({ text: 'anything' }, 'title'),
        set({ number: 3 }, 'f-points'),
        { kind: 'flag' },
      ]),
    ).toBeNull();
  });

  it('refuses other text, a number, a day or a list, naming the field and the step', () => {
    expect(refusal([{ kind: 'flag' }, set({ text: 'maybe' })])).toEqual({
      path: 'steps.1.value',
      message: 'Signed Off is a Checkbox: set it to Yes or No',
    });
    expect(
      refusal([
        { kind: 'if', conditions: [], then: [{ kind: 'flag' }], else: [set({ number: 1 })] },
      ]),
    ).toMatchObject({ path: 'steps.0.else.0.value' });
    expect(
      refusal([{ kind: 'if', conditions: [], then: [set({ list: ['x'] })], else: [] }]),
    ).toMatchObject({ path: 'steps.0.then.0.value' });
    expect(
      refusal([
        {
          kind: 'for',
          related: { kind: 'children' },
          conditions: [],
          then: [set({ date: { today: 0 } })],
        },
      ]),
    ).toMatchObject({ path: 'steps.0.then.0.value' });
    // Flagged is a Checkbox too, set by Flag and Unflag in the builder.
    expect(refusal([set({ text: 'red' }, 'flagged')])).toEqual({
      path: 'steps.0.value',
      message: 'Flagged is a Checkbox: set it to Yes or No',
    });
  });

  it('says whether a rule holds a Set Field, so its save reads the plan’s types', () => {
    expect(ruleSetsFields(ruleBody())).toBe(false);
    expect(
      ruleSetsFields(ruleBody({ steps: [{ kind: 'wait', hours: 1 }, set({ text: 'Yes' })] })),
    ).toBe(true);
  });
});
