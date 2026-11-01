import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { CustomFieldDef, ItemTypeDef } from './item-types';
import {
  ITEM_TYPES_MAX,
  ITEM_TYPE_CATALOGUE_VERSION,
  ITEM_TYPE_CUSTOM_MAX,
  validateItemTypeCatalogue,
} from './type-catalogue';
import { withInheritance } from './type-inheritance';

// docs/specs/026-plan/blueprints/item-types.md "Inherited types" (Performance): resolving runs where a catalogue is
// validated, rebased or edited, never where a type is read, and a list resolved once answers from its memo. Budgets
// are CPU time, far above what was measured.

const BUILT_INS = [
  'description',
  'assignee',
  'priority',
  'labels',
  'estimate',
  'start',
  'due',
  'checklist',
];

// A type at the field caps: Title, Status, 8 built-in fields, `custom` custom fields.
function type(id: string, custom: number, inherits?: string): ItemTypeDef {
  const defs: CustomFieldDef[] = Array.from({ length: custom }, (_, i) => ({
    id: `f-${id}-${i}`,
    label: `F${i}`,
    kind: 'text',
  }));
  return {
    id,
    label: id,
    newTitle: `New ${id}`,
    glyph: 'task',
    color: '#71717a',
    fields: ['title', 'status', ...BUILT_INS, ...defs.map((d) => d.id)],
    custom: defs,
    ...(inherits ? { inherits } : {}),
  };
}

// The catalogue's most types: 4 bases with 6 custom fields, each with 7 types inheriting from it and adding 6 more.
const FULL: ItemTypeDef[] = [];
for (let b = 0; b < 4; b += 1) {
  FULL.push(type(`base-${b}`, ITEM_TYPE_CUSTOM_MAX / 2));
  for (let c = 0; c < ITEM_TYPES_MAX / 4 - 1; c += 1)
    FULL.push(type(`child-${b}-${c}`, ITEM_TYPE_CUSTOM_MAX / 2, `base-${b}`));
}

describe('inherited types at the limits', () => {
  it('resolves a full catalogue of 32 types, 28 of them inheriting, well inside a frame', () => {
    expect(FULL).toHaveLength(ITEM_TYPES_MAX);
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 20; i += 1) withInheritance([...FULL]);
    });
    const out = withInheritance([...FULL]);
    expect(out[1]!.fields).toHaveLength(2 + BUILT_INS.length + ITEM_TYPE_CUSTOM_MAX);
    // 20 resolutions; measured about 10 ms CPU for all 20 (0.5 ms each).
    expect(ms).toBeLessThan(cpuBudgetMs(100));
  });

  it('answers a resolved list from its memo', () => {
    const once = withInheritance([...FULL]);
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 10_000; i += 1) withInheritance(once);
    });
    expect(withInheritance(once)).toBe(once);
    expect(ms).toBeLessThan(cpuBudgetMs(50));
  });

  it('validates a catalogue with inherited types about as fast as one without', () => {
    const small: ItemTypeDef[] = FULL.slice(0, 16).map((t) => {
      const custom = t.custom!.slice(0, 2);
      return {
        ...t,
        custom,
        fields: ['title', 'status', ...BUILT_INS.slice(0, 2), ...custom.map((c) => c.id)],
      };
    });
    const plain = small.map(({ inherits: _, ...t }) => t);
    const check = (types: readonly ItemTypeDef[]) =>
      cpuMsOf(() => {
        for (let i = 0; i < 50; i += 1)
          expect(
            validateItemTypeCatalogue({ version: ITEM_TYPE_CATALOGUE_VERSION, types }).ok,
          ).toBe(true);
      });
    const withBases = check(small);
    const without = check(plain);
    // Measured about 24 ms and 10 ms CPU for 50 validations each (0.5 ms and 0.2 ms a save).
    expect(withBases).toBeLessThan(cpuBudgetMs(250));
    expect(without).toBeLessThan(cpuBudgetMs(250));
  });
});
