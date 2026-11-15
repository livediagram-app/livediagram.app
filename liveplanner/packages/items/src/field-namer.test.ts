import { describe, expect, it } from 'vitest';
import { fieldNamer } from './field-namer';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';

// docs/specs/026-plan/items.md "Limits": a refused field is named as the card shows it (Work Tracker 944).

const PITCH: ItemTypeDef = {
  ...ITEM_TYPES[1],
  id: 'pitch',
  label: 'Pitch',
  fields: ['title', 'status', 'description', 'f-solution'],
  fieldLabels: { description: 'Problem' },
  custom: [{ id: 'f-solution', label: 'Solution', kind: 'longtext' }],
};
const RISK: ItemTypeDef = {
  ...ITEM_TYPES[1],
  id: 'risk',
  label: 'Risk',
  custom: [{ id: 'f-impact', label: 'Impact', kind: 'text' }],
};

describe('fieldNamer', () => {
  it('names a field as the change’s card shows it', () => {
    const name = fieldNamer([PITCH, RISK], () => PITCH);
    expect(name('f-solution')).toBe('Solution');
    expect(name('f-solutionRich')).toBe('Solution');
    // A field another type holds, and a built-in as the type renames it, else its own name.
    expect(name('f-impact')).toBe('Impact');
    expect(name('description')).toBe('Problem');
    expect(name('descriptionRich')).toBe('Problem');
    expect(name('checklist')).toBe('Checklist');
    expect(name('f-gone')).toBe('f-gone');
    expect(fieldNamer([PITCH], () => undefined)('description')).toBe('Description');
  });
});
