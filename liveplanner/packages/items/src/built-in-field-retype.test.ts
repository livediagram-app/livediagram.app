import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_KIND_SHAPES,
  STATUS_KEEPS_TYPE,
  builtInCardsOf,
  builtInReader,
  builtInRetypePatches,
  builtInRetypeRefusal,
  builtInValueOf,
  retypeBuiltInIn,
  typeSavePatches,
} from './built-in-field-retype';
import { fieldValues } from './field-kind-change';
import { ITEM_TYPES, type CustomFieldDef, type ItemTypeDef } from './item-types';
import { SAM, item } from './test-items';
import { validateItemTypeCatalogue } from './type-catalogue';

// docs/specs/026-plan/item-types.md "Edit Field": Built-in fields, "Another type" and "Status".
const TASK: ItemTypeDef = {
  ...ITEM_TYPES.find((t) => t.id === 'task')!,
  fields: ['title', 'status', 'assignee', 'priority', 'estimate', 'due', 'color', 'description'],
  tabs: [{ id: 't-overview', label: 'Overview', fields: ['description'] }],
  fieldLabels: { priority: 'Urgency', estimate: 'Points' },
  assigneeNotifies: false,
};
const ON = { field: 'priority', typeIds: new Set(['task']) };

describe('a built-in’s shape and refusals', () => {
  it('opens every renamable built-in on its own tile', () => {
    expect(BUILT_IN_KIND_SHAPES.due).toEqual({ kind: 'date' });
    expect(BUILT_IN_KIND_SHAPES.priority?.options).toEqual(['Urgent', 'High', 'Medium', 'Low']);
  });

  it('never lets Status change type, and keeps the kept-apart kinds apart', () => {
    expect(builtInRetypeRefusal('status', { kind: 'text' })).toBe(STATUS_KEEPS_TYPE);
    expect(builtInRetypeRefusal('title', { kind: 'text' })).toBe(STATUS_KEEPS_TYPE);
    expect(builtInRetypeRefusal('checklist', { kind: 'text' })).toMatch(/Checklist/);
    expect(builtInRetypeRefusal('comments', { kind: 'number' })).toMatch(/Comments/);
    expect(builtInRetypeRefusal('votes', { kind: 'number' })).toMatch(/Votes/);
    expect(builtInRetypeRefusal('attachments', { kind: 'text' })).toMatch(/Image/);
    expect(builtInRetypeRefusal('due', { kind: 'datetime' })).toBeNull();
    expect(builtInRetypeRefusal('priority', { kind: 'multichoice' })).toBeNull();
  });

  it('reads a Priority by its name and the rest as stored', () => {
    expect(builtInValueOf('priority', 'high')).toBe('High');
    expect(builtInValueOf('priority', 'nope')).toBeUndefined();
    expect(builtInValueOf('due', '2026-11-04')).toBe('2026-11-04');
    expect(builtInReader('due')).toBeUndefined();
    const cards = [item({ title: 'A', priority: 'urgent' }), item({ title: 'B' })];
    expect([...fieldValues(cards, ON, builtInReader('priority'))]).toEqual(['Urgent']);
  });
});

describe('the cards a built-in is on', () => {
  it('takes the type and the types inheriting the field, not one keeping its own copy', () => {
    const heir: ItemTypeDef = { ...TASK, id: 'heir', inherits: 'task', ownFields: [] };
    const own: ItemTypeDef = { ...TASK, id: 'own', inherits: 'task', ownFields: ['due'] };
    const none: ItemTypeDef = {
      ...TASK,
      id: 'none',
      inherits: 'task',
      fields: ['title', 'status'],
    };
    expect([...builtInCardsOf('task', 'due', [TASK, heir, own, none]).typeIds]).toEqual([
      'task',
      'heir',
    ]);
  });
});

