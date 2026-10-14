// ER relationships hub first (docs/specs/020-import-export/mermaid.md "Hub first").
import { describe, expect, it } from 'vitest';
import { hubFirst } from './er-hub-first';
import type { GraphEdge } from './graph-authoring';

const rel = (from: string, to: string): GraphEdge => ({
  from,
  to,
  ends: 'both',
  er: { from: 'one', to: 'zero-or-many' },
});

describe('hubFirst', () => {
  it('turns each cluster away from its own best-connected entity (the first declared on a tie), and leaves an unknown end alone', () => {
    const out = hubFirst(
      ['a', 'hub', 'b', 'c', 'x', 'y'],
      [rel('a', 'hub'), rel('b', 'hub'), rel('hub', 'c'), rel('y', 'x'), rel('ghost', 'c')],
    );
    expect(out.map((e) => `${e.from}>${e.to}`)).toEqual([
      'hub>a',
      'hub>b',
      'hub>c',
      'x>y',
      'ghost>c',
    ]);
    expect(out[0]!.er).toEqual({ from: 'zero-or-many', to: 'one' });
    expect(out[2]!.er).toEqual({ from: 'one', to: 'zero-or-many' });
  });
});
