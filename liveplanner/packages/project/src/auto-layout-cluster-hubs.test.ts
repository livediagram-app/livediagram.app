import { describe, expect, it } from 'vitest';
import { layoutGraph, type GraphInput } from './graph-input';
import type { BoxedElement, Element } from './index';

// A platform of services over their stores (docs/specs/015-api/mcp-server.md "Groups keep their lines clear"): each
// store sits under its own service, and a bus every service publishes to goes to the end of its row.

const SERVICES = ['users', 'auth', 'search', 'cart', 'orders', 'payments'];

function platform(): GraphInput {
  return {
    direction: 'down',
    groups: [
      { id: 'services', label: 'Services' },
      { id: 'data', label: 'Data' },
      { id: 'external', label: 'External' },
    ],
    nodes: [
      { id: 'gw', label: 'API gateway' },
      ...SERVICES.map((s) => ({ id: s, label: `${s} service`, group: 'services' })),
      ...SERVICES.map((s) => ({
        id: `${s}-db`,
        label: `${s} DB (Postgres)`,
        shape: 'cylinder' as const,
        group: 'data',
      })),
      { id: 'kafka', label: 'Kafka event bus', shape: 'hexagon' as const, group: 'data' },
      { id: 'dw', label: 'Data warehouse', shape: 'cylinder' as const, group: 'data' },
      { id: 'stripe', label: 'Stripe', shape: 'cloud' as const, group: 'external' },
    ],
    edges: [
      { from: 'gw', to: 'services' },
      ...SERVICES.map((s) => ({ from: s, to: `${s}-db` })),
      ...SERVICES.map((s) => ({ from: s, to: 'kafka', line: 'dashed' as const })),
      { from: 'payments', to: 'stripe' },
      { from: 'orders', to: 'dw' },
    ],
  };
}

const boxOf = (els: Element[], id: string) => els.find((e) => e.id === id) as BoxedElement;
const midX = (b: BoxedElement) => b.x + b.width / 2;

describe('a row of stores under a row of services', () => {
  const els = layoutGraph(platform(), {
    makeEdgeId: (() => {
      let n = 0;
      return () => `e${n++}`;
    })(),
  });

  it('sits each store under its own service, a third party or a bus pulling none off', () => {
    for (const s of SERVICES.filter((x) => x !== 'orders'))
      expect(midX(boxOf(els, `${s}-db`)), s).toBe(midX(boxOf(els, s)));
  });

  it('puts the bus every service publishes to at the end of its row, not between a service and its store', () => {
    const row = els.filter(
      (e): e is BoxedElement =>
        (e.id.endsWith('-db') || e.id === 'kafka' || e.id === 'dw') && 'x' in e,
    );
    const last = row.reduce((a, b) => (midX(b) > midX(a) ? b : a));
    expect(last.id).toBe('kafka');
  });
});

describe('a group after a loop', () => {
  it('ranks a group below the step that feeds it, a retry loop before it notwithstanding', () => {
    const els = layoutGraph(
      {
        direction: 'down',
        groups: [{ id: 'notif', label: 'Notifications', members: ['email'] }],
        nodes: [
          { id: 'cart', label: 'Review cart' },
          { id: 'card', label: 'Enter card' },
          { id: 'ok', label: 'Paid?', shape: 'diamond' },
          { id: 'err', label: 'Show error' },
          { id: 'placed', label: 'Place order' },
          { id: 'email', label: 'Email receipt' },
        ],
        edges: [
          { from: 'cart', to: 'card' },
          { from: 'card', to: 'ok' },
          { from: 'ok', to: 'err', label: 'No' },
          { from: 'err', to: 'card', label: 'Retry' },
          { from: 'ok', to: 'placed', label: 'Yes' },
          { from: 'placed', to: 'email' },
        ],
      },
      {
        makeEdgeId: (() => {
          let n = 0;
          return () => `e${n++}`;
        })(),
      },
    );
    expect(boxOf(els, 'notif').y).toBeGreaterThan(boxOf(els, 'placed').y);
    expect(boxOf(els, 'card').y).toBeGreaterThan(boxOf(els, 'cart').y);
  });
});
