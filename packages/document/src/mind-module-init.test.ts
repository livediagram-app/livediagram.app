import { describe, expect, it, vi } from 'vitest';
// Transformed once at collection; the test still evaluates a fresh registry from mind-flow, and
// no longer pays the package's cold transform inside its timeout.
import './index';

// mind-flow reaches the barrel (via anchor-choice -> geometry -> index), and the barrel re-exports
// mind-layout, so a bundler that enters the package at mind-flow evaluates mind-layout while
// mind-flow's constants are still uninitialised. Nothing in that cycle may read them at module init:
// webpack throws a ReferenceError, other runners hand back NaN.
describe('mind modules', () => {
  it('initialise their gaps when mind-flow is the entry point', async () => {
    vi.resetModules();
    await import('./mind-flow');
    const liveDoc = await import('./index');

    expect(liveDoc.MIND_CHILD_GAP_Y).toBe(
      liveDoc.MIND_SIBLING_GAP_Y + liveDoc.MIND_CHILD_GAP_X / 2,
    );
  });
});
