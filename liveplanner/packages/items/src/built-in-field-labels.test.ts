import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  BUILT_IN_FIELD_NAMES,
  FIELD_LABEL_MAX,
  RENAMABLE_BUILT_INS,
  builtInFieldLabel,
  builtInFieldName,
  builtInIdOfName,
  fieldLabelsWith,
  isRenamableBuiltIn,
  readFieldLabels,
  typeFieldLabel,
} from './built-in-field-labels';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { CUSTOM_FIELD_LABEL_MAX, validateItemTypeCatalogue } from './type-catalogue';
import { boardSortFieldOf, boardSortFieldsOf } from './board-sort';
import { laneFieldsOf, type PlanBoardSetup } from './board';
import { searchFields } from './card-search';
import { breakdownTitle } from './plan-views';
import { viewDateName, viewDateOptions, viewMeasureOptions } from './view-fields';
import { boardCsvImport, boardCsvRows } from './board-csv';
import { formulaScopeOf } from './formula/references';
import { withInheritance } from './type-inheritance';
import { item } from './test-items';

// docs/specs/026-plan/item-types.md "Edit Field": Built-in fields, "Rename" and "Where the name shows".
const TASK: ItemTypeDef = {
  ...ITEM_TYPES.find((t) => t.id === 'task')!,
  fields: ['title', 'status', 'assignee', 'priority', 'estimate', 'start', 'due'],
};
const BUG: ItemTypeDef = { ...TASK, id: 'bug', label: 'Bug' };
const named = (t: ItemTypeDef, labels: ItemTypeDef['fieldLabels']): ItemTypeDef => ({
  ...t,
  fieldLabels: labels,
});

describe('the names a type gives its built-in fields', () => {
  it('names every built-in, and lets every one but Title be renamed', () => {
    expect(BUILT_IN_FIELD_NAMES.due).toBe('Due Date');
    expect(RENAMABLE_BUILT_INS).not.toContain('title');
    expect(isRenamableBuiltIn('estimate')).toBe(true);
    expect(isRenamableBuiltIn('title')).toBe(false);
    expect(isRenamableBuiltIn('f-x')).toBe(false);
    expect(FIELD_LABEL_MAX).toBe(CUSTOM_FIELD_LABEL_MAX);
  });

  it('keeps a name trimmed, drops a blank one or the built-in’s own, and drops the map when empty', () => {
    expect(fieldLabelsWith(undefined, 'estimate', '  Points ')).toEqual({ estimate: 'Points' });
    expect(fieldLabelsWith({ estimate: 'Points' }, 'due', 'Deadline')).toEqual({
      estimate: 'Points',
      due: 'Deadline',
    });
    expect(fieldLabelsWith({ estimate: 'Points' }, 'estimate', '')).toBeUndefined();
    expect(fieldLabelsWith({ estimate: 'Points' }, 'estimate', 'ESTIMATE')).toBeUndefined();
    expect(fieldLabelsWith(undefined, 'estimate', 'x'.repeat(40))).toEqual({
      estimate: 'x'.repeat(FIELD_LABEL_MAX),
    });
  });

  it('reads stored names, dropping a field the type lacks or the own name, refusing the rest', () => {
    const fields = ['title', 'status', 'estimate', 'due'];
    expect(readFieldLabels(undefined, fields)).toBeUndefined();
    expect(readFieldLabels({ estimate: ' Points ' }, fields)).toEqual({ estimate: 'Points' });
    expect(readFieldLabels({ assignee: 'Owner', due: 'due date' }, fields)).toBeUndefined();
    expect(readFieldLabels([], fields)).toBeNull();
    expect(readFieldLabels(null, fields)).toBeNull();
    expect(readFieldLabels('x', fields)).toBeNull();
    expect(readFieldLabels({ title: 'Name' }, fields)).toBeNull();
    expect(readFieldLabels({ estimate: 3 }, fields)).toBeNull();
    expect(readFieldLabels({ estimate: '  ' }, fields)).toBeNull();
    expect(readFieldLabels({ estimate: 'x'.repeat(33) }, fields)).toBeNull();
  });

  it('is stored on a type, refused when malformed, and inherited from a base', () => {
    const ok = validateItemTypeCatalogue({
      version: 1,
      types: [named(TASK, { estimate: 'Points', assignee: 'Assignee' })],
    });
    expect(ok.ok && ok.catalogue.types[0]!.fieldLabels).toEqual({ estimate: 'Points' });
    const bad = validateItemTypeCatalogue({
      version: 1,
      types: [{ ...TASK, fieldLabels: { estimate: '' } }],
    });
    expect(!bad.ok && bad.reason).toBe('types[0].fieldLabels');
    const heir: ItemTypeDef = {
      ...BUG,
      id: 'heir',
      label: 'Heir',
      inherits: 'task',
      ownFields: [],
    };
    const [, resolved] = withInheritance([named(TASK, { estimate: 'Points' }), heir]);
    expect(resolved!.fieldLabels).toEqual({ estimate: 'Points' });
  });
});

