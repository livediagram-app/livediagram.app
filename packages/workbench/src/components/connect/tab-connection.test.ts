// A connected tab's connection on an editor's own tab (connected-tabs.md "What a connected tab is"): read exactly, put
// on, carried from a summary, and the Connect list's Connected map.
import { describe, expect, it } from 'vitest';
import { carryConnection, connectedTargets, connectionOf, withConnection } from './tab-connection';

const A = { id: 'cn_aaaaaaaaaaaaaaaaaaaaaaaa', app: 'liveplanner', itemId: 'plan1' } as const;
const B = { id: 'cn_bbbbbbbbbbbbbbbbbbbbbbbb', app: 'livedocuments', itemId: 'doc1' } as const;

describe('connectionOf', () => {
  it('reads exactly the id, app and item, and nothing from a tab of content', () => {
    expect(connectionOf({ id: 't', connection: { ...A, code: 'secret' } })).toEqual(A);
    expect(connectionOf({ id: 't' })).toBeNull();
    expect(connectionOf({ id: 't', connection: { id: 'nope', app: 'x', itemId: 1 } })).toBeNull();
    expect(connectionOf(null)).toBeNull();
    expect(connectionOf(undefined)).toBeNull();
  });
});

describe('withConnection', () => {
  it('puts a clean copy of the connection on the tab, keeping the rest', () => {
    const tab = withConnection({ id: 't', name: 'Plan' }, { ...A, extra: 1 } as typeof A);
    expect(tab).toEqual({ id: 't', name: 'Plan', connection: A });
  });
});

describe('carryConnection', () => {
  const tab = { id: 't', name: 'Plan' };
  it("brings a summary's connection onto a tab", () => {
    expect(carryConnection(tab, { connection: A })).toEqual({ ...tab, connection: A });
  });
  it("leaves the tab's own when the summary carries none (an agent's rename relay)", () => {
    const held = withConnection(tab, A);
    expect(carryConnection(held, { name: 'Renamed' })).toBe(held);
    expect(carryConnection(tab, null)).toBe(tab);
  });
  it('keeps the same tab when the connection is the one it has, and swaps a new one in', () => {
    const held = withConnection(tab, A);
    expect(carryConnection(held, { connection: A })).toBe(held);
    expect(connectionOf(carryConnection(held, { connection: B }))).toEqual(B);
  });
});

describe('connectedTargets', () => {
  it('maps each target to the first tab holding it', () => {
    const map = connectedTargets([
      { id: 't1' },
      withConnection({ id: 't2' }, A),
      withConnection({ id: 't3' }, B),
      withConnection({ id: 't4' }, { ...A, id: 'cn_cccccccccccccccccccccccc' }),
    ]);
    expect([...map]).toEqual([
      ['plan1', 't2'],
      ['doc1', 't3'],
    ]);
  });
});
