import { describe, expect, it } from 'vitest';
import {
  boardNamesText,
  boardsShowing,
  boardsTaking,
  cardTargetProblem,
  targetColumns,
  type TargetBoard,
} from './card-target';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';

// Card targets (docs/specs/026-plan/items.md "Card targets"): what makes cards names a card type and a status, and
// the boards that show such a card are worked out from every board of the plan.

const types = [{ id: 'bug' }, { id: 'task' }];
const col = (status: string) => ({ status, name: status });
const bugs: TargetBoard & { columns: { status: string; name: string }[] } = {
  addTypes: ['bug'],
  columns: [col('new'), col('done')],
};
const tasks = { addTypes: ['task'], columns: [col('new'), col('doing')] };
const every = { columns: [col('later')] };
const archive = { archive: true, columns: [col('new')] };
const target = { typeId: 'bug', status: 'new' };

describe('boardsShowing', () => {
  it('lists the live boards with the column that take the type, in order', () => {
    expect(boardsShowing([tasks, bugs, every, archive], types, target)).toEqual([bugs]);
    // A board naming no types takes every type, once it has the column.
    expect(boardsShowing([every], types, { typeId: 'bug', status: 'later' })).toEqual([every]);
    expect(boardsShowing([tasks, every, archive], types, target)).toEqual([]);
  });

  it('reads a board whose named types are all deleted as taking every type, as the board does', () => {
    const orphaned = { addTypes: ['gone'], columns: [col('new')] };
    expect(boardsShowing([orphaned], types, target)).toEqual([orphaned]);
    expect(boardsShowing([{ addTypes: [], columns: [col('new')] }], types, target)).toEqual([]);
  });
});

describe('boardsTaking and targetColumns', () => {
  it('lists the boards that take a type, whatever their columns', () => {
    expect(boardsTaking([tasks, bugs, every, archive], types, 'bug')).toEqual([bugs, every]);
  });

  it('lists each column a type can be seen in once, in board then column order', () => {
    const more = { addTypes: ['bug'], columns: [col('done'), col('review')] };
    expect(targetColumns([tasks, bugs, more, archive], types, 'bug').map((c) => c.status)).toEqual([
      'new',
      'done',
      'review',
    ]);
    expect(targetColumns([tasks], types, 'bug')).toEqual([]);
  });
});

describe('cardTargetProblem', () => {
  it('holds while some board shows the card, whichever board it is', () => {
    expect(cardTargetProblem(target, [tasks, bugs], types)).toBeNull();
    expect(cardTargetProblem(target, [bugs], types)).toBeNull();
  });

  it('names why nobody would see the card', () => {
    expect(cardTargetProblem(target, [], types)).toBe('board_missing');
    expect(cardTargetProblem(target, [archive], types)).toBe('board_missing');
    expect(cardTargetProblem({ typeId: 'bug', status: 'gone' }, [bugs], types)).toBe(
      'status_missing',
    );
    expect(cardTargetProblem({ typeId: 'gone', status: 'new' }, [bugs], types)).toBe(
      'type_missing',
    );
    // The only board that showed the card deleted, its columns with it: a board for the type is what is missing.
    expect(cardTargetProblem({ typeId: 'bug', status: 'gone' }, [tasks], types)).toBe(
      'type_not_on_board',
    );
    // The column is on a board that leaves the type out, and the board taking the type lacks the column.
    expect(cardTargetProblem({ typeId: 'bug', status: 'doing' }, [tasks, bugs], types)).toBe(
      'type_not_on_board',
    );
  });

  // Judged on every response and every email: a plan at the board cap stays far inside a request.
  it('stays cheap for a plan of many boards', () => {
    const many = Array.from({ length: 500 }, (_, i) => ({
      addTypes: [i === 499 ? 'bug' : 'task'],
      columns: Array.from({ length: 30 }, (_, c) => col(c === 29 ? 'new' : `s${i}-${c}`)),
    }));
    const start = cpuNowMs();
    for (let i = 0; i < 200; i += 1) cardTargetProblem(target, many, types);
    expect(cpuNowMs() - start).toBeLessThan(cpuBudgetMs(400));
    expect(cardTargetProblem(target, many, types)).toBeNull();
  });
});

describe('boardNamesText', () => {
  it('joins the boards a card shows on in words', () => {
    expect(boardNamesText([])).toBe('');
    expect(boardNamesText(['Bugs'])).toBe('Bugs');
    expect(boardNamesText(['Bugs', 'Triage'])).toBe('Bugs and Triage');
    expect(boardNamesText(['Bugs', 'Triage', 'All Work'])).toBe('Bugs, Triage and All Work');
  });
});