describe('one type and several', () => {
  const points = named(TASK, { estimate: 'Points', due: 'Deadline' });
  const alsoPoints = named(BUG, { estimate: 'Points' });

  it('names a field for one type as it names it, else by its own name or the fallback', () => {
    expect(typeFieldLabel(points, 'estimate')).toBe('Points');
    expect(typeFieldLabel(TASK, 'estimate')).toBe('Estimate');
    expect(typeFieldLabel(TASK, 'due', 'Due')).toBe('Due');
    expect(typeFieldLabel(undefined, 'f-x')).toBe('f-x');
  });

  it('gives several types’ name only when every type holding the field agrees', () => {
    expect(builtInFieldLabel('estimate', [points, alsoPoints])).toBe('Points');
    expect(builtInFieldLabel('due', [points, alsoPoints])).toBe('Due Date');
    expect(builtInFieldLabel('due', [points, alsoPoints], 'Due')).toBe('Due');
    expect(builtInFieldLabel('estimate', [points, named(BUG, { estimate: 'Size' })])).toBe(
      'Estimate',
    );
    // A type without the field has no say.
    const note = ITEM_TYPES.find((t) => t.id === 'note')!;
    expect(note.fields).not.toContain('estimate');
    expect(builtInFieldLabel('estimate', [points, note])).toBe('Points');
    expect(builtInFieldLabel('estimate', [])).toBe('Estimate');
    expect(builtInFieldLabel('f-x', [])).toBe('f-x');
  });

  it('memoises per types array, so a repeat read is a lookup', () => {
    const types = [points, alsoPoints];
    expect(builtInFieldLabel('estimate', types)).toBe('Points');
    expect(builtInFieldLabel('estimate', types, 'Other')).toBe('Points');
  });

  it('finds the built-in a type’s own name names, for an import', () => {
    expect(builtInIdOfName(' points ', [points])).toBe('estimate');
    expect(builtInIdOfName('Deadline', [TASK, points])).toBe('due');
    expect(builtInIdOfName('Nope', [points])).toBeUndefined();
    expect(builtInIdOfName('  ', [points])).toBeUndefined();
  });

  it('reads 10,000 names over 32 types within a CPU budget', () => {
    const types = Array.from({ length: 32 }, (_, i) =>
      named({ ...TASK, id: `t${i}` }, { estimate: 'Points' }),
    );
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 10_000; i += 1) builtInFieldLabel('estimate', types);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(20));
  });
});

describe('the places several types meet', () => {
  const points = named(TASK, {
    estimate: 'Points',
    start: 'Kickoff',
    assignee: 'Owner',
    priority: 'Urgency',
  });
  const types = [points];

  it('sorts, lanes and searches by the agreed name', () => {
    expect(boardSortFieldsOf(types).find((f) => f.id === 'estimate')?.label).toBe('Points');
    expect(boardSortFieldOf('estimate', types)?.label).toBe('Points');
    expect(boardSortFieldOf('createdAt', types)?.label).toBe('Created At');
    expect(laneFieldsOf(types).find((f) => f.id === 'estimate')?.label).toBe('Points');
    const card = item({ title: 'A', assignee: { id: 'p', name: 'P', color: '#000000' } });
    const fields = searchFields([card], [], types);
    expect(fields.find((f) => f.by === 'assignee')?.label).toBe('Owner');
    expect(fields.find((f) => f.by === 'type')?.label).toBe('Card Type');
  });

  it('names a view’s fields and title by the agreed name', () => {
    expect(viewDateOptions(types, 'start')[0]?.label).toBe('Kickoff');
    expect(viewMeasureOptions(types)[0]?.label).toBe('Points');
    expect(viewDateName(types, 'start')).toBe('Kickoff');
    expect(viewDateName(types, 'due')).toBe('Due');
    expect(breakdownTitle({ by: 'assignee', field: undefined }, types)).toBe('Cards by Owner');
    expect(breakdownTitle({ by: 'priority', field: undefined }, types)).toBe('Cards by Urgency');
    expect(breakdownTitle({ by: 'type', field: undefined }, types)).toBe('Cards by Type');
  });

  it('writes a CSV header by the agreed name and reads a column under either name', () => {
    const setup: PlanBoardSetup = {
      title: 'Board',
      columns: [{ id: 'c', status: 'todo', name: 'To Do' }],
      swimlaneBy: 'none',
      cardFields: [],
      hideWriting: false,
    };
    const card = item({ title: 'A', status: 'todo', estimate: 3 });
    const rows = boardCsvRows(setup, new Map([[card.id, card]]), types);
    expect(rows[0]).toContain('Points');
    expect(rows[0]).toContain('Kickoff');
    const imported = boardCsvImport(
      [
        ['Title', 'Points'],
        ['B', '5'],
      ],
      { setup, types, room: 10, people: [] },
    );
    expect(imported.creates[0]?.fields['estimate']).toBe(5);
    const byOwnName = boardCsvImport(
      [
        ['Title', 'Estimate'],
        ['B', '8'],
      ],
      { setup, types, room: 10, people: [] },
    );
    expect(byOwnName.creates[0]?.fields['estimate']).toBe(8);
  });

  it('writes a formula by the type’s name and still reads the built-in’s own', () => {
    const scope = formulaScopeOf(points);
    expect(scope.byId.get('estimate')?.name).toBe('Points');
    expect(scope.byName.get('points')).toBe('estimate');
    expect(scope.byName.get('estimate')).toBe('estimate');
    expect(scope.byName.get('start')).toBe('start');
  });
});

describe('an id that is no built-in', () => {
  // An agent's rule may name any id: one the prototype holds never reads as a name.
  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    '%s reads as itself',
    (id) => {
      const named: ItemTypeDef = { ...ITEM_TYPES[0], fieldLabels: { estimate: 'Points' } };
      expect(builtInFieldName(id)).toBeUndefined();
      expect(typeFieldLabel(named, id)).toBe(id);
      expect(typeFieldLabel(undefined, id)).toBe(id);
      expect(builtInFieldLabel(id, [named])).toBe(id);
    },
  );

  it('reads a built-in by its own name', () => {
    expect(builtInFieldName('due')).toBe('Due Date');
  });
});
