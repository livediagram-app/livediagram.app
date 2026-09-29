import { describe, expect, it, vi } from 'vitest';

// mind-flow reaches the barrel (via anchor-choice -> geometry -> index), and the barrel re-exports
// mind-layout, so a bundler that enters the package at mind-flow evaluates mind-layout while
// mind-flow's constants are still uninitialised. Nothing in that cycle may read them at module init:
// webpack throws a ReferenceError, other runners hand back NaN.
describe('mind modules', () => {
  it('initialise their gaps when mind-flow is the entry point', async () => {
    vi.resetModules();
    await import('./mind-flow');
    const diagram = await import('./index');

    expect(diagram.MIND_CHILD_GAP_Y).toBe(
      diagram.MIND_SIBLING_GAP_Y + diagram.MIND_CHILD_GAP_X / 2,
    );
  });
});
