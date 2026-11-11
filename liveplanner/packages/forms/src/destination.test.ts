import { describe, expect, it } from 'vitest';
import type { ItemTypeDef, PlanBoardSetup } from '@liveplanner/items';
import {
  DESTINATION_PROBLEM_TEXT,
  columnForType,
  destinationProblem,
  destinationType,
  destinationWarning,
  destinationWarningText,
  sheetDestinationProblem,
  typeColumns,
  typeUsesStatus,
} from './destination';

const type = (id: string): ItemTypeDef => ({
  id,
  label: id,
  newTitle: `New ${id}`,
  glyph: 'task',
  color: '#2563eb',
  fields: ['title', 'status'],
});
const types = [type('bug'), type('task')];
const board = (extra: Partial<PlanBoardSetup> = {}): PlanBoardSetup => ({
  title: 'Bugs',
  columns: [
    { id: 'c1', status: 'new', name: 'New' },
    { id: 'c2', status: 'done', name: 'Done' },
  ],
  swimlaneBy: 'none',
  cardFields: [],
  hideWriting: false,
  ...extra,
});
const dest = { tabId: 't', typeId: 'bug', status: 'new' };

describe('destinationProblem', () => {
  it('holds while the board, column and type all do', () => {
    expect(destinationProblem(dest, [board()], types)).toBeNull();
    expect(destinationProblem(dest, [board({ addTypes: ['bug'] })], types)).toBeNull();
  });

  it('names what broke', () => {
    expect(destinationProblem(undefined, [board()], types)).toBe('no_destination');
    expect(destinationProblem(dest, [], types)).toBe('board_missing');
    expect(destinationProblem(dest, [board({ archive: true })], types)).toBe('board_missing');
    expect(destinationProblem({ ...dest, status: 'gone' }, [board()], types)).toBe(
      'status_missing',
    );
    expect(destinationProblem({ ...dest, typeId: 'gone' }, [board()], types)).toBe('type_missing');
    expect(destinationProblem(dest, [board({ addTypes: ['task'] })], types)).toBe(
      'type_not_on_board',
    );
  });

  it('has words for every problem', () => {
    for (const text of Object.values(DESTINATION_PROBLEM_TEXT)) expect(text).toMatch(/\.$/);
  });
});

describe('destinationType', () => {
  it('finds the type, or nothing', () => {
    expect(destinationType(dest, types)?.id).toBe('bug');
    expect(destinationType({ ...dest, typeId: 'x' }, types)).toBeUndefined();
    expect(destinationType(undefined, types)).toBeUndefined();
  });
});

describe('sheetDestinationProblem', () => {
  it('holds while its sheet is on its tab', () => {
    const at = { tabId: 't', sheetId: 'AbCdEf123456' };
    expect(sheetDestinationProblem(at, [at])).toBeNull();
    expect(sheetDestinationProblem(at, [{ ...at, tabId: 'u' }])).toBe('sheet_missing');
    expect(DESTINATION_PROBLEM_TEXT.sheet_missing).toMatch(/sheet was removed/);
  });
});

// Columns follow the card type (docs/specs/030-forms/forms.md "Columns follow the card type").
describe('columns a card type uses', () => {
  const work = { ...type('work'), label: 'Work Item', statuses: ['review', 'new'] };
  const legacy = { ...type('old'), excludedStatuses: ['done'] };
  const cols = board().columns;
  it('reads a listed type by its list and a legacy one by what it left out', () => {
    expect(typeUsesStatus(work, 'new')).toBe(true);
    expect(typeUsesStatus(work, 'done')).toBe(false);
    expect(typeUsesStatus(legacy, 'new')).toBe(true);
    expect(typeUsesStatus(legacy, 'done')).toBe(false);
    expect(typeUsesStatus(type('any'), 'done')).toBe(true);
  });

  it('offers only the columns the type uses, every one without a type', () => {
    expect(typeColumns(cols, work).map((c) => c.status)).toEqual(['new']);
    expect(typeColumns(cols, undefined)).toEqual(cols);
  });

  it('keeps a usable column, else takes the first the type uses', () => {
    expect(columnForType(cols, work, 'new')).toBe('new');
    expect(columnForType(cols, work, 'done')).toBe('new');
    expect(columnForType(cols, work, undefined)).toBe('new');
    expect(columnForType(cols, { statuses: ['review'] }, 'done')).toBe('done');
    expect(columnForType([], undefined, undefined)).toBeUndefined();
  });

  it('warns of a column the type leaves out, never of one it uses', () => {
    const boards = [board({ archive: true }), board()];
    expect(destinationWarning({ ...dest, status: 'done' }, boards, work)).toBe(
      'status_not_in_type',
    );
    expect(destinationWarning(dest, boards, work)).toBeNull();
    expect(destinationWarning(undefined, boards, work)).toBeNull();
    expect(destinationWarning(dest, boards, undefined)).toBeNull();
    expect(
      destinationWarning({ ...dest, status: 'done' }, boards, { ...work, statuses: ['review'] }),
    ).toBe('no_type_column');
    // A status no live board has is destinationProblem's to name.
    expect(destinationWarning({ ...dest, status: 'gone' }, boards, work)).toBeNull();
  });

  it('words each warning with the type and the board', () => {
    expect(destinationWarningText('status_not_in_type', 'Work Item', 'Bugs')).toBe(
      'Its column isn’t one of Work Item’s states, so its cards miss Work Item’s boards. Choose another column.',
    );
    expect(destinationWarningText('no_type_column', 'Work Item', 'Bugs')).toBe(
      'None of Bugs’s columns is a Work Item state. Add one to the board, or choose another board.',
    );
  });
});
