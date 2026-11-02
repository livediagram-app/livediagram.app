import { describe, expect, it } from 'vitest';
import type { ItemTypeDef } from './item-types';
import {
  ITEM_TYPE_CATALOGUE_VERSION,
  ITEM_TYPE_CUSTOM_MAX,
  ITEM_TYPE_FIELDS_MAX,
  readItemTypeCatalogue,
  validateItemTypeCatalogue,
} from './type-catalogue';
import { rebaseCatalogueChange } from './type-catalogue-change';
import {
  INHERITED_PARTS,
  baseOf,
  basesFor,
  detachType,
  inheritFrom,
  inheritanceProblem,
  inheritedFieldIds,
  inheritingTypesOf,
  resolveChild,
  withInheritance,
} from './type-inheritance';

// docs/specs/026-plan/item-types.md "Inherited types".

const WORK: ItemTypeDef = {
  id: 'work',
  label: 'Work',
  newTitle: 'New work',
  glyph: 'task',
  color: '#71717a',
  fields: ['title', 'status', 'description', 'assignee', 'f-blocked-by', 'f-area'],
  custom: [
    {
      id: 'f-blocked-by',
      label: 'Blocked By',
      kind: 'card',
      linkType: 'work',
      multiple: true,
      blocks: true,
    },
    { id: 'f-area', label: 'Area', kind: 'choice', options: ['Web', 'API'], required: true },
  ],
  tabs: [{ id: 't-overview', label: 'Overview', fields: ['description'] }],
  detailsLabel: 'Facts',
  statuses: ['todo', 'doing', 'done'],
  defaultStatus: 'todo',
  display: { minimal: { trail: ['assignee'] } },
  assigneeNotifies: false,
};

// A Bug inheriting from Work, with a Severity of its own, as an editor writes it before it is resolved.
const BUG_DRAFT: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  glyph: 'bug',
  color: '#dc2626',
  fields: ['title', 'status', 'f-severity'],
  custom: [{ id: 'f-severity', label: 'Severity', kind: 'choice', options: ['S1', 'S2'] }],
  inherits: 'work',
};

const catalogue = (types: readonly unknown[]) => ({ version: ITEM_TYPE_CATALOGUE_VERSION, types });
const valid = (types: readonly unknown[]) => {
  const r = validateItemTypeCatalogue(catalogue(types));
  if (!r.ok) throw new Error(r.reason);
  return r.catalogue.types;
};
const reason = (types: readonly unknown[]) => {
  const r = validateItemTypeCatalogue(catalogue(types));
  return r.ok ? null : r.reason;
};

describe('resolving an inherited type', () => {
  it('takes the base type’s fields, custom fields with every setting, tabs, statuses, Default State and display', () => {
    const [, bug] = valid([WORK, BUG_DRAFT]);
    expect(bug).toEqual({
      id: 'bug',
      label: 'Bug',
      newTitle: 'New bug',
      glyph: 'bug',
      color: '#dc2626',
      fields: [...WORK.fields, 'f-severity'],
      custom: [...WORK.custom!, BUG_DRAFT.custom![0]],
      tabs: WORK.tabs,
      detailsLabel: 'Facts',
      statuses: WORK.statuses,
      defaultStatus: 'todo',
      display: WORK.display,
      assigneeNotifies: false,
      inherits: 'work',
      ownFields: ['f-severity'],
    });
    // The same ids, so a card's values carry over; Blocked By and Required come with the field.
    expect(bug!.custom!.find((c) => c.id === 'f-blocked-by')).toMatchObject({ blocks: true });
    expect(bug!.custom!.find((c) => c.id === 'f-area')).toMatchObject({ required: true });
  });

  it('reads back the same, so a stored inherited type is stable', () => {
    const once = valid([WORK, BUG_DRAFT]);
    expect(valid(once)).toEqual(once);
    expect(withInheritance(once)).toBe(withInheritance(once));
  });

  it('copies only the parts the base type has, and the base’s Card Colour field', () => {
    const plain: ItemTypeDef = {
      ...WORK,
      fields: [...WORK.fields, 'f-tint'],
      custom: [...WORK.custom!, { id: 'f-tint', label: 'Tint', kind: 'colour' }],
      colourField: 'f-tint',
    };
    const bug = resolveChild({ ...BUG_DRAFT, statuses: ['x'], display: {} }, plain);
    expect(bug.colourField).toBe('f-tint');
    const bare = resolveChild(
      { ...BUG_DRAFT, statuses: ['x'] },
      {
        id: 'w',
        label: 'W',
        newTitle: 'New w',
        glyph: 'task',
        color: '#000000',
        fields: ['title', 'status'],
      },
    );
    for (const part of INHERITED_PARTS) expect(bare[part]).toBeUndefined();
    expect(bare.custom).toEqual(BUG_DRAFT.custom);
  });

  it('drops a field of its own the base type comes to have, the base’s copy winning', () => {
    const both = valid([
      {
        ...WORK,
        custom: [...WORK.custom!, { id: 'f-severity', label: 'Sev', kind: 'number' }],
        fields: [...WORK.fields, 'f-severity'],
      },
      {
        ...BUG_DRAFT,
        ownFields: ['f-severity', 'assignee', 'due'],
        fields: [...BUG_DRAFT.fields, 'assignee', 'due'],
      },
    ]);
    expect(both[1]!.custom!.filter((c) => c.id === 'f-severity')).toEqual([
      { id: 'f-severity', label: 'Sev', kind: 'number' },
    ]);
    expect(both[1]!.ownFields).toEqual(['due']);
  });

  it('keeps a Project’s Start and Due as its own when its base lacks them', () => {
    const [, project] = valid([
      WORK,
      {
        ...BUG_DRAFT,
        id: 'project',
        label: 'Project',
        fields: ['title', 'status'],
        custom: [],
        ownFields: [],
      },
    ]);
    expect(project!.ownFields).toEqual(['start', 'due']);
    expect(project!.fields.slice(-2)).toEqual(['start', 'due']);
  });

  it('stores an empty ownFields when it adds none, and ignores own ids it no longer offers', () => {
    const [, bug] = valid([
      WORK,
      { ...BUG_DRAFT, fields: ['title', 'status'], custom: [], ownFields: ['f-gone'] },
    ]);
    expect(bug!.ownFields).toEqual([]);
    expect(bug!.fields).toEqual(WORK.fields);
  });

  it('refuses an inherits or ownFields of the wrong shape', () => {
    expect(reason([WORK, { ...BUG_DRAFT, inherits: 'Not An Id' }])).toBe('types[1].inherits');
    expect(reason([WORK, { ...BUG_DRAFT, ownFields: 'f-severity' }])).toBe('types[1].ownFields');
    expect(reason([WORK, { ...BUG_DRAFT, ownFields: [3] }])).toBe('types[1].ownFields');
    // ownFields with no base is dropped, as nothing reads it.
    const [plain] = valid([{ ...WORK, ownFields: ['assignee'] }]);
    expect(plain!.ownFields).toBeUndefined();
  });
});

