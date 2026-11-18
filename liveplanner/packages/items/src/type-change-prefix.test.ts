// Card prefixes through an agent's card type changes and the catalogue check (docs/specs/026-plan/item-types.md "Card
// number prefixes"; plan-agents.md "Changing card types").
import { describe, expect, it } from 'vitest';
import { applyCardTypeChanges } from './type-changes';
import {
  ITEM_TYPE_CATALOGUE_VERSION,
  defaultCatalogue,
  readItemTypeCatalogue,
  validateItemTypeCatalogue,
  type ItemTypeCatalogue,
} from './type-catalogue';
import { prefixOf, prefixesOf } from './card-prefix';
import { duplicateItemType } from './type-duplicate';
import { resolveChild } from './type-inheritance';
import type { ItemTypeDef } from './item-types';

const statuses = [{ status: 'todo~a1', name: 'To Do' }];
// Project, Task, Note, Idea and Action, none storing a prefix: a plan from before prefixes.
const DEFAULTS = defaultCatalogue();

const ok = (r: ReturnType<typeof applyCardTypeChanges>) => {
  if (!r.ok) throw new Error(r.message);
  return r.catalogue!;
};
const refused = (r: ReturnType<typeof applyCardTypeChanges>) => {
  if (r.ok) throw new Error('expected a refusal');
  return r.message;
};
const prefixes = (c: ItemTypeCatalogue) => Object.fromEntries(prefixesOf(c.types));

describe('a plan from before prefixes', () => {
  it('reads every type’s prefix from its name, with no step', () => {
    expect(prefixes(DEFAULTS)).toEqual({
      project: 'P',
      task: 'T',
      note: 'N',
      idea: 'I',
      action: 'A',
    });
    expect(DEFAULTS.types.every((t) => t.prefix === undefined)).toBe(true);
  });
});

describe('applyCardTypeChanges: prefix', () => {
  it('stores a new type’s made prefix, stepping round the plan’s', () => {
    const c = ok(applyCardTypeChanges(DEFAULTS, [{ op: 'add', name: 'Theme' }], statuses));
    expect(c.types.at(-1)!.prefix).toBe('TH');
    expect(prefixOf(c.types, 'task')).toBe('T');
  });

  it('stores a prefix an agent gives, upper case', () => {
    const c = ok(
      applyCardTypeChanges(DEFAULTS, [{ op: 'add', name: 'Work Item', prefix: 'wi' }], statuses),
    );
    expect(c.types.at(-1)!.prefix).toBe('WI');
  });

  it('sets, changes and clears a type’s prefix', () => {
    const set = ok(
      applyCardTypeChanges(DEFAULTS, [{ op: 'set', type: 'Task', prefix: 'tk' }], statuses),
    );
    expect(prefixOf(set.types, 'task')).toBe('TK');
    const cleared = ok(
      applyCardTypeChanges(set, [{ op: 'set', type: 'Task', prefix: '' }], statuses),
    );
    expect(cleared.types.find((t) => t.id === 'task')!.prefix).toBeUndefined();
    expect(prefixOf(cleared.types, 'task')).toBe('T');
    const nulled = ok(
      applyCardTypeChanges(set, [{ op: 'set', type: 'Task', prefix: null }], statuses),
    );
    expect(prefixOf(nulled.types, 'task')).toBe('T');
  });

  it('refuses a prefix another type has, made or stored, naming it, and saves nothing', () => {
    expect(
      refused(applyCardTypeChanges(DEFAULTS, [{ op: 'set', type: 'Note', prefix: 't' }], statuses)),
    ).toBe("T is already Task's prefix. Pick another.");
    expect(
      refused(
        applyCardTypeChanges(DEFAULTS, [{ op: 'add', name: 'Topic', prefix: 'P' }], statuses),
      ),
    ).toBe("P is already Project's prefix. Pick another.");
  });

  it('refuses one that is not a prefix', () => {
    expect(
      refused(
        applyCardTypeChanges(DEFAULTS, [{ op: 'set', type: 'Task', prefix: '1x' }], statuses),
      ),
    ).toContain('1 to 6 letters and digits, starting with a letter');
    expect(
      refused(
        applyCardTypeChanges(DEFAULTS, [{ op: 'add', name: 'Bug', prefix: 'B-G' }], statuses),
      ),
    ).toContain('"B-G"');
  });

  it('keeps a type’s prefix when it is renamed', () => {
    const c = ok(
      applyCardTypeChanges(DEFAULTS, [{ op: 'set', type: 'Task', name: 'Chore' }], statuses),
    );
    expect(prefixOf(c.types, 'task')).toBe('T');
    expect(c.types.find((t) => t.id === 'task')!.prefix).toBe('T');
  });

  it('keeps every other type’s prefix when one is deleted', () => {
    const withTheme = ok(applyCardTypeChanges(DEFAULTS, [{ op: 'add', name: 'Theme' }], statuses));
    const c = ok(applyCardTypeChanges(withTheme, [{ op: 'delete', type: 'Task' }], statuses));
    expect(prefixOf(c.types, 'theme')).toBe('TH');
  });

  it('gives default types added later their own prefixes', () => {
    const c = ok(
      applyCardTypeChanges(
        { version: ITEM_TYPE_CATALOGUE_VERSION, types: [] },
        [{ op: 'add_default_types' }],
        statuses,
      ),
    );
    expect(c.types.map((t) => t.prefix)).toEqual(['P', 'T', 'N', 'I', 'A']);
  });
});

