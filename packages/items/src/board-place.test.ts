import { describe, expect, it } from 'vitest';
import { PLACED_BOARD_GAP, PLACED_BOARD_WIDTH, placeBoard, reshapeBoard } from './board-place';
import { PLAN_BOARD_EMPTY_HEIGHT_PX, PLAN_BOARD_HEIGHT_PX, planBoardHeightFor } from './board';
import { presetSetup } from './presets';

const fixed = () => 0.5;
const existing = [{ status: 'done~old1', name: 'Done' }];

describe('placeBoard', () => {
  it('places a kanban by default, right of the tab, reusing a status of the same name', () => {
    const elements = [
      { id: 'a', x: 10, y: 50, width: 200, height: 100 },
      { id: 'b', x: 300, y: -20, width: 100, height: 40 },
      { id: 'arrow' },
    ];
    const r = placeBoard({}, elements, existing, 'b1', fixed);
    if (!r.ok) throw new Error(r.message);
    expect(r.board).toMatchObject({
      id: 'b1',
      shape: 'plan-board',
      x: 400 + PLACED_BOARD_GAP,
      y: -20,
      height: PLAN_BOARD_HEIGHT_PX,
    });
    expect(r.board.width).toBeGreaterThanOrEqual(PLACED_BOARD_WIDTH);
    const names = r.board.planBoard.columns.map((c) => c.name);
    expect(names).toEqual(presetSetup('kanban').columns.map((c) => c.name));
    const done = r.board.planBoard.columns.find((c) => c.name === 'Done')!;
    expect(done.status).toBe('done~old1');
    expect(
      r.board.planBoard.columns
        .filter((c) => c.name !== 'Done')
        .every((c) => c.status.includes('~')),
    ).toBe(true);
  });

  it('builds columns by name, a title and card types, at the origin of an empty tab', () => {
    const r = placeBoard(
      { columns: ['Ideas', 'done', 'Shipped'], title: 'Roadmap', types: ['project'] },
      [],
      existing,
      'b2',
      fixed,
    );
    if (!r.ok) throw new Error(r.message);
    expect(r.board).toMatchObject({ x: 0, y: 0 });
    expect(r.board.planBoard).toMatchObject({ title: 'Roadmap', addTypes: ['project'] });
    expect(r.board.planBoard.doneColumnId).toBeUndefined();
    expect(r.board.planBoard.columns).toEqual([
      { id: 'ideas', status: 'ideas~iiii', name: 'Ideas' },
      { id: 'done', status: 'done~old1', name: 'done' },
      { id: 'shipped', status: 'shipped~iiii', name: 'Shipped' },
    ]);
  });

  it('refuses an unknown preset, bad columns and a bad title', () => {
    expect(placeBoard({ preset: 'scrum' }, [], [], 'x')).toMatchObject({
      ok: false,
      code: 'board_invalid',
    });
    expect(placeBoard({ columns: [] }, [], [], 'x')).toMatchObject({ ok: false });
    expect(placeBoard({ columns: ['A', 'a'] }, [], [], 'x')).toMatchObject({ ok: false });
    expect(placeBoard({ columns: [' '] }, [], [], 'x')).toMatchObject({ ok: false });
    expect(placeBoard({ title: '' }, [], [], 'x')).toMatchObject({ ok: false });
  });
});

describe('reshapeBoard', () => {
  const setup = {
    ...presetSetup('kanban'),
    columns: [
      { id: 'todo', status: 'todo~b', name: 'To Do', wipLimit: 4 },
      { id: 'done', status: 'done~b', name: 'Done' },
    ],
    doneColumnId: 'done',
    addTypes: ['task'],
  };
  const others = [{ status: 'review~z', name: 'Review' }];

  it('keeps a column by name, shares a status by name, makes the rest, and keeps the done column', () => {
    const r = reshapeBoard(setup, { columns: ['to do', 'Review', 'QA', 'Done'] }, others, fixed);
    if (!r.ok) throw new Error(r.message);
    expect(r.setup.columns).toEqual([
      { id: 'todo', status: 'todo~b', name: 'To Do', wipLimit: 4 },
      { id: 'review', status: 'review~z', name: 'Review' },
      { id: 'qa', status: 'qa~iiii', name: 'QA' },
      { id: 'done', status: 'done~b', name: 'Done' },
    ]);
    expect(r.setup.doneColumnId).toBe('done');
    const dropped = reshapeBoard(setup, { columns: ['To Do'] }, others, fixed);
    expect(dropped.ok && dropped.setup.doneColumnId).toBeUndefined();
  });

  it('never gives two columns one id, a kept column keeping its own', () => {
    // Kanban's "In Progress" has the id `doing`; a new "Doing" column slugs to the same id.
    const kanban = presetSetup('kanban');
    const r = reshapeBoard(kanban, { columns: ['In Progress', 'Doing', 'Doing 2'] }, [], fixed);
    if (!r.ok) throw new Error(r.message);
    const ids = r.setup.columns.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(r.setup.columns[0]).toBe(kanban.columns.find((c) => c.name === 'In Progress'));
    expect(ids).toEqual(['doing', 'doing-2', 'doing-2-2']);
  });

  it('sets a title and card types, or every type again', () => {
    const r = reshapeBoard(setup, { title: 'Sprint 15', types: ['task', 'bug'] }, others);
    expect(r).toMatchObject({ ok: true, setup: { title: 'Sprint 15', addTypes: ['task', 'bug'] } });
    const every = reshapeBoard(setup, { types: null }, others);
    expect(every.ok && every.setup.addTypes).toBeUndefined();
    // An empty list takes none, as the editor's last type turned off does; it never reads as every type.
    const none = reshapeBoard(setup, { types: [] }, others);
    expect(none.ok && none.setup.addTypes).toEqual([]);
    expect(reshapeBoard(setup, { title: ' ' }, others)).toMatchObject({ ok: false });
    expect(reshapeBoard(setup, { columns: [] }, others)).toMatchObject({ ok: false });
  });
});

describe('planBoardHeightFor', () => {
  it('starts an empty board, waiting for Setup Board, taller than one with columns', () => {
    expect(planBoardHeightFor(presetSetup('blank'))).toBe(PLAN_BOARD_EMPTY_HEIGHT_PX);
    expect(planBoardHeightFor(presetSetup('kanban'))).toBe(PLAN_BOARD_HEIGHT_PX);
    expect(PLAN_BOARD_EMPTY_HEIGHT_PX).toBeGreaterThan(PLAN_BOARD_HEIGHT_PX);
  });
});