describe('a change to the base type', () => {
  it('reaches every type inheriting from it: a field added, removed and renamed, a new state order', () => {
    const stored = valid([
      WORK,
      BUG_DRAFT,
      { ...BUG_DRAFT, id: 'story', label: 'Story', custom: [], fields: ['title', 'status'] },
    ]);
    const changed: ItemTypeDef = {
      ...stored[0]!,
      fields: ['title', 'status', 'due', 'f-area'],
      custom: [{ ...WORK.custom![1]!, label: 'Team area' }],
      statuses: ['done', 'todo'],
    };
    const [, bug, story] = valid([changed, stored[1], stored[2]]);
    expect(bug!.fields).toEqual(['title', 'status', 'due', 'f-area', 'f-severity']);
    expect(bug!.custom!.map((c) => c.label)).toEqual(['Team area', 'Severity']);
    expect(bug!.statuses).toEqual(['done', 'todo']);
    expect(story!.fields).toEqual(['title', 'status', 'due', 'f-area']);
  });

  it('reaches a type inheriting from it when made over someone else’s change (a rebase)', () => {
    const stored = { version: 1, types: valid([WORK, BUG_DRAFT]) };
    const someoneElse = {
      version: 1,
      types: [stored.types[0]!, { ...stored.types[1]!, color: '#000000' }],
    };
    const mine = {
      before: stored,
      after: {
        version: 1,
        types: [{ ...stored.types[0]!, fields: [...WORK.fields, 'due'] }, stored.types[1]!],
      },
    };
    const rebased = rebaseCatalogueChange(someoneElse, mine)!;
    expect(rebased.types[1]).toMatchObject({ color: '#000000' });
    expect(rebased.types[1]!.fields).toContain('due');
  });

  it('is refused whole when it takes an inherited type past a cap, naming that type', () => {
    const own = ['f-own-0', 'f-own-1'];
    const bug = {
      ...BUG_DRAFT,
      fields: ['title', 'status', ...own],
      custom: own.map((id) => ({ id, label: id, kind: 'text' })),
    };
    expect(reason([WORK, bug])).toBeNull();
    // Work's 2 custom fields and 11 of its own: 13, past 12.
    const custom = Array.from({ length: ITEM_TYPE_CUSTOM_MAX - 1 }, (_, i) => ({
      id: `f-o${i}`,
      label: `O${i}`,
      kind: 'text',
    }));
    const fullBug = {
      ...BUG_DRAFT,
      custom,
      fields: ['title', 'status', ...custom.map((c) => c.id)],
    };
    expect(reason([WORK, fullBug])).toBe('types[1].custom');
    const builtIns = [
      'priority',
      'color',
      'labels',
      'estimate',
      'start',
      'due',
      'checklist',
      'attachments',
      'comments',
      'votes',
    ];
    const wide = { ...WORK, fields: [...WORK.fields, ...builtIns] };
    const ownWide = {
      ...BUG_DRAFT,
      custom: Array.from({ length: 9 }, (_, i) => ({
        id: `f-w${i}`,
        label: `W${i}`,
        kind: 'text',
      })),
    };
    ownWide.fields = ['title', 'status', ...ownWide.custom.map((c) => c.id)];
    expect(wide.fields.length + 9).toBeGreaterThan(ITEM_TYPE_FIELDS_MAX);
    expect(reason([wide, ownWide])).toBe('types[1].fields');
  });
});

