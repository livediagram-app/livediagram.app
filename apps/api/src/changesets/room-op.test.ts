import { describe, expect, it } from 'vitest';
import { CHANGESET_RELAY_MAX_BYTES } from '@livediagram/api-schema';
import type { Element, ElementOp } from '@livediagram/document';
import { agentKeyFor, changesetRoomOp } from './room-op';

// docs/specs/024-agents/agent-changesets.md "What the room does".
const box = (id: string, label = id): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, label }) as Element;
const base = {
  id: 'cs_0000000001',
  tabId: 't1',
  rev: 4,
  prevRev: 2,
  author: { name: 'Webber', color: '#0ea5e9' },
  summary: 'add payment service',
  counts: { added: 1, changed: 0, removed: 1 },
};

describe('changesetRoomOp', () => {
  it('carries the id, revision, author, summary, counts and element ops', () => {
    const elementOps: ElementOp[] = [
      { kind: 'add', element: box('n'), at: 0 },
      { kind: 'remove', id: 'r' },
    ];
    expect(changesetRoomOp({ ...base, elementOps, agentKey: 'abc123abc123' })).toEqual({
      kind: 'changeset',
      ...base,
      agentKey: 'abc123abc123',
      elementOps,
    });
  });

  it('asks editors to refetch, naming every touched id, when the ops pass the relay cap', () => {
    const big = box('n', 'x'.repeat(CHANGESET_RELAY_MAX_BYTES));
    const op = changesetRoomOp({
      ...base,
      elementOps: [
        { kind: 'add', element: big, at: 0 },
        { kind: 'remove', id: 'r' },
        { kind: 'reorder', ids: ['n'] },
      ],
    });
    expect(op).toMatchObject({ refetch: true, touched: ['n', 'r'] });
    expect(op.elementOps).toBeUndefined();
  });

  it("carries a created tab's fields and a revert's origin, and drops an empty summary", () => {
    const op = changesetRoomOp({
      ...base,
      summary: null,
      elementOps: [],
      tab: { id: 't1', name: 'Detail', theme: 'default' },
      revertOf: 'cs_0000000000',
    });
    expect(op).toMatchObject({ tab: { id: 't1', name: 'Detail' }, revertOf: 'cs_0000000000' });
    expect(op).not.toHaveProperty('summary');
  });
});

describe('agentKeyFor', () => {
  it('is the first 12 hex characters of a one-way digest of the token id', async () => {
    const key = await agentKeyFor('tok_1');
    expect(key).toMatch(/^[0-9a-f]{12}$/);
    expect(key).toBe(await agentKeyFor('tok_1'));
    expect(key).not.toBe(await agentKeyFor('tok_2'));
  });
});
