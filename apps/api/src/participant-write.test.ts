import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TabLedger } from '@livediagram/document';

// A Participant's writes (docs/specs/013-workspace/share-roles.md "Integrity"): the participant content rule
// applied to what D1 holds, and a compare-and-swap that re-reads when another writer got to the row first.

const { db } = vi.hoisted(() => ({ db: { getTabData: vi.fn(), swapTabData: vi.fn() } }));
vi.mock('./db', () => db);

import { TabTooLargeError } from './limits';
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
const req = (op: unknown) => ({ documentId: 'd1', tabId: 't1', op: op as never, adderKey: ME });

beforeEach(() => {
  db.getTabData.mockReset();
  db.swapTabData.mockReset();
  db.swapTabData.mockResolvedValue(true);
});

describe('writeParticipantOp', () => {
  it('applies the rule to the stored tab and swaps against what it read', async () => {
    const before = stored([sticky('s1')], { theme: 'dusk' });
    db.getTabData.mockResolvedValue(before);
    const out = await writeParticipantOp(
      {} as never,
      req({ kind: 'add', element: sticky('s2'), at: 1 }),
    );
    expect(out).toMatchObject({ ok: true, outcome: { result: 'applied', changed: true } });
    const [, documentId, tabId, expected, next, count] = db.swapTabData.mock.calls[0]!;
    expect([documentId, tabId, expected, count]).toEqual(['d1', 't1', before, 2]);
    // The row keeps everything else it held, and never gains an id or a name.
    expect(JSON.parse(next as string)).toEqual({
      elements: [sticky('s1'), { ...sticky('s2'), addedBy: ME }],
      theme: 'dusk',
    });
  });

  it('writes nothing for a refusal or a no-op', async () => {
    db.getTabData.mockResolvedValue(stored([sticky('s1')]));
    const refused = await writeParticipantOp({} as never, req({ kind: 'remove', id: 's1' }));
    expect(refused).toMatchObject({ ok: true, outcome: { result: 'refused', reason: 'not-own' } });
    const same = await writeParticipantOp(
      {} as never,
      req({ kind: 'update', element: sticky('s1', { width: 5 }) }),
    );
    expect(same).toMatchObject({ ok: true, outcome: { result: 'applied', changed: false } });
    expect(db.swapTabData).not.toHaveBeenCalled();
  });

  it('re-reads after a lost swap, then gives up with 409', async () => {
    db.getTabData.mockResolvedValue(stored([]));
    db.swapTabData.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const op = req({ kind: 'add', element: sticky('n'), at: 0 });
    expect((await writeParticipantOp({} as never, op)).ok).toBe(true);
    expect(db.getTabData).toHaveBeenCalledTimes(2);
    db.swapTabData.mockReset();
    db.swapTabData.mockResolvedValue(false);
    expect(await writeParticipantOp({} as never, op)).toEqual({ ok: false, status: 409 });
    expect(db.swapTabData).toHaveBeenCalledTimes(TAB_CAS_MAX_ATTEMPTS);
  });

  it('answers 404 for a missing tab and 413 for one over its cap', async () => {
    db.getTabData.mockResolvedValue(null);
    const op = req({ kind: 'add', element: sticky('n'), at: 0 });
    expect(await writeParticipantOp({} as never, op)).toEqual({ ok: false, status: 404 });
    db.getTabData.mockResolvedValue(stored([]));
    db.swapTabData.mockRejectedValue(new TabTooLargeError('t1', 3_000_000, 'swapTabData'));
    expect(await writeParticipantOp({} as never, op)).toEqual({ ok: false, status: 413 });
  });
});

describe('writeParticipantAnswers', () => {
  const ledger: TabLedger = {
    vote: { round: 'r1', votes: { s1: ['k1'] }, seq: 3 },
    elements: {},
  };
  const vote = { active: true, revealed: false, votesPerPerson: 3, votes: {}, round: 'r1' };

  it("folds the room's dots into the stored tab", async () => {
    db.getTabData.mockResolvedValue(stored([sticky('s1')], { vote }));
    expect(
      await writeParticipantAnswers({} as never, { documentId: 'd1', tabId: 't1', ledger }),
    ).toEqual({ ok: true, changed: true });
    expect(JSON.parse(db.swapTabData.mock.calls[0]![4] as string).vote.votes).toEqual({
      s1: ['k1'],
    });
  });

  it('writes nothing when the row already holds them', async () => {
    db.getTabData.mockResolvedValue(
      stored([sticky('s1')], { vote: { ...vote, votes: { s1: ['k1'] } } }),
    );
    expect(
      await writeParticipantAnswers({} as never, { documentId: 'd1', tabId: 't1', ledger }),
    ).toEqual({ ok: true, changed: false });
    expect(db.swapTabData).not.toHaveBeenCalled();
  });
});