describe('detaching', () => {
  it('Detach keeps a copy of the base type’s settings as they are, then stops following', () => {
    const [work, bug] = valid([WORK, BUG_DRAFT]);
    const detached = detachType(bug!);
    expect(detached.inherits).toBeUndefined();
    expect(detached.ownFields).toBeUndefined();
    const [, after] = valid([{ ...work!, fields: ['title', 'status'], custom: [] }, detached]);
    expect(after!.fields).toEqual([...WORK.fields, 'f-severity']);
    expect(after!.statuses).toEqual(WORK.statuses);
  });

  it('deleting the base type detaches every type inheriting from it, each keeping its fields', () => {
    const [, bug] = valid([WORK, BUG_DRAFT]);
    const [left] = valid([bug]);
    expect(left!.inherits).toBeUndefined();
    expect(left!.fields).toEqual([...WORK.fields, 'f-severity']);
    expect(left!.custom!.map((c) => c.id)).toEqual(['f-blocked-by', 'f-area', 'f-severity']);
  });

  it('an editor from before inheritance keeps every inherited field when it saves', () => {
    // What it stores: the resolved type without the keys it does not know.
    const stored = valid([WORK, BUG_DRAFT]);
    const older = JSON.parse(JSON.stringify(stored)) as Record<string, unknown>[];
    for (const t of older) {
      delete t['inherits'];
      delete t['ownFields'];
    }
    const saved = readItemTypeCatalogue(catalogue(older))!;
    expect(saved.types[1]).toEqual(detachType(stored[1]!));
    expect(saved.types[1]!.fields).toEqual(stored[1]!.fields);
    expect(saved.types[1]!.custom).toEqual(stored[1]!.custom);
  });
});

describe('one level only', () => {
  it('refuses a chain and a type inheriting from itself', () => {
    const story = {
      ...BUG_DRAFT,
      id: 'story',
      label: 'Story',
      inherits: 'bug',
      custom: [],
      fields: ['title', 'status'],
    };
    expect(reason([WORK, BUG_DRAFT, story])).toBe('types[2].inherits');
    expect(reason([{ ...WORK, inherits: 'work' }])).toBe('types[0].inherits');
    expect(inheritanceProblem([WORK, BUG_DRAFT])).toBeNull();
  });

  it('leaves a chain as it is when resolving outside validation', () => {
    const story: ItemTypeDef = { ...BUG_DRAFT, id: 'story', label: 'Story', inherits: 'bug' };
    const out = withInheritance([WORK, BUG_DRAFT, story]);
    expect(out[2]).toBe(story);
  });

  it('offers as bases only types inheriting from none, never itself, and none to a base type', () => {
    const types = valid([
      WORK,
      BUG_DRAFT,
      { ...WORK, id: 'idea', label: 'Idea', fields: ['title', 'status'], custom: [] },
    ]);
    expect(basesFor('bug', types).map((t) => t.id)).toEqual(['work', 'idea']);
    expect(basesFor(undefined, types).map((t) => t.id)).toEqual(['work', 'idea']);
    expect(basesFor('work', types)).toEqual([]);
    expect(inheritingTypesOf('work', types).map((t) => t.id)).toEqual(['bug']);
  });
});

describe('the helpers', () => {
  it('finds a base type and what it gives', () => {
    const types = valid([WORK, BUG_DRAFT]);
    expect(baseOf(types[1]!, types)?.id).toBe('work');
    expect(baseOf(types[0]!, types)).toBeUndefined();
    expect(baseOf({ id: 'x', inherits: 'x' }, types)).toBeUndefined();
    expect([...inheritedFieldIds(types[1]!, types)]).toEqual([...WORK.fields]);
    expect(inheritedFieldIds(types[0]!, types).size).toBe(0);
  });

  it('inheritFrom makes the fields a type had and its base lacks its own', () => {
    const bug = inheritFrom(
      {
        ...BUG_DRAFT,
        inherits: undefined,
        ownFields: ['nothing'],
        fields: ['title', 'status', 'assignee', 'f-severity'],
      },
      WORK,
    );
    expect(bug.inherits).toBe('work');
    expect(bug.ownFields).toEqual(['f-severity']);
  });

  it('answers the same list when nothing inherits or nothing changed', () => {
    const plain = [WORK];
    expect(withInheritance(plain)).toBe(plain);
    const resolved = valid([WORK, BUG_DRAFT]);
    const copy = [...resolved];
    expect(withInheritance(copy)).toBe(copy);
  });
});
