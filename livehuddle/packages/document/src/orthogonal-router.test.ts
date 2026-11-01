import { describe, expect, it } from 'vitest';
import { ROUTER_SHARE_COST, routeOrthogonal, type Run } from './orthogonal-router';

// The router's price for sharing a run (docs/specs/015-api/mcp-server.md §4.7 "Loops and detours go round").
describe('routeOrthogonal sharing', () => {
  const straight = (runs: Run[]) =>
    routeOrthogonal({ x: 0, y: 0 }, 'e', { x: 200, y: 0 }, 'w', [], runs)!.cost;
  const alone = straight([]);

  it('prices a run on, or a few px beside, an earlier one as shared', () => {
    expect(straight([{ horizontal: true, at: 0, lo: 0, hi: 200 }])).toBe(alone + ROUTER_SHARE_COST);
    expect(straight([{ horizontal: true, at: 6, lo: 0, hi: 200 }])).toBe(alone + ROUTER_SHARE_COST);
    expect(straight([{ horizontal: true, at: 20, lo: 0, hi: 200 }])).toBe(alone);
  });

  it('prices a run on the same line ending a few px short of an earlier one as shared', () => {
    // The route is searched between its end stubs (x 18 to 182): an earlier run starting 6 px past that reads as the
    // same line.
    expect(straight([{ horizontal: true, at: 0, lo: 188, hi: 400 }])).toBe(
      alone + ROUTER_SHARE_COST,
    );
    expect(straight([{ horizontal: true, at: 0, lo: 260, hi: 400 }])).toBe(alone);
    // Across, not along: a vertical run never shares a horizontal one.
    expect(straight([{ horizontal: false, at: 100, lo: -50, hi: 50 }])).toBe(alone);
  });
});
