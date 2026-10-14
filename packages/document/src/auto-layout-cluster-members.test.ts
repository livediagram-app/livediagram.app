// A row of members seats by the outside nodes it links to (docs/specs/015-api/mcp-server.md "Groups keep their lines
// clear").
import { describe, expect, it } from 'vitest';
import { layoutClusteredGraph } from './auto-layout-clusters';
import type { BoxedElement, DiagramGraph, Element } from './index';

const ids = () => {
  let i = 0;
  return () => `edge-${++i}`;
};
const byId = (els: Element[], id: string) => els.find((e) => e.id === id) as BoxedElement;
const cx = (el: BoxedElement) => el.x + el.width / 2;
const inside = (frame: BoxedElement, el: BoxedElement) =>
  el.x >= frame.x && el.x + el.width <= frame.x + frame.width;

const graph = (storeEdges: DiagramGraph['edges']): DiagramGraph => ({
  nodes: [
    { id: 'gw', label: 'Gateway' },
    { id: 'a', label: 'Service A' },
    { id: 'b', label: 'Service B' },
    { id: 'c', label: 'Service C' },
    { id: 'adb', label: 'A DB', shape: 'cylinder' },
    { id: 'cdb', label: 'C DB', shape: 'cylinder' },
  ],
  edges: [{ from: 'gw', to: 'a' }, { from: 'gw', to: 'b' }, { from: 'gw', to: 'c' }, ...storeEdges],
  clusters: [
    { id: 'svc', label: 'Services', members: ['a', 'b', 'c'] },
    { id: 'data', label: 'Data stores', members: ['adb', 'cdb'] },
  ],
});

describe('a row of members seats by its outside nodes', () => {
  it('puts each store in a group under the service it belongs to, the frame refitted round them', () => {
    const els = layoutClusteredGraph(
      graph([
        { from: 'a', to: 'adb' },
        { from: 'c', to: 'cdb' },
      ]),
      { direction: 'TB', makeEdgeId: ids() },
    );
    for (const [store, owner] of [
      ['adb', 'a'],
      ['cdb', 'c'],
    ] as const)
      expect(Math.abs(cx(byId(els, store)) - cx(byId(els, owner)))).toBeLessThan(1);
    const frame = byId(els, 'data');
    expect(inside(frame, byId(els, 'adb')) && inside(frame, byId(els, 'cdb'))).toBe(true);
  });

  it('leaves a group with a line among its members as laid out', () => {
    const els = layoutClusteredGraph(
      graph([
        { from: 'a', to: 'adb' },
        { from: 'c', to: 'cdb' },
        { from: 'adb', to: 'cdb' },
      ]),
      { direction: 'TB', makeEdgeId: ids() },
    );
    expect(Math.abs(cx(byId(els, 'cdb')) - cx(byId(els, 'c')))).toBeGreaterThan(1);
  });
});
