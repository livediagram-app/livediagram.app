import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setOfflineBackend } from '../offline/offline-store';
import { memBackend } from '../offline/offline-test-utils';

const index = vi.hoisted(() => ({ recordOpen: vi.fn(async () => {}) }));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({ indexClient: index }));

const { apiLoadTab } = await import('./tabs');
const { setWorkbenchConfinement } = await import('./workbench-confinement');

// An open of a cloud plan is the index's to record (tabs.ts `onOpen`), except in a workbench frame (Work Tracker 1138):
// its session is refused by the index (401), so a live embed's frame records nothing there.
describe('the first-tab read records an open', () => {
  beforeEach(() => {
    __setOfflineBackend(memBackend());
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ tab: { id: 't1', name: 'T', elements: [] } }, { headers: { ETag: '"1"' } }),
      ),
    );
  });
  afterEach(() => {
    __setOfflineBackend(null);
    setWorkbenchConfinement(null);
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('with the index for a plan opened in the editor', async () => {
    await apiLoadTab('owner', 'plan-1', 't1', null, { open: true });
    expect(index.recordOpen).toHaveBeenCalledExactlyOnceWith('plan-1', null);
  });

  it('nowhere for a workbench frame', async () => {
    setWorkbenchConfinement({ scope: 'project', projectId: 'plan-1', ownerId: 'o1' });
    await apiLoadTab('owner', 'plan-1', 't1', null, { open: true });
    expect(index.recordOpen).not.toHaveBeenCalled();
  });
});
