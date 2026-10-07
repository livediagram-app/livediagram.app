import { describe, expect, it } from 'vitest';
import { PLAN_COLUMNS_MAX, type PlanBoardSetup } from '@livediagram/items';
import {
  addStatusColumn,
  addStatusColumns,
  matchStatus,
  missingStatuses,
  statusKey,
} from './column-status-picks';

// docs/specs/026-plan/plan-board.md "The column picker".
const board = (columns: { status: string; name: string }[]) =>
  ({
    title: 'B',
    columns: columns.map((c) => ({ id: c.status, ...c })),
  }) as unknown as PlanBoardSetup;

const doc = new Map([
  ['todo', 'To do'],
  ['doing', 'Doing'],
  ['done', 'Done'],
  ['todo~x9', 'TO  DO'],
  ['review', 'Review'],
]);

describe('the column picker', () => {
  it('compares names ignoring case, spacing and punctuation', () => {
    expect(statusKey('To do')).toBe(statusKey('to-do'));
    expect(statusKey('TO  DO')).toBe('todo');
  });

  it('matches names in any script, never dropping them', () => {
    expect(statusKey('完成')).toBe('完成');
    expect(statusKey('Готово')).toBe(statusKey('готово'));
    expect(statusKey('Erledigt ✓')).toBe('erledigt');
    expect(matchStatus('готово', { columns: [] }, new Map([['ready', 'Готово']]))).toMatchObject({
      kind: 'existing',
    });
  });

  it('offers the statuses the board lacks, one per name, in the document’s order', () => {
    const picks = missingStatuses(board([{ status: 'doing', name: 'Doing' }]), doc);
    expect(picks).toEqual([
      { status: 'todo', name: 'To do' },
      { status: 'done', name: 'Done' },
      { status: 'review', name: 'Review' },
    ]);
  });

  it('matches a typed name to an existing status, or to a column the board has', () => {
    const b = board([{ status: 'doing', name: 'Doing' }]);
    expect(matchStatus('to-do', b, doc)).toEqual({
      kind: 'existing',
      pick: { status: 'todo', name: 'To do' },
    });
    expect(matchStatus(' doing ', b, doc)).toEqual({ kind: 'on-board', name: 'Doing' });
    expect(matchStatus('Blocked', b, doc)).toEqual({ kind: 'new' });
    expect(matchStatus('  ', b, doc)).toEqual({ kind: 'new' });
  });

  it('adds a column that keeps the existing status, after a column or at the end', () => {
    const b = board([
      { status: 'a', name: 'A' },
      { status: 'b', name: 'B' },
    ]);
    const added = addStatusColumn(b, 'a', { status: 'done', name: 'Done' })!;
    expect(added.setup.columns.map((c) => c.status)).toEqual(['a', 'done', 'b']);
    expect(added.column).toEqual({ id: 'done', status: 'done', name: 'Done' });
    expect(addStatusColumn(added.setup, null, { status: 'done', name: 'Done' })).toBeNull();
  });

  it('adds them all, in order, stopping at the column limit', () => {
    const b = board([{ status: 'a', name: 'A' }]);
    const all = addStatusColumns(b, null, missingStatuses(b, doc));
    expect(all.columns.map((c) => c.status)).toEqual(['a', 'todo', 'doing', 'done', 'review']);
    const many = new Map(
      Array.from({ length: 20 }, (_, i) => [`s${i}`, `S${i}`] as [string, string]),
    );
    expect(addStatusColumns(b, null, missingStatuses(b, many)).columns).toHaveLength(
      PLAN_COLUMNS_MAX,
    );
  });
});
