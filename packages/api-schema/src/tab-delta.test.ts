import { describe, expect, it } from 'vitest';
import {
  TAB_DELTA_MAX_OPS,
  elementsDigest,
  parseTabDelta,
  planTabDelta,
  type TabDeltaOp,
} from './tab-delta';

// The delta save's envelope (livediagram's docs/specs/006-document/blueprints/delta-saves.md).

type El = { id: string; label?: string };
const DIGEST = 'a'.repeat(64);
const good = { baseRev: 3, digest: DIGEST, ops: [], tab: { id: 't1', name: 'Board' } };

// A stand-in for a product's diffToElementOps: updates by id, in order.
const updates = (before: El[], after: El[]): TabDeltaOp<El>[] =>
  after
    .filter((e, i) => JSON.stringify(e) !== JSON.stringify(before[i]))
    .map((element) => ({ kind: 'update', element }));

describe('parseTabDelta', () => {
  it('reads a body with every op shape, and drops a tab.elements', () => {
    const ops = [
      { kind: 'add', element: { id: 'a', type: 'shape' }, at: 0 },
      { kind: 'update', element: { id: 'b' } },
      { kind: 'remove', id: 'c' },
      { kind: 'reorder', ids: ['b', 'a'] },
    ];
    expect(parseTabDelta({ ...good, ops, tab: { id: 't1', elements: [{ id: 'x' }] } })).toEqual({
      baseRev: 3,
      digest: DIGEST,
      ops,
      tab: { id: 't1' },
    });
  });

  it.each([
    [null, 'expected a JSON object'],
    [[], 'expected a JSON object'],
    [{ ...good, baseRev: -1 }, 'invalid baseRev'],
    [{ ...good, baseRev: 1.5 }, 'invalid baseRev'],
    [{ ...good, baseRev: '3' }, 'invalid baseRev'],
    [{ ...good, digest: 'A'.repeat(64) }, 'invalid digest'],
    [{ ...good, digest: 'a'.repeat(63) }, 'invalid digest'],
    [{ ...good, digest: 7 }, 'invalid digest'],
    [{ ...good, ops: {} }, 'invalid ops'],
    [{ ...good, ops: [null] }, 'invalid ops'],
    [{ ...good, ops: [{ kind: 'move' }] }, 'invalid ops'],
    [{ ...good, ops: [{ kind: 'add', element: { id: 'a' }, at: -1 }] }, 'invalid ops'],
    [{ ...good, ops: [{ kind: 'add', element: { id: 1 }, at: 0 }] }, 'invalid ops'],
    [{ ...good, ops: [{ kind: 'update', element: 'a' }] }, 'invalid ops'],
    [{ ...good, ops: [{ kind: 'remove', id: 1 }] }, 'invalid ops'],
    [{ ...good, ops: [{ kind: 'reorder', ids: 'ab' }] }, 'invalid ops'],
    [{ ...good, ops: [{ kind: 'reorder', ids: ['a', 2] }] }, 'invalid ops'],
    [{ ...good, tab: [] }, 'invalid tab'],
    [{ ...good, tab: null }, 'invalid tab'],
  ])('refuses %j with %s', (body, message) => {
    expect(parseTabDelta(body)).toBe(message);
  });
});

describe('elementsDigest', () => {
  it("is SHA-256, lowercase hex, of the elements' JSON", async () => {
    // sha256 of the UTF-8 bytes of [{"id":"a","label":"é"}], from Python's hashlib.
    expect(await elementsDigest([{ id: 'a', label: 'é' }])).toBe(
      '58724660d4085f4321e033cdd606578e4af4bd765c6d481e2f7a28bb2c169a19',
    );
  });
});

describe('planTabDelta', () => {
  const base = { rev: 4, elements: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] };
  const filler = 'x'.repeat(400);
  const big = (n: number): El[] =>
    Array.from({ length: n }, (_, i) => ({ id: `e${i}`, label: filler }));

  it('answers null without a base copy', async () => {
    expect(await planTabDelta({ base: null, tab: { elements: [] }, diff: updates })).toBeNull();
  });

  it('sends a small change as a delta with the digest of the elements as sent whole', async () => {
    const elements = big(20);
    const tab = {
      id: 't1',
      name: 'Board',
      elements: elements.map((e, i) => (i === 3 ? { ...e, label: 'new' } : e)),
    };
    const plan = await planTabDelta({ base: { rev: 4, elements }, tab, diff: updates });
    expect(plan).not.toBeNull();
    expect(plan!.ops).toBe(1);
    expect(plan!.digest).toBe(await elementsDigest(tab.elements));
    expect(JSON.parse(plan!.body)).toEqual({
      baseRev: 4,
      digest: plan!.digest,
      ops: [{ kind: 'update', element: { id: 'e3', label: 'new' } }],
      tab: { id: 't1', name: 'Board' },
    });
    expect(parseTabDelta(JSON.parse(plan!.body))).not.toBeTypeOf('string');
  });

  it('saves whole past the op cap', async () => {
    const elements = Array.from({ length: TAB_DELTA_MAX_OPS + 1 }, (_, i) => ({ id: `e${i}` }));
    const changed = elements.map((e) => ({ ...e, label: 'x'.repeat(5_000) }));
    // Past the cap whatever the share: the cap is checked first.
    expect(
      await planTabDelta({ base: { rev: 1, elements }, tab: { elements: changed }, diff: updates }),
    ).toBeNull();
  });

  it('saves whole when the delta is over half the elements', async () => {
    const changed = base.elements.map((e, i) => (i < 3 ? { ...e, label: 'changed' } : e));
    expect(await planTabDelta({ base, tab: { elements: changed }, diff: updates })).toBeNull();
  });
});
