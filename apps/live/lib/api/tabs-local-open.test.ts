import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setOfflineBackend, offlineGetRecord, offlinePutRecord } from '../offline/offline-store';
import { memBackend, testRecord } from '../offline/offline-test-utils';
import { apiLoadTab } from './tabs';

// A local document's open (docs/specs/013-workspace/blueprints/explorer-home-view.md "Local
// opens"): the editor's marked first-tab read counts it in this browser, as the server counts a
// cloud one; every other read of the same tab counts nothing, and nothing reaches the network.

describe('apiLoadTab on a document stored only in this browser', () => {
  beforeEach(async () => {
    __setOfflineBackend(memBackend());
    await offlinePutRecord(testRecord({ id: 'local-1' }));
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    __setOfflineBackend(null);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('counts a marked load as an open', async () => {
    const tab = await apiLoadTab('owner', 'local-1', 't1', null, { open: true });
    expect(tab?.id).toBe('t1');
    await vi.waitFor(async () =>
      expect((await offlineGetRecord('local-1'))?.opens?.openDays).toBe(1),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('counts nothing for an unmarked load', async () => {
    await apiLoadTab('owner', 'local-1', 't2', null);
    expect((await offlineGetRecord('local-1'))?.opens).toBeUndefined();
  });
});
