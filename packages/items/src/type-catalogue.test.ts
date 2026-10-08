import { describe, expect, it } from 'vitest';
import { FALLBACK_ITEM_TYPE, ITEM_TYPES, type ItemTypeDef } from './item-types';
import { planGlyphPath, PLAN_GLYPH_FALLBACK, PLAN_GLYPHS } from './glyphs';
import {
  builtInDefaultStatus,
  resolvedDefaultStatus,
  defaultStatusOf,
  restoredCatalogue,
  withDefaultStatuses,
  BUILT_IN_FIELD_IDS,
  ITEM_TYPE_FIELDS_MAX,
  builtInCatalogue,
  customFieldOf,
  isBuiltInFieldId,
  ITEM_TYPES_MAX,
  newCustomFieldId,
  newItemTypeId,
  readItemTypeCatalogue,
  requiredFieldsOf,
  statusRefusal,
  typeAllowsStatus,
  ITEM_TYPE_EXCLUDED_STATUSES_MAX,
  slugOf,
  typeIn,
  typesOf,
  validateItemTypeCatalogue,
  detailsLabelOf,
  DETAILS_LABEL_DEFAULT,
  ITEM_TYPE_CUSTOM_MAX,
} from './type-catalogue';

// docs/specs/026-plan/item-types.md.
const call = {
  id: 'customer-call',
  label: 'Customer call',
  color: '#0891b2',
  glyph: 'chat',
  fields: ['f-outcome', 'description', 'f-followed-up'],
  custom: [
    { id: 'f-outcome', label: 'Outcome', kind: 'choice', options: ['Won', 'Lost'], onCard: true },
    { id: 'f-followed-up', label: 'Followed up', kind: 'checkbox' },
  ],
};
const withCall = (types: unknown[] = [...ITEM_TYPES, call]) => ({ version: 1, types });

