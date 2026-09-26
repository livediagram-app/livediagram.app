import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QaNote } from '@livediagram/diagram';

// One board write (docs/specs/012-collaboration/qa-board.md): the reducer applied to what D1 holds, the rev
// bumped, and a compare-and-swap that re-reads when another writer (an
// editor's tab autosave) got to the row first.

const { db } = vi.hoisted(() => ({ db: { getTabData: vi.fn(), swapTabData: vi.fn() } }));
vi.mock('./db', () => db);

import { writeQaAction, type QaWriteRequest } from './qa-board-write';

const boardData = (notes: QaNote[] = [], rev = 0, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    elements: [
      {
        id: 'b1',
        type: 'shape',
        shape: 'qa-board',
        x: 0,
        y: 0,
        width: 360,
        height: 460,
        label: 'Q',
        qaNotes: notes,
        qaRev: rev,
        ...extra,
      },
    ],
  });

const req = (action: QaWriteRequest['action'], voterId = 'v1'): QaWriteRequest => ({
  diagramId: 'd1',
  tabId: 't1',
  elementId: 'b1',
  action,
  actor: { voterId, author: null, now: 10 },
});

beforeEach(() => {
  db.getTabData.mockReset();
  db.swapTabData.mockReset();
  db.swapTabData.mockResolvedValue(true);
});

describe('writeQaAction', () => {
  it('applies the action, bumps the rev and swaps against what it read', async () => {
    const before = boardData([{ id: 'n1', text: 'a', at: 1, voters: [] }], 3);
    db.getTabData.mockResolvedValue(before);
    const out = await writeQaAction({} as never, req({ type: 'vote', noteId: 'n1', on: true }));
    expect(out).toEqual({
      ok: true,
      changed: true,
      notes: [{ id: 'n1', text: 'a', at: 1, voters: ['v1'] }],
      rev: 4,
    });
    expect(db.swapTabData.mock.calls[0]!.slice(1, 4)).toEqual(['d1', 't1', before]);
  });

  it('writes nothing for an action that changes nothing', async () => {
    db.getTabData.mockResolvedValue(boardData([{ id: 'n1', text: 'a', at: 1, voters: ['v1'] }], 3));
    const out = await writeQaAction({} as never, req({ type: 'vote', noteId: 'n1', on: true }));
    expect(out).toMatchObject({ ok: true, changed: false, rev: 3 });
    expect(db.swapTabData).not.toHaveBeenCalled();
  });

  // The other writer of the row: an editor's autosave landed between our read
  // and our write (the board moved). The swap fails, we re-read, and BOTH the
  // move and the vote survive.
  it('re-reads when an autosave got to the row first, keeping both writes', async () => {
    const first = boardData([{ id: 'n1', text: 'a', at: 1, voters: [] }], 0);
    const moved = boardData([{ id: 'n1', text: 'a', at: 1, voters: [] }], 0, { x: 500 });
    db.getTabData.mockResolvedValueOnce(first).mockResolvedValueOnce(moved);
    db.swapTabData.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const out = await writeQaAction({} as never, req({ type: 'vote', noteId: 'n1', on: true }));
    expect(out).toMatchObject({ ok: true, rev: 1 });
    const written = JSON.parse(db.swapTabData.mock.calls[1]![4] as string);
    expect(written.elements[0]).toMatchObject({ x: 500, qaRev: 1 });
    expect(written.elements[0].qaNotes[0].voters).toEqual(['v1']);
  });

  it('gives up with a 409 rather than looping forever', async () => {
    db.getTabData.mockResolvedValue(boardData());
    db.swapTabData.mockResolvedValue(false);
    const out = await writeQaAction(
      {} as never,
      req({ type: 'add', id: 'n', text: 'x', anonymous: true }),
    );
    expect(out).toEqual({ ok: false, status: 409 });
  });

  it('404s a missing tab or board', async () => {
    db.getTabData.mockResolvedValueOnce(null);
    expect(await writeQaAction({} as never, req({ type: 'clear' }))).toEqual({
      ok: false,
      status: 404,
    });
    db.getTabData.mockResolvedValueOnce(JSON.stringify({ elements: [] }));
    expect(await writeQaAction({} as never, req({ type: 'clear' }))).toEqual({
      ok: false,
      status: 404,
    });
  });
});