describe('validateItemTypeCatalogue: prefix', () => {
  const two = (a?: string, b?: string) => ({
    version: ITEM_TYPE_CATALOGUE_VERSION,
    types: [
      { ...DEFAULTS.types[0]!, ...(a !== undefined ? { prefix: a } : {}) },
      { ...DEFAULTS.types[1]!, ...(b !== undefined ? { prefix: b } : {}) },
    ],
  });

  it('stores a prefix upper case', () => {
    const r = validateItemTypeCatalogue(two('pr'), { newerFields: 'refuse' });
    expect(r.ok && r.catalogue.types[0]!.prefix).toBe('PR');
  });

  it('refuses two alike, or one that is not a prefix, on a write', () => {
    expect(validateItemTypeCatalogue(two('X', 'x'), { newerFields: 'refuse' })).toEqual({
      ok: false,
      reason: 'types[1].prefix',
    });
    expect(validateItemTypeCatalogue(two('bad-one'), { newerFields: 'refuse' })).toEqual({
      ok: false,
      reason: 'types[0].prefix',
    });
  });

  it('drops the later of two alike, and one that is not a prefix, on a read, so the plan opens', () => {
    const read = readItemTypeCatalogue(two('X', 'X'));
    expect(read!.types.map((t) => t.prefix)).toEqual(['X', undefined]);
    const bad = readItemTypeCatalogue(two('9'));
    expect(bad!.types[0]!.prefix).toBeUndefined();
  });

  it('keeps an inherited type’s own prefix, never its base’s', () => {
    const base: ItemTypeDef = { ...DEFAULTS.types[1]!, prefix: 'TK' };
    const child: ItemTypeDef = { ...DEFAULTS.types[2]!, prefix: 'NT', inherits: 'task' };
    expect(resolveChild(child, base).prefix).toBe('NT');
    const { prefix: _none, ...bare } = child;
    expect(resolveChild(bare, base).prefix).toBeUndefined();
  });
});

describe('duplicateItemType: prefix', () => {
  it('gives the copy its own made prefix', () => {
    const task: ItemTypeDef = { ...DEFAULTS.types[1]!, prefix: 'T' };
    const copy = duplicateItemType(task, [task]);
    expect(copy.label).toBe('Task copy');
    expect(copy.prefix).toBe('TC');
  });
});