describe('the type catalogue', () => {
  it('is the built-ins until a document stores its own', () => {
    expect(typesOf(null)).toBe(ITEM_TYPES);
    expect(typesOf(builtInCatalogue())).toEqual(ITEM_TYPES);
    expect(typeIn(ITEM_TYPES, 'project').label).toBe('Project');
    expect(typeIn(ITEM_TYPES, 'gone')).toBe(FALLBACK_ITEM_TYPE);
  });

  it('keeps a valid catalogue, normalised: title and status first, a new title made', () => {
    const result = validateItemTypeCatalogue(withCall());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const t = typeIn(result.catalogue.types, 'customer-call');
    expect(t.fields).toEqual(['title', 'status', 'f-outcome', 'description', 'f-followed-up']);
    expect(t.newTitle).toBe('New customer call');
    expect(t.custom?.[0]).toEqual({
      id: 'f-outcome',
      label: 'Outcome',
      kind: 'choice',
      options: ['Won', 'Lost'],
      onCard: true,
    });
  });

  it('keeps a renamed Details, drops the default name, and refuses a blank or long one', () => {
    const one = (detailsLabel: unknown) =>
      validateItemTypeCatalogue(withCall([{ ...call, detailsLabel }]));
    const named = one('  Facts ');
    expect(named.ok && named.catalogue.types[0]!.detailsLabel).toBe('Facts');
    expect(detailsLabelOf(named.ok ? named.catalogue.types[0]! : {})).toBe('Facts');
    const plain = one('Details');
    expect(plain.ok && plain.catalogue.types[0]!.detailsLabel).toBeUndefined();
    expect(detailsLabelOf({})).toBe(DETAILS_LABEL_DEFAULT);
    expect(one(' ')).toMatchObject({ reason: 'types[0].detailsLabel' });
    expect(one('x'.repeat(25))).toMatchObject({ reason: 'types[0].detailsLabel' });
  });

  it('refuses a catalogue by the part that fails', () => {
    const bad = (patch: Record<string, unknown>) =>
      validateItemTypeCatalogue(withCall([{ ...call, ...patch }]));
    expect(validateItemTypeCatalogue({ version: 2, types: [call] })).toEqual({
      ok: false,
      reason: 'version',
    });
    expect(validateItemTypeCatalogue(withCall([]))).toMatchObject({ ok: false, reason: 'types' });
    expect(bad({ id: 'Has Caps' })).toMatchObject({ reason: 'types[0].id' });
    expect(bad({ id: 'item' })).toMatchObject({ reason: 'types[0].id' });
    expect(bad({ label: ' ' })).toMatchObject({ reason: 'types[0].label' });
    expect(bad({ color: 'red' })).toMatchObject({ reason: 'types[0].color' });
    expect(bad({ glyph: 'unicorn' })).toMatchObject({ reason: 'types[0].glyph' });
    expect(bad({ fields: ['f-nope'] })).toMatchObject({ reason: 'types[0].fields' });
    expect(bad({ custom: [{ id: 'nope', label: 'X', kind: 'text' }] })).toMatchObject({
      reason: 'types[0].custom[0].id',
    });
    expect(
      bad({ custom: [{ id: 'f-a', label: 'A', kind: 'choice', options: ['x', 'X'] }] }),
    ).toMatchObject({ reason: 'types[0].custom[0].options' });
    expect(bad({ custom: [{ id: 'f-a', label: 'A', kind: 'person' }] })).toMatchObject({
      reason: 'types[0].custom[0].kind',
    });
    expect(
      validateItemTypeCatalogue(withCall([call, { ...call, id: 'other', label: 'CUSTOMER CALL' }])),
    ).toMatchObject({ reason: 'types[1].label' });
    const many = Array.from({ length: ITEM_TYPES_MAX + 1 }, (_, i) => ({
      ...call,
      id: `t${i}`,
      label: `T${i}`,
    }));
    expect(validateItemTypeCatalogue(withCall(many))).toMatchObject({ reason: 'types' });
  });

  it('reads back a stored value, falling back to the built-ins when it is damaged', () => {
    expect(readItemTypeCatalogue(null)).toBeNull();
    expect(readItemTypeCatalogue('{not json')).toBeNull();
    expect(readItemTypeCatalogue(JSON.stringify(withCall()))?.types).toHaveLength(
      ITEM_TYPES.length + 1,
    );
  });

  it('makes ids from names that never clash', () => {
    expect(slugOf('  Café  Visit! ')).toBe('cafe-visit');
    expect(newItemTypeId('Task', ITEM_TYPES)).toBe('task-2');
    expect(newItemTypeId('Item', ITEM_TYPES)).toBe('item-2');
    expect(newItemTypeId('42 things', ITEM_TYPES)).toBe('type-42-things');
    expect(newCustomFieldId('Outcome', ['f-outcome'])).toBe('f-outcome-2');
    expect(newCustomFieldId('!!!', [])).toBe('f-field');
  });

  it('draws every glyph, and an unknown one as a square', () => {
    for (const id of Object.keys(PLAN_GLYPHS))
      expect(planGlyphPath(id)).not.toBe(PLAN_GLYPH_FALLBACK);
    expect(planGlyphPath('item')).toBe(PLAN_GLYPH_FALLBACK);
    expect(planGlyphPath(undefined)).toBe(PLAN_GLYPH_FALLBACK);
  });
});

describe('reading a type', () => {
  it('finds a custom field by id and tells built-in fields apart', () => {
    const type = { ...call, newTitle: 'x' } as unknown as ItemTypeDef;
    expect(customFieldOf(type, 'f-outcome')?.label).toBe('Outcome');
    expect(customFieldOf(ITEM_TYPES[0], 'f-outcome')).toBeUndefined();
    expect(isBuiltInFieldId('due')).toBe(true);
    expect(isBuiltInFieldId('f-outcome')).toBe(false);
  });

  it('starts a first change from the built-ins', () => {
    expect(builtInCatalogue()).toEqual({ version: 1, types: ITEM_TYPES });
  });
});

