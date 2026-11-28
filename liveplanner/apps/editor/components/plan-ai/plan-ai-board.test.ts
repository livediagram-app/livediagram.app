import { describe, expect, it, vi } from 'vitest';
import { applyBoardChanges, type BoardActions } from './plan-ai-board';
import { ITEMS, SETUP, TYPES } from './plan-ai-fixtures';

// Plan AI on a board (docs/specs/026-plan/plan-ai.md "On a board").

function actions(over: Partial<BoardActions> = {}) {
  return {
    addItems: vi.fn(async () => true),
    moveItems: vi.fn(),
    patchItems: vi.fn(),
    trashItems: vi.fn((ids: readonly string[]) => ids.length),
    ...over,
  } satisfies BoardActions;
}

const run = (changes: Record<string, unknown>[], a = actions()) =>
  applyBoardChanges({
    setup: SETUP,
    items: ITEMS,
    types: TYPES,
    changes: changes as never,
    actions: a,
  });

describe('applyBoardChanges', () => {
  it('adds, changes, moves and trashes, each kind as one write and one undo step', async () => {
    const a = actions();
    const out = await run(
      [
        { op: 'add', title: 'Plan launch', status: 'Done', fields: { Size: 5 } },
        { op: 'add', type: 'Bug', fields: { title: 'Crash', Severity: 'High' } },
        { op: 'set', item: '#1', fields: { Priority: 'high' }, clear: ['Size'] },
        { op: 'move', item: '#1 Write brief', status: 'done' },
        { op: 'delete', item: '#2 Ship it' },
      ],
      a,
    );
    expect(out.lines.filter((l) => !l.ok)).toEqual([]);
    expect(out.lines.map((l) => l.text)).toEqual([
      'Added “Plan launch”',
      'Added “Crash”',
      expect.stringMatching(/^Changed .*Write brief$/),
      expect.stringMatching(/^Moved .*Write brief to Done$/),
      expect.stringMatching(/^Put .*Ship it in the Trash$/),
    ]);
    expect(out.steps).toBe(4);
    expect(a.addItems).toHaveBeenCalledWith([
      { type: 'task', fields: { 'f-size': 5, title: 'Plan launch' }, place: { status: 'done' } },
      {
        type: 'bug',
        fields: { title: 'Crash', 'f-sev': 'High' },
        place: { status: 'todo' },
      },
    ]);
    expect(a.moveItems).toHaveBeenCalledWith([{ id: 'i1', move: { status: 'done' } }]);
    expect(a.patchItems).toHaveBeenCalledWith([
      { id: 'i1', patch: { set: { priority: 'high' }, clear: ['f-size'] } },
    ]);
    expect(a.trashItems).toHaveBeenCalledWith(['i2']);
  });

  it('stops at the first change it cannot make and says why, making the ones before it', async () => {
    const a = actions();
    const out = await run(
      [
        { op: 'move', item: '#1', status: 'Done' },
        { op: 'move', item: '#1', status: 'Nowhere' },
        { op: 'delete', item: '#2' },
      ],
      a,
    );
    expect(out.lines.map((l) => l.ok)).toEqual([true, false]);
    expect(a.moveItems).toHaveBeenCalledTimes(1);
    expect(a.trashItems).not.toHaveBeenCalled();
    expect(out.steps).toBe(1);
  });

  it('refuses a card its type requires a field for, a trashed card, and an op a board does not take', async () => {
    expect((await run([{ op: 'add', type: 'Bug', title: 'Crash' }])).lines[0]).toMatchObject({
      ok: false,
      text: expect.stringContaining('Severity'),
    });
    expect((await run([{ op: 'move', item: '#3', status: 'Done' }])).lines[0]!.ok).toBe(false);
    expect((await run([{ op: 'resize_slot' }])).lines[0]).toEqual({
      ok: false,
      text: 'A board can’t take “resize_slot”.',
    });
    expect((await run([{ op: 'add', type: 'Epic' }])).lines[0]!.ok).toBe(false);
    expect((await run([{ op: 'set', item: '#1', fields: { Size: 'big' } }])).lines[0]!.ok).toBe(
      false,
    );
  });

  it('says so when the new cards could not be made, and counts no step for them', async () => {
    const out = await run(
      [{ op: 'add', title: 'X' }],
      actions({ addItems: vi.fn(async () => false) }),
    );
    expect(out.steps).toBe(0);
    expect(out.lines[1]).toEqual({ ok: false, text: 'The new cards couldn’t be made.' });
  });

  it('makes nothing where the board offers no write (a Viewer), and refuses a board with no types', async () => {
    const out = await run([{ op: 'move', item: '#1', status: 'Done' }], {
      trashItems: () => 0,
    } as BoardActions as ReturnType<typeof actions>);
    expect(out.steps).toBe(0);
    const none = await applyBoardChanges({
      setup: { ...SETUP, columns: [] },
      items: ITEMS,
      types: [],
      changes: [{ op: 'add', title: 'X' }],
      actions: actions(),
    });
    expect(none.lines[0]!.text).toContain('no card type');
  });
});
