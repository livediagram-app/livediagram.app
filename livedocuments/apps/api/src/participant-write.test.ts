import { beforeEach, describe, expect, it, vi } from 'vitest';

// A Participant's writes (docs/specs/013-workspace/share-roles.md "Integrity"): the participant rules (text only)
// applied to what the document holds, and a compare-and-swap that re-reads when another writer got to the row first.

const { db } = vi.hoisted(() => ({ db: { getTabData: vi.fn(), swapTabData: vi.fn() } }));
vi.mock('./db', () => db);

import { TabTooLargeError } from './limits';
import { tabStatsOfData } from './db/tab-stats';
import {
  TAB_CAS_MAX_ATTEMPTS,
  writeParticipantArticle,
  writeParticipantOp,
} from './participant-write';

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
const req = (op: unknown) => ({ documentId: 'd1', tabId: 't1', op: op as never });

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
      req({ kind: 'update', element: sticky('s1', { label: 'Written' }) }),
    );
    expect(out).toMatchObject({ ok: true, outcome: { result: 'applied', changed: true } });
    const swap: unknown[] = db.swapTabData.mock.calls[0]!;
    const [, documentId, tabId, expected, next, stats] = swap;
    expect([documentId, tabId, expected]).toEqual(['d1', 't1', before]);
    // The stats handed over are the next body's, counted as every write counts them.
    expect(stats).toEqual(tabStatsOfData(next as string).stats);
    expect(stats).toMatchObject({ elementCount: 1 });
    // The row keeps everything else it held, and never gains an id or a name.
    expect(JSON.parse(next as string)).toEqual({
      elements: [sticky('s1', { label: 'Written' })],
      theme: 'dusk',
    });
  });

  it('writes nothing for a refusal or a no-op', async () => {
    db.getTabData.mockResolvedValue(stored([sticky('s1')]));
    const refused = await writeParticipantOp({} as never, req({ kind: 'remove', id: 's1' }));
    expect(refused).toMatchObject({
      ok: true,
      outcome: { result: 'refused', reason: 'not-removable' },
    });
    const same = await writeParticipantOp(
      {} as never,
      req({ kind: 'update', element: sticky('s1', { rotation: 45 }) }),
    );
    expect(same).toMatchObject({ ok: true, outcome: { result: 'applied', changed: false } });
    expect(db.swapTabData).not.toHaveBeenCalled();
  });

  it('re-reads after a lost swap, then gives up with 409', async () => {
    db.getTabData.mockResolvedValue(stored([sticky('n')]));
    db.swapTabData.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const op = req({ kind: 'update', element: sticky('n', { label: 'y' }) });
    expect((await writeParticipantOp({} as never, op)).ok).toBe(true);
    expect(db.getTabData).toHaveBeenCalledTimes(2);
    db.swapTabData.mockReset();
    db.swapTabData.mockResolvedValue(false);
    expect(await writeParticipantOp({} as never, op)).toEqual({ ok: false, status: 409 });
    expect(db.swapTabData).toHaveBeenCalledTimes(TAB_CAS_MAX_ATTEMPTS);
  });

  it('answers 404 for a missing tab and 413 for one over its cap', async () => {
    db.getTabData.mockResolvedValue(null);
    const op = req({ kind: 'update', element: sticky('n', { label: 'y' }) });
    expect(await writeParticipantOp({} as never, op)).toEqual({ ok: false, status: 404 });
    db.getTabData.mockResolvedValue(stored([sticky('n')]));
    db.swapTabData.mockRejectedValue(new TabTooLargeError('t1', 3_000_000, 'swapTabData'));
    expect(await writeParticipantOp({} as never, op)).toEqual({ ok: false, status: 413 });
  });
});

describe('writeParticipantArticle', () => {
  const article = (text: string) => ({
    blocks: [{ id: 'b1', type: 'paragraph', runs: [{ text }] }],
  });
  const tab = (text: string) =>
    stored([], {
      pages: [{ id: 'p1', kind: 'article', orientation: 'portrait', flow: 'f1' }],
      articles: { f1: article(text) },
    });
  const write = (ops: unknown[]) =>
    writeParticipantArticle({} as never, {
      documentId: 'd1',
      tabId: 't1',
      flow: 'f1',
      ops: ops as never,
    });

  it('writes the article on the stored tab', async () => {
    db.getTabData.mockResolvedValue(tab('Hello'));
    const out = await write([
      { kind: 'put', block: { id: 'b1', type: 'paragraph', runs: [{ text: 'Hello there' }] } },
    ]);
    expect(out).toMatchObject({ ok: true, outcome: { result: 'applied', changed: true } });
    const next = JSON.parse(db.swapTabData.mock.calls[0]![4] as string) as {
      articles: Record<string, unknown>;
    };
    expect(next.articles.f1).toEqual(article('Hello there'));
  });

  it('writes nothing for a change of style', async () => {
    db.getTabData.mockResolvedValue(tab('Hello'));
    const out = await write([{ kind: 'style', style: { look: 'bold' } }]);
    expect(out).toMatchObject({ ok: true, outcome: { result: 'refused', reason: 'not-writing' } });
    expect(db.swapTabData).not.toHaveBeenCalled();
  });
});