// docs/specs/026-plan/item-types.md "An item type": a Project always keeps its Start and Due.
describe('a Project’s dates', () => {
  it('are always kept, and come back to a stored Project that lost them', () => {
    expect(requiredFieldsOf('project')).toEqual(['title', 'status', 'start', 'due']);
    expect(requiredFieldsOf('task')).toEqual(['title', 'status']);
    expect(requiredFieldsOf(undefined)).toEqual(['title', 'status']);
    const bare = { ...ITEM_TYPES[0], fields: ['title', 'status', 'description'] };
    const read = readItemTypeCatalogue({ version: 1, types: [bare] });
    expect(read?.types[0]?.fields).toEqual(['title', 'status', 'description', 'start', 'due']);
  });

  it('come back even when that takes a stored Project past the field cap', () => {
    const builtIns = BUILT_IN_FIELD_IDS.filter((f) => f !== 'start' && f !== 'due');
    const room = Math.min(ITEM_TYPE_FIELDS_MAX - builtIns.length, ITEM_TYPE_CUSTOM_MAX);
    const custom = Array.from({ length: room }, (_, i) => ({
      id: `f-x${i}`,
      label: `X${i}`,
      kind: 'text',
    }));
    const full = { ...ITEM_TYPES[0], fields: [...builtIns, ...custom.map((c) => c.id)], custom };
    const read = readItemTypeCatalogue({ version: 1, types: [full] });
    expect(read?.types[0]?.fields.length).toBeGreaterThan(ITEM_TYPE_FIELDS_MAX - 2);
    expect(read?.types[0]?.fields.slice(-2)).toEqual(['start', 'due']);
  });

  it('are not added to any other type', () => {
    const read = readItemTypeCatalogue(withCall([call]));
    expect(read?.types[0]?.fields).not.toContain('start');
  });
});

// docs/specs/026-plan/item-types.md "An item type": the statuses a type leaves out.
describe('a type’s left-out statuses', () => {
  const task = ITEM_TYPES.find((t) => t.id === 'task')!;
  const read = (excludedStatuses: unknown) =>
    validateItemTypeCatalogue({ version: 1, types: [{ ...task, excludedStatuses }] });

  it('are stored de-duplicated, kept when no board names them, and dropped when empty', () => {
    const ok = read(['done', 'done', 'gone-status']);
    expect(ok.ok && ok.catalogue.types[0]!.excludedStatuses).toEqual(['done', 'gone-status']);
    const none = read([]);
    expect(none.ok && 'excludedStatuses' in none.catalogue.types[0]!).toBe(false);
  });

  it('refuse anything but a list of short status ids', () => {
    expect(read('done').ok).toBe(false);
    expect(read([''])).toMatchObject({ ok: false });
    expect(read([42])).toMatchObject({ ok: false });
    expect(read(['x'.repeat(41)])).toMatchObject({ ok: false });
    expect(
      read(Array.from({ length: ITEM_TYPE_EXCLUDED_STATUSES_MAX + 1 }, (_, i) => `s${i}`)),
    ).toMatchObject({ ok: false });
  });

  it('allow every status not left out, and no status at all', () => {
    const t = { ...task, excludedStatuses: ['done'] };
    expect(typeAllowsStatus(t, 'done')).toBe(false);
    expect(typeAllowsStatus(t, 'todo')).toBe(true);
    expect(typeAllowsStatus(t, null)).toBe(true);
    // A status added later is open to every type: nothing names it.
    expect(typeAllowsStatus(t, 'brand-new')).toBe(true);
    expect(typeAllowsStatus(task as ItemTypeDef, 'done')).toBe(true);
    expect(statusRefusal('Task', 'Done')).toBe("Task cards can't be Done");
  });
});

