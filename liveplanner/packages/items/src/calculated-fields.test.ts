import { describe, expect, it } from 'vitest';
import type { PlanBoardSetup } from './board';
import { boardCsvRows, boardCsvImport } from './board-csv';
import {
  CALCULATION_LABELS,
  calculatedText,
  calculatedValue,
  calculatedValuesOf,
  calculationOf,
  childIndexFor,
  childIndexOf,
  childrenOf,
  donePhase,
  doneStatusesOf,
  hasCalculatedFields,
} from './calculated-fields';
import type { ItemTypeDef } from './item-types';
import { item } from './test-items';
import { ITEM_TYPE_CATALOGUE_VERSION, validateItemTypeCatalogue } from './type-catalogue';
import { applyCardTypeChanges } from './type-changes';
import { calculatedWritten, writtenItemsRefusal } from './write-checks';

// Calculated fields (docs/specs/026-plan/item-types.md "Calculated fields").

const project: ItemTypeDef = {
  id: 'project',
  label: 'Project',
  newTitle: 'New project',
  glyph: 'project',
  color: '#18181b',
  fields: ['title', 'status', 'f-kids', 'f-done'],
  custom: [
    { id: 'f-kids', label: 'Tasks', kind: 'calculated', calculation: 'childCount' },
    { id: 'f-done', label: 'Progress', kind: 'calculated', calculation: 'childrenDone' },
    // Not offered by the type: never worked out.
    { id: 'f-gone', label: 'Gone', kind: 'calculated', calculation: 'childCount' },
  ],
};
const task: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'task',
  color: '#71717a',
  fields: ['title', 'status', 'parent', 'f-also'],
  custom: [
    { id: 'parent', label: 'Parent', kind: 'card', linkType: 'project' },
    // A second link to a Project: a task linking through both still counts once.
    { id: 'f-also', label: 'Also', kind: 'card', linkType: 'project' },
    // A link the type no longer offers is no child link.
    { id: 'f-old', label: 'Old', kind: 'card', linkType: 'project' },
  ],
};
// A Note links to Tasks, not Projects: a Note pointing at a project through it is no child of the project.
const note: ItemTypeDef = {
  id: 'note',
  label: 'Note',
  newTitle: 'New note',
  glyph: 'note',
  color: '#2563eb',
  fields: ['title', 'f-task'],
  custom: [{ id: 'f-task', label: 'Task', kind: 'card', linkType: 'task' }],
};
const types = [project, task, note];

const p = item({ title: 'Launch', status: 'doing' }, { type: 'project' });
const done = item({ title: 'A', status: 'done', parent: p.id, 'f-also': p.id });
const open = item({ title: 'B', status: 'todo', parent: p.id });
const archived = item({ title: 'C', status: 'done', parent: p.id, archived: true });
const trashed = item({ title: 'D', status: 'trash', parent: p.id });
const oldLink = item({ title: 'E', status: 'todo', 'f-old': p.id });
const wrongType = item({ title: 'F', 'f-task': p.id }, { type: 'note' });
const self = item({ title: 'G', status: 'todo', parent: 'itself' }, { id: 'itself' });
const all = [p, done, open, archived, trashed, oldLink, wrongType, self];
const isDone = (s: string | undefined) => s === 'done';

