import { describe, expect, it } from 'vitest';
import { PLAN_COLUMN_NAME_MAX, PLAN_TITLE_MAX } from '@liveplanner/project';
import { planBoardCapIssue } from './plan-elements';

// docs/specs/024-agents/edit-operations.md "A board's caps hold for agents".
describe('planBoardCapIssue', () => {
  const board = (planBoard: unknown) => ({ type: 'shape', shape: 'plan-board', planBoard });

  it('names a title over its cap, then a column name over its cap', () => {
    expect(planBoardCapIssue(board({ title: 'y'.repeat(PLAN_TITLE_MAX + 1) }))).toEqual({
      field: 'planBoard',
      rule: `a board title is at most ${PLAN_TITLE_MAX} characters`,
    });
    const long = { id: 'c1', status: 'todo', name: 'z'.repeat(PLAN_COLUMN_NAME_MAX + 1) };
    expect(planBoardCapIssue(board({ title: 'Launch', columns: [long] }))).toEqual({
      field: 'planBoard',
      rule: `a column name is at most ${PLAN_COLUMN_NAME_MAX} characters`,
    });
  });

  it('passes anything at its caps, and leaves every other shape to the set-up checks', () => {
    const name = 'z'.repeat(PLAN_COLUMN_NAME_MAX);
    expect(
      planBoardCapIssue(
        board({
          title: 'y'.repeat(PLAN_TITLE_MAX),
          columns: [{ name }, null, 'todo', { name: 3 }],
        }),
      ),
    ).toBeNull();
    expect(planBoardCapIssue(board({ title: 7, columns: 'todo' }))).toBeNull();
    expect(planBoardCapIssue(board(null))).toBeNull();
    expect(planBoardCapIssue({ type: 'shape', shape: 'plan-view' })).toBeNull();
    expect(planBoardCapIssue(null)).toBeNull();
  });
});