describe('the type rewritten', () => {
  const def: CustomFieldDef = { id: 'f-urgency', label: 'Urgency', kind: 'multichoice' };

  it('puts the new field in the built-in’s place and drops its name', () => {
    const next = retypeBuiltInIn(TASK, 'priority', { ...def, options: ['High', 'Low'] });
    expect(next.fields).toEqual([
      'title',
      'status',
      'assignee',
      'f-urgency',
      'estimate',
      'due',
      'color',
      'description',
    ]);
    expect(next.custom?.at(-1)?.id).toBe('f-urgency');
    expect(next.fieldLabels).toEqual({ estimate: 'Points' });
    expect(next.assigneeNotifies).toBe(false);
    expect(next.tabs).toEqual(TASK.tabs);
    // Its cards' layouts name the new field where they named Priority.
    const shown = Object.values(next.display ?? {}).flatMap((l) => Object.values(l ?? {}).flat());
    expect(shown).toContain('f-urgency');
    expect(shown).not.toContain('priority');
    const check = validateItemTypeCatalogue({ version: 1, types: [next] });
    expect(check.ok).toBe(true);
  });

  it('moves a tab’s field, own fields and the Assignee’s Notifies, and a Colour becomes the Card Colour', () => {
    const description = retypeBuiltInIn(
      { ...TASK, ownFields: ['description'], fieldLabels: { description: 'Notes' } },
      'description',
      { id: 'f-notes', label: 'Notes', kind: 'text' },
    );
    expect(description.tabs?.[0]?.fields).toEqual(['f-notes']);
    expect(description.ownFields).toEqual(['f-notes']);
    expect(description.fieldLabels).toBeUndefined();
    const assignee = retypeBuiltInIn(TASK, 'assignee', {
      id: 'f-owner',
      label: 'Owner',
      kind: 'person',
      multiple: true,
    });
    expect(assignee.assigneeNotifies).toBeUndefined();
    const colour = retypeBuiltInIn({ ...TASK, tabs: undefined }, 'color', {
      id: 'f-shade',
      label: 'Shade',
      kind: 'colour',
    });
    expect(colour.colourField).toBe('f-shade');
    expect(colour.tabs).toBeUndefined();
    const kept = retypeBuiltInIn({ ...TASK, colourField: 'f-old' }, 'due', {
      id: 'f-when',
      label: 'When',
      kind: 'datetime',
    });
    expect(kept.colourField).toBe('f-old');
  });
});

describe('the values moved', () => {
  it('moves a Priority to a Multiple Choice by name, clearing the built-in', () => {
    const a = item({ title: 'A', priority: 'high' });
    const b = item({ title: 'B', priority: 'low' });
    const c = item({ title: 'C' });
    const out = builtInRetypePatches(
      'priority',
      { kind: 'multichoice', options: ['High'] },
      'f-urgency',
      [a, b, c],
      ON,
    );
    expect(out.held).toBe(2);
    expect(out.cleared).toBe(1);
    expect(out.patches).toEqual([
      { id: a.id, patch: { set: { 'f-urgency': ['High'] }, clear: ['priority'] } },
      { id: b.id, patch: { clear: ['priority'] } },
    ]);
  });

  it('keeps an Assignee as a person, and drops a Description’s formatting as Text', () => {
    const a = item({ title: 'A', assignee: SAM });
    const kept = builtInRetypePatches(
      'assignee',
      { kind: 'person', multiple: true },
      'f-owners',
      [a],
      { field: 'assignee', typeIds: new Set(['task']) },
    );
    expect(kept.patches).toEqual([
      { id: a.id, patch: { set: { 'f-owners': SAM }, clear: ['assignee'] } },
    ]);
    const d = item({ title: 'D', description: 'Hello', descriptionRich: [] as never });
    const text = builtInRetypePatches('description', { kind: 'text' }, 'f-notes', [d], {
      field: 'description',
      typeIds: new Set(['task']),
    });
    expect(text.patches[0]?.patch.clear).toEqual(['description', 'descriptionRich']);
  });

  it('reads a built-in it has no shape for as text', () => {
    const a = item({ title: 'A', status: 'todo' });
    const out = builtInRetypePatches('title', { kind: 'text' }, 'f-x', [a], {
      field: 'title',
      typeIds: new Set(['task']),
    });
    expect(out.held).toBe(1);
  });
});

describe('every write a type’s save makes', () => {
  it('moves a built-in’s values beside a custom field’s changed ones, one patch per card', () => {
    const before: ItemTypeDef = {
      ...TASK,
      fields: [...TASK.fields, 'f-size'],
      custom: [{ id: 'f-size', label: 'Size', kind: 'text' }],
    };
    const def: CustomFieldDef = { id: 'f-urgency', label: 'Urgency', kind: 'text' };
    const after = retypeBuiltInIn(
      { ...before, custom: [{ id: 'f-size', label: 'Size', kind: 'number' }] },
      'priority',
      def,
    );
    const a = item({ title: 'A', priority: 'high', 'f-size': '3' });
    const patches = typeSavePatches(before, after, { 'f-urgency': 'priority' }, [before], [a]);
    expect(patches).toEqual([
      { id: a.id, patch: { set: { 'f-size': 3, 'f-urgency': 'High' }, clear: ['priority'] } },
    ]);
    // A retype naming a field the type lacks, or a built-in with no shape, writes nothing.
    expect(typeSavePatches(before, before, { 'f-gone': 'priority' }, [before], [a])).toEqual([]);
    const withDef = { ...before, custom: [...before.custom!, def] };
    expect(typeSavePatches(before, withDef, { 'f-urgency': 'title' }, [before], [a])).toEqual([]);
  });
});