describe('children', () => {
  const index = childIndexOf(all, types);

  it('are the live cards linking here through a field naming the type, each once', () => {
    expect(
      childrenOf(p, index)
        .map((c) => c.fields['title'])
        .sort(),
    ).toEqual(['A', 'B', 'C']);
    expect(childrenOf(open, index)).toEqual([]);
    expect(childrenOf({ id: 'itself', type: 'task' }, index)).toEqual([]);
  });

  it('is made once per store map and its types', () => {
    const store = new Map(all.map((i) => [i.id, i]));
    const first = childIndexFor(store, types);
    expect(childIndexFor(store, types)).toBe(first);
    expect(childrenOf(p, first)).toHaveLength(3);
    // Other types make it again.
    expect(childIndexFor(store, [project])).not.toBe(first);
  });

  it('count, and the share done as a whole percentage', () => {
    const [kids, progress, gone] = project.custom!;
    expect(calculatedValue(kids!, p, index, isDone)).toBe(3);
    expect(calculatedValue(progress!, p, index, isDone)).toBe(67);
    // No children: a count of none, and no percentage.
    expect(calculatedValue(kids!, open, index, isDone)).toBe(0);
    expect(calculatedValue(progress!, open, index, isDone)).toBeNull();
    expect(calculatedValue({ kind: 'text' }, p, index, isDone)).toBeNull();
    expect(calculatedValuesOf(p, project, index, isDone)).toEqual({ 'f-kids': 3, 'f-done': 67 });
    expect(calculatedValuesOf(open, task, index, isDone)).toBeUndefined();
    expect(gone && calculationOf(gone)).toBe('childCount');
  });

  it('reads as a card shows it', () => {
    const [kids, progress] = project.custom!;
    expect(calculatedText(kids!, 3)).toBe('3');
    expect(calculatedText(progress!, 67)).toBe('67%');
    expect(calculatedText(progress!, null)).toBeNull();
    expect(calculatedText(progress!, undefined)).toBeNull();
    expect(CALCULATION_LABELS.childrenDone).toBe('Children Done (%)');
  });

  it('is worked out only when a type has one', () => {
    expect(hasCalculatedFields(types)).toBe(true);
    expect(hasCalculatedFields([task, note])).toBe(false);
    expect(calculationOf({ kind: 'calculated', calculation: 'nope' as never })).toBeUndefined();
  });
});

describe('done', () => {
  it('is a done column’s status, the first board naming it deciding', () => {
    const fromBoards = doneStatusesOf([
      { kind: 'all-cards', columns: [{ status: 'todo', name: 'To Do', done: true }] },
      {
        kind: 'board',
        columns: [
          { status: 'todo', name: 'To Do' },
          { status: 'done', name: 'Done', done: true },
        ],
      },
      { kind: 'board', columns: [{ status: 'todo', name: 'To Do', done: true }] },
    ]);
    expect(fromBoards('done')).toBe(true);
    expect(fromBoards('todo')).toBe(false);
    expect(fromBoards(undefined)).toBe(false);
    const fromPhases = donePhase(
      new Map([
        ['done', 'done'],
        ['todo', 'todo'],
      ]),
    );
    expect(fromPhases('done')).toBe(true);
    expect(fromPhases('todo')).toBe(false);
    expect(fromPhases(undefined)).toBe(false);
  });
});

describe('writes', () => {
  it('refuse a value given to one, but let one cleared or kept through', () => {
    expect(calculatedWritten(types, { type: 'project', fields: { 'f-kids': 4 } })).toBe('f-kids');
    expect(calculatedWritten(types, { type: 'project', fields: { 'f-kids': '' } })).toBeNull();
    expect(
      calculatedWritten(
        types,
        { type: 'project', fields: { 'f-kids': 4 } },
        { fields: { 'f-kids': 4 } },
      ),
    ).toBeNull();
    // A field the type does not offer is no Calculated field of it.
    expect(calculatedWritten(types, { type: 'project', fields: { 'f-gone': 4 } })).toBeNull();
  });

  it('refuse a new card or a change giving one a value, never a card put back or an undo', () => {
    const create = (extra = {}) => ({
      kind: 'create' as const,
      creates: [{ type: 'project', fields: { title: 'X', 'f-done': 50 }, ...extra }],
    });
    expect(writtenItemsRefusal(create(), [], [], types)).toEqual({
      error: 'field_calculated',
      field: 'f-done',
    });
    expect(writtenItemsRefusal(create({ id: 'item-one' }), [], [], types)).toMatchObject({
      id: 'item-one',
    });
    expect(writtenItemsRefusal(create({ key: 3 }), [], [], types)).toBeNull();
    expect(
      writtenItemsRefusal(
        { kind: 'create', creates: [{ type: 'project', fields: { title: 'X' } }] },
        [],
        [],
        types,
      ),
    ).toBeNull();
    const next = { ...p, fields: { ...p.fields, 'f-done': 50 } };
    const patch = { kind: 'patch' as const, id: p.id, patch: { set: { 'f-done': 50 } } };
    expect(writtenItemsRefusal(patch, [p], [next], types)).toEqual({
      error: 'field_calculated',
      id: p.id,
      field: 'f-done',
    });
    expect(writtenItemsRefusal({ ...patch, undo: true }, [p], [next], types)).toBeNull();
  });
});

