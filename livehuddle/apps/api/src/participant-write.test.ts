import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TabLedger } from '@livehuddle/document';

// A Participant's writes (docs/specs/013-workspace/share-roles.md "Integrity"): the participant content rule
// applied to what D1 holds, and a compare-and-swap that re-reads when another writer got to the row first.

const { db } = vi.hoisted(() => ({ db: { getTabRow: vi.fn(), swapTabData: vi.fn() } }));
vi.mock('./db', () => db);

import { TabTooLargeError } from './limits';
import { tabStatsOfData } from './db/tab-stats';
import {
  TAB_CAS_MAX_ATTEMPTS,
  writeParticipantAnswers,
  writeParticipantOp,
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
// A Door: its swing is the one field a Participant writes (docs/specs/013-workspace/share-roles.md "A Participant
// walks").
const door = (closed: boolean) => ({
  id: 'd1',
  type: 'shape',
  shape: 'door',
  ...box,
  doorClosed: closed,
});
const swing = (closed: boolean) => ({ kind: 'update', element: door(closed) });
const req = (op: unknown) => ({ documentId: 'd1', tabId: 't1', op: op as never, adderKey: ME });

// A stored row as the swap reads it: its body at a revision.
const row = (data: string | null) => (data === null ? null : { data, rev: 1, updatedAt: 1 });

beforeEach(() => {
  db.getTabRow.mockReset();
  db.swapTabData.mockReset();
  db.swapTabData.mockResolvedValue(true);
});

describe('writeParticipantOp', () => {
  it('applies the rule to the stored tab and swaps against what it read', async () => {
    const before = stored([sticky('s1'), door(true)], { theme: 'dusk' });
    db.getTabRow.mockResolvedValue(row(before));
    const out = await writeParticipantOp({} as never, req(swing(false)));
    expect(out).toMatchObject({ ok: true, outcome: { result: 'applied', changed: true } });
    const swap: unknown[] = db.swapTabData.mock.calls[0]!;
    const [, documentId, tabId, expected, next, body] = swap;
    expect([documentId, tabId, expected]).toEqual(['d1', 't1', row(before)]);
    // The body handed over is the one the next data serialises: its stats and references are read from it.
    expect(body).toEqual(JSON.parse(next as string));
    expect(tabStatsOfData(next as string).stats).toMatchObject({ elementCount: 2 });
    // The row keeps everything else it held, and never gains an id or a name.
    expect(JSON.parse(next as string)).toEqual({
      elements: [sticky('s1'), door(false)],
      theme: 'dusk',
    });
  });

  it('writes nothing for a refusal or a no-op', async () => {
    db.getTabRow.mockResolvedValue(row(stored([sticky('s1')])));
    const refused = await writeParticipantOp({} as never, req({ kind: 'remove', id: 's1' }));
    expect(refused).toMatchObject({ ok: true, outcome: { result: 'refused', reason: 'not-own' } });
    const added = await writeParticipantOp(
      {} as never,
      req({ kind: 'add', element: sticky('s2'), at: 1 }),
    );
    expect(added).toMatchObject({
      ok: true,
      outcome: { result: 'refused', reason: 'not-addable' },
    });
    const same = await writeParticipantOp(
      {} as never,
      req({ kind: 'update', element: sticky('s1', { rotation: 45 }) }),
    );
    expect(same).toMatchObject({ ok: true, outcome: { result: 'applied', changed: false } });
    expect(db.swapTabData).not.toHaveBeenCalled();
  });

  it('re-reads after a lost swap, then gives up with 409', async () => {
    db.getTabRow.mockResolvedValue(row(stored([door(true)])));
    db.swapTabData.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const op = req(swing(false));
    expect((await writeParticipantOp({} as never, op)).ok).toBe(true);
    expect(db.getTabRow).toHaveBeenCalledTimes(2);
    db.swapTabData.mockReset();
    db.swapTabData.mockResolvedValue(false);
    expect(await writeParticipantOp({} as never, op)).toEqual({ ok: false, status: 409 });
    expect(db.swapTabData).toHaveBeenCalledTimes(TAB_CAS_MAX_ATTEMPTS);
  });

  it('answers 404 for a missing tab and 413 for one over its cap', async () => {
    db.getTabRow.mockResolvedValue(row(null));
    const op = req(swing(false));
    expect(await writeParticipantOp({} as never, op)).toEqual({ ok: false, status: 404 });
    db.getTabRow.mockResolvedValue(row(stored([door(true)])));
    db.swapTabData.mockRejectedValue(new TabTooLargeError('t1', 3_000_000, 'swapTabData'));
    expect(await writeParticipantOp({} as never, op)).toEqual({ ok: false, status: 413 });
  });
});

describe('writeParticipantAnswers', () => {
  // A room's ledger may still hold a retired Vote's dots (docs/specs/002-project-scope/not-in-livehuddle.md "The
  // Vote"); with no reaction to write, nothing is written.
  const ledger: TabLedger = { elements: {} };

  it('writes nothing when the ledger holds no answers', async () => {
    db.getTabRow.mockResolvedValue(row(stored([sticky('s1')])));
    expect(
      await writeParticipantAnswers({} as never, { documentId: 'd1', tabId: 't1', ledger }),
    ).toEqual({ ok: true, changed: false });
    expect(db.swapTabData).not.toHaveBeenCalled();
  });
});
