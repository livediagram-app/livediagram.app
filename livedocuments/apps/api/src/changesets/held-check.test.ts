import { describe, expect, it } from 'vitest';
import { heldTargets } from './held-check';

// docs/specs/024-agents/agent-changesets.md "Held elements".
describe('heldTargets', () => {
  const bea = { elementIds: ['a', 'b'], name: 'Bea', color: '#f00', mine: false };
  const owner = { elementIds: ['c'], name: 'Webber', color: '#0ea5e9', mine: true };
  const cas = { elementIds: ['b'], name: 'Cas', color: '#0f0', mine: false };

  it('names each targeted element a person holds, and who', () => {
    expect(heldTargets(['a', 'b', 'x'], [bea, cas])).toEqual([
      { id: 'a', by: { name: 'Bea', color: '#f00' } },
      { id: 'b', by: { name: 'Bea', color: '#f00' } },
    ]);
  });

  it("never holds against the agent's own owner", () => {
    expect(heldTargets(['c'], [owner])).toEqual([]);
  });

  it('holds nothing when the room could not answer', () => {
    expect(heldTargets(['a'], null)).toEqual([]);
  });
});
