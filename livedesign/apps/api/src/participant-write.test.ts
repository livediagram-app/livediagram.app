import { beforeEach, describe, expect, it, vi } from 'vitest';

// A Participant's writes (docs/specs/013-workspace/share-roles.md "Integrity"): the participant content rule
// applied to what D1 holds, and a compare-and-swap that re-reads when another writer got to the row first.

const { db } = vi.hoisted(() => ({ db: { getTabRow: vi.fn(), swapTabData: vi.fn() } }));
vi.mock('./db', () => db);

import { TabTooLargeError } from './limits';
import { tabStatsOfData } from './db/tab-stats';
import {
  TAB_CAS_MAX_ATTEMPTS,
  writeParticipantOp,
  writeParticipantReaction,
} from './participant-write';

const ME = 'a'.repeat(32);
const box = { x: 0, y: 0, width: 100, height: 80 };
const stored = (elements: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ elements, ...extra });
const sticky = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'sticky',
  ...box,
  label: 'x',
  ...extra,
});
const req = (op: unknown) => ({ designId: 'd1', tabId: 't1', op: op as never, adderKey: ME });

// A stored row as the swap reads it: its body at a revision.
const row = (data: string | null) => (data === null ? null : { data, rev: 1, updatedAt: 1 });

beforeEach(() => {
  db.getTabRow.mockReset();
  db.swapTabData.mockReset();
  db.swapTabData.mockResolvedValue(true);
});

describe('writeParticipantOp', () => {
  it('applies the rule to the stored tab and swaps against what it read', async () => {
    const before = stored([sticky('s1')], { theme: 'dusk' });
    db.getTabRow.mockResolvedValue(row(before));
    const out = await writeParticipantOp(
      {} as never,
      req({ kind: 'add', element: sticky('s2'), at: 1 }),
    );
    expect(out).toMatchObject({ ok: true, outcome: { result: 'applied', changed: true } });
    const swap: unknown[] = db.swapTabData.mock.calls[0]!;
    const [, designId, tabId, expected, next, body] = swap;
    expect([designId, tabId, expected]).toEqual(['d1', 't1', row(before)]);
    // The body handed over is the one the next data serialises: its stats and references are read from it.
    expect(body).toEqual(JSON.parse(next as string));
    expect(tabStatsOfData(next as string).stats).toMatchObject({ elementCount: 2 });
    // The row keeps everything else it held, and never gains an id or a name.
    expect(JSON.parse(next as string)).toEqual({
      elements: [sticky('s1'), { ...sticky('s2'), addedBy: ME }],
      theme: 'dusk',
    });
  });

  it('writes nothing for a refusal or a no-op', async () => {
    db.getTabRow.mockResolvedValue(row(stored([sticky('s1')])));
    const refused = await writeParticipantOp({} as never, req({ kind: 'remove', id: 's1' }));
    expect(refused).toMatchObject({ ok: true, outcome: { result: 'refused', reason: 'not-own' } });
    const same = await writeParticipantOp(
      {} as never,
      req({ kind: 'update', element: sticky('s1', { rotation: 45 }) }),
    );
    expect(same).toMatchObject({ ok: true, outcome: { result: 'applied', changed: false } });
    expect(db.swapTabData).not.toHaveBeenCalled();
  });

  it('re-reads after a lost swap, then gives up with 409', async () => {
    db.getTabRow.mockResolvedValue(row(stored([])));
    db.swapTabData.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const op = req({ kind: 'add', element: sticky('n'), at: 0 });
    expect((await writeParticipantOp({} as never, op)).ok).toBe(true);
    expect(db.getTabRow).toHaveBeenCalledTimes(2);
    db.swapTabData.mockReset();
    db.swapTabData.mockResolvedValue(false);
    expect(await writeParticipantOp({} as never, op)).toEqual({ ok: false, status: 409 });
    expect(db.swapTabData).toHaveBeenCalledTimes(TAB_CAS_MAX_ATTEMPTS);
  });

  it('answers 404 for a missing tab and 413 for one over its cap', async () => {
    db.getTabRow.mockResolvedValue(row(null));
    const op = req({ kind: 'add', element: sticky('n'), at: 0 });
    expect(await writeParticipantOp({} as never, op)).toEqual({ ok: false, status: 404 });
    db.getTabRow.mockResolvedValue(row(stored([])));
    db.swapTabData.mockRejectedValue(new TabTooLargeError('t1', 3_000_000, 'swapTabData'));
    expect(await writeParticipantOp({} as never, op)).toEqual({ ok: false, status: 413 });
  });
});

// docs/specs/012-collaboration/comment-reactions.md: a Participant's reaction, written by the room.
describe('writeParticipantReaction', () => {
  const comment = { id: 'c1', text: 'hi', createdAt: 1, authorName: 'Bea', authorColor: '#f00' };
  const withThread = sticky('s1', { commentThread: { comments: [comment], resolved: false } });
  const react = (elementId = 's1', commentId = 'c1') => ({
    designId: 'd1',
    tabId: 't1',
    elementId,
    delta: {
      kind: 'comment-react' as const,
      commentId,
      emoji: 'eyes' as const,
      by: 'k',
      name: 'Kim',
      on: true,
    },
  });

  it('applies the reaction to the stored element', async () => {
    db.getTabRow.mockResolvedValue(row(stored([sticky('s0'), withThread])));
    expect(await writeParticipantReaction({} as never, react())).toEqual({
      ok: true,
      changed: true,
    });
    const next = JSON.parse(db.swapTabData.mock.calls[0]![4] as string) as {
      elements: { commentThread: { comments: { reactions: unknown }[] } }[];
    };
    expect(next.elements[1]!.commentThread.comments[0]!.reactions).toEqual([
      { emoji: 'eyes', by: 'k', name: 'Kim' },
    ]);
  });

  it('writes nothing for a comment not stored yet, and passes a failure on', async () => {
    db.getTabRow.mockResolvedValue(row(stored([withThread])));
    expect(await writeParticipantReaction({} as never, react('s1', 'nope'))).toEqual({
      ok: true,
      changed: false,
    });
    expect(db.swapTabData).not.toHaveBeenCalled();
    db.getTabRow.mockResolvedValue(row(null));
    expect(await writeParticipantReaction({} as never, react())).toEqual({
      ok: false,
      status: 404,
    });
  });
});
