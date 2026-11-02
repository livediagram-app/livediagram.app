import { describe, expect, it } from 'vitest';
import type { ItemWrite } from '@liveplanner/items';
import type { SheetWrite } from '@liveplanner/sheets';
import { itemWriteMayWait, sheetOpMayWait } from './queue-roles';

// docs/specs/007-editor/offline-changes.md "Roles": an Editor's changes all wait, a Participant's only what it may
// write, a Viewer's never.

const writes: Record<ItemWrite['kind'], ItemWrite> = {
  create: { kind: 'create', creates: [{ type: 'task', fields: { title: 'A' } }] },
  patch: { kind: 'patch', id: 'a', patch: { set: { title: 'B' } } },
  patches: { kind: 'patches', patches: [{ id: 'a', patch: { set: { title: 'B' } } }] },
  move: { kind: 'move', id: 'a', move: { status: 'done' } },
  moves: { kind: 'moves', moves: [{ id: 'a', move: { status: 'done' } }] },
  time: { kind: 'time', id: 'a', field: 'spent', op: { kind: 'start', at: 1 } as never },
  tally: { kind: 'tally', tallies: [{ id: 'a', votes: { p: 1 } }] },
  delete: { kind: 'delete', id: 'a' },
};

const cells: SheetWrite = { kind: 'cells', cells: [] };
const layout: SheetWrite = { kind: 'layout', changes: [] };

describe('itemWriteMayWait', () => {
  it('Editor: every card write waits', () => {
    for (const w of Object.values(writes)) expect(itemWriteMayWait('edit', w), w.kind).toBe(true);
  });

  it('Participant: adding, editing, moving and time entries wait; a delete or a tally never', () => {
    const waits = Object.values(writes)
      .filter((w) => itemWriteMayWait('participate', w))
      .map((w) => w.kind);
    expect(waits).toEqual(['create', 'patch', 'patches', 'move', 'moves', 'time']);
  });

  it('Viewer: nothing waits', () => {
    for (const w of Object.values(writes)) expect(itemWriteMayWait('view', w), w.kind).toBe(false);
  });
});

describe('sheetOpMayWait', () => {
  const editor = { cells: true, shape: true };
  const participant = { cells: true, shape: false };
  const viewer = { cells: false, shape: false };

  it('Editor: cells, the sheet shape, new sheets and deletes wait', () => {
    expect(sheetOpMayWait(editor, 'write', cells)).toBe(true);
    expect(sheetOpMayWait(editor, 'write', layout)).toBe(true);
    expect(sheetOpMayWait(editor, 'create')).toBe(true);
    expect(sheetOpMayWait(editor, 'delete')).toBe(true);
  });

  it('Participant: only cell values wait', () => {
    expect(sheetOpMayWait(participant, 'write', cells)).toBe(true);
    expect(sheetOpMayWait(participant, 'write', layout)).toBe(false);
    expect(sheetOpMayWait(participant, 'write')).toBe(false);
    expect(sheetOpMayWait(participant, 'create')).toBe(false);
    expect(sheetOpMayWait(participant, 'delete')).toBe(false);
  });

  it('Viewer: nothing waits', () => {
    expect(sheetOpMayWait(viewer, 'write', cells)).toBe(false);
    expect(sheetOpMayWait(viewer, 'create')).toBe(false);
  });
});