// docs/specs/026-plan/item-types.md "An item type": the Default State.
describe('a type’s Default State', () => {
  const task = ITEM_TYPES.find((t) => t.id === 'task')!;
  const read = (extra: Record<string, unknown>) =>
    validateItemTypeCatalogue({ version: 1, types: [{ ...task, ...extra }] });

  it('is stored when given, and refused when not a short status id', () => {
    const ok = read({ defaultStatus: 'backlog' });
    expect(ok.ok && ok.catalogue.types[0]!.defaultStatus).toBe('backlog');
    expect(read({ defaultStatus: '' }).ok).toBe(false);
    expect(read({ defaultStatus: 7 }).ok).toBe(false);
    expect(read({ defaultStatus: 'x'.repeat(41) }).ok).toBe(false);
    const none = read({});
    expect(none.ok && 'defaultStatus' in none.catalogue.types[0]!).toBe(false);
  });

  it('is ignored while the type turns it off', () => {
    expect(defaultStatusOf({ defaultStatus: 'todo' })).toBe('todo');
    expect(defaultStatusOf({ defaultStatus: 'todo', excludedStatuses: ['todo'] })).toBeUndefined();
    expect(defaultStatusOf(undefined)).toBeUndefined();
  });

  it('fills only the creates that name no status', () => {
    const types = [{ ...task, defaultStatus: 'backlog' }];
    const [bare, placed, fielded, other] = withDefaultStatuses(
      [
        { type: 'task' },
        { type: 'task', place: { status: 'done' } },
        { type: 'task', fields: { status: 'doing' } },
        { type: 'bug' },
      ],
      types,
    );
    expect(bare!.place).toEqual({ status: 'backlog' });
    expect(placed!.place).toEqual({ status: 'done' });
    expect(fielded!.place).toBeUndefined();
    expect(other!.place).toBeUndefined();
  });
});

// docs/specs/026-plan/item-types.md "The catalogue": Restore Built-In Types keeps the document's own types.
describe('restoring the built-in types', () => {
  const task = ITEM_TYPES.find((t) => t.id === 'task')!;
  const bug = { ...task, id: 'bug', label: 'Bug' };

  it('puts the built-ins back as they started and keeps the document’s own, after them', () => {
    const stored = { version: 1, types: [{ ...task, label: 'Chore' }, bug] };
    const next = restoredCatalogue(stored)!;
    expect(next.types.map((t) => t.id)).toEqual([...ITEM_TYPES.map((t) => t.id), 'bug']);
    expect(next.types.find((t) => t.id === 'task')!.label).toBe('Task');
    expect(next.types.at(-1)).toBe(bug);
  });

  it('removes the stored catalogue when the document added none', () => {
    expect(restoredCatalogue({ version: 1, types: [{ ...task, label: 'Chore' }] })).toBeNull();
    expect(restoredCatalogue(null)).toBeNull();
  });
});

describe('a built-in type’s Default State', () => {
  const names = new Map([
    ['backlog~a1', 'Backlog'],
    ['todo~a1', 'To do'],
    ['done~a1', 'Done'],
  ]);
  const task = ITEM_TYPES.find((t) => t.id === 'task')!;

  it('is the document’s state of its name, unless turned off, and never beats a chosen one', () => {
    expect(builtInDefaultStatus(task, names)).toBe('todo~a1');
    expect(builtInDefaultStatus({ id: 'project' }, names)).toBe('backlog~a1');
    expect(builtInDefaultStatus({ id: 'idea' }, names)).toBeUndefined();
    expect(builtInDefaultStatus({ id: 'custom' }, names)).toBeUndefined();
    expect(builtInDefaultStatus({ ...task, excludedStatuses: ['todo~a1'] }, names)).toBeUndefined();
    expect(resolvedDefaultStatus(task, names)).toBe('todo~a1');
    expect(resolvedDefaultStatus({ ...task, defaultStatus: 'done~a1' }, names)).toBe('done~a1');
    expect(resolvedDefaultStatus({ id: 'custom' }, names)).toBeUndefined();
  });
});
