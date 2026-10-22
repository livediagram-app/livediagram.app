import { describe, expect, it } from 'vitest';
import type { ItemTypeDef, PlanBoardSetup } from '@livepages/items';
import {
  DESTINATION_PROBLEM_TEXT,
  destinationProblem,
  destinationType,
  sheetDestinationProblem,
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