describe('the catalogue', () => {
  const read = (field: Record<string, unknown>) =>
    validateItemTypeCatalogue({
      version: ITEM_TYPE_CATALOGUE_VERSION,
      types: [{ ...task, custom: [{ id: 'f-a', label: 'A', ...field }], fields: ['title', 'f-a'] }],
    });

  it('keeps a calculated field only with a calculation it knows', () => {
    const ok = read({ kind: 'calculated', calculation: 'childrenDone' });
    if (!ok.ok) throw new Error(ok.reason);
    expect(ok.catalogue.types[0]!.custom![0]).toMatchObject({ calculation: 'childrenDone' });
    expect(read({ kind: 'calculated' }).ok).toBe(false);
    expect(read({ kind: 'calculated', calculation: 'sum' }).ok).toBe(false);
    const text = read({ kind: 'text', calculation: 'childCount' });
    if (!text.ok) throw new Error(text.reason);
    expect(text.catalogue.types[0]!.custom![0]).not.toHaveProperty('calculation');
  });

  it('is made and changed through change_card_types, by id or name', () => {
    const made = applyCardTypeChanges(
      null,
      [
        {
          op: 'add',
          name: 'Epic',
          custom: [
            { name: 'Stories', kind: 'Calculated', calculation: 'Child Count' },
            { name: 'Progress', kind: 'calculated', calculation: 'childrenDone' },
          ],
        },
        {
          op: 'set',
          type: 'Epic',
          editCustom: [{ field: 'Stories', calculation: 'children done (%)' }],
        },
      ],
      [],
    );
    if (!made.ok) throw new Error(made.message);
    expect(made.catalogue!.types[0]!.custom!.map((f) => f.calculation)).toEqual([
      'childrenDone',
      'childrenDone',
    ]);
    const refused = (custom: { name: string; kind: string; calculation?: string }) =>
      applyCardTypeChanges(null, [{ op: 'add', name: 'Epic', custom: [custom] }], []);
    expect(refused({ name: 'P', kind: 'calculated' })).toMatchObject({
      ok: false,
      message:
        'The calculated field "P" needs a calculation: childCount (Child Count), childrenDone (Children Done (%)), rollup (Rollup), lookup (Lookup) or formula (Formula).',
    });
    expect(refused({ name: 'P', kind: 'text', calculation: 'childCount' })).toMatchObject({
      ok: false,
      message: '"P" is a text field: only a calculated field has a calculation.',
    });
    const editText = applyCardTypeChanges(
      null,
      [
        { op: 'add', name: 'Epic', custom: [{ name: 'Note', kind: 'text' }] },
        { op: 'set', type: 'Epic', editCustom: [{ field: 'Note', calculation: 'childCount' }] },
      ],
      [],
    );
    expect(editText).toMatchObject({
      ok: false,
      message: '"Note" is a text field: only a calculated field has a calculation.',
    });
  });
});

describe('Import and Export CSV', () => {
  const setup: PlanBoardSetup = {
    title: 'Projects',
    columns: [{ id: 'c1', status: 'doing', name: 'Doing' }],
    swimlaneBy: 'none',
    cardFields: [],
    hideWriting: false,
    addTypes: ['project'],
  };

  it('leave a Calculated field out', () => {
    const rows = boardCsvRows(setup, new Map([[p.id, p]]), types);
    expect(rows[0]).not.toContain('Tasks');
    const result = boardCsvImport(
      [
        ['Title', 'Tasks'],
        ['New', '5'],
      ],
      { setup, types, people: [], room: 100 },
    );
    expect(result.creates[0]!.fields).toEqual({ title: 'New' });
  });
});
