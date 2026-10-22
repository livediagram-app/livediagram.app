import { describe, expect, it, vi } from 'vitest';

const { apiSharedTabs } = vi.hoisted(() => ({ apiSharedTabs: vi.fn() }));
vi.mock('./api-client', () => ({ apiSharedTabs }));

import { fetchSharedTabsNotice, sharedTabsNotice } from './shared-tabs-notice';

// The sentence the delete and Take Offline confirmations add when a project
// shares tabs with others (docs/specs/006-project/tab-project-many-to-many.md,
// "Shared-tab notice").

describe('sharedTabsNotice', () => {
  it('says nothing when no tab is shared', () => {
    expect(sharedTabsNotice({ tabs: 0, projects: 0 }, 'delete')).toBeNull();
  });

  it('tells a delete which tabs stay, and where', () => {
    expect(sharedTabsNotice({ tabs: 3, projects: 2 }, 'delete')).toBe(
      '3\u00a0of its tabs are also used in 2 other projects; they stay there.',
    );
  });

  it('reads in the singular for one tab in one project', () => {
    expect(sharedTabsNotice({ tabs: 1, projects: 1 }, 'delete')).toBe(
      '1\u00a0of its tabs is also used in 1 other project; it stays there.',
    );
  });

  it('tells Take Offline the copies part ways', () => {
    expect(sharedTabsNotice({ tabs: 2, projects: 1 }, 'offline')).toBe(
      '2\u00a0of its tabs are also used in 1 other project; they stay there, and the copies in this browser no longer share edits with them.',
    );
    expect(sharedTabsNotice({ tabs: 1, projects: 3 }, 'offline')).toBe(
      '1\u00a0of its tabs is also used in 3 other projects; it stays there, and the copy in this browser no longer shares edits with it.',
    );
  });
});

describe('fetchSharedTabsNotice', () => {
  it('asks the api for the project and words the answer', async () => {
    apiSharedTabs.mockResolvedValueOnce({ tabs: 2, projects: 2 });

    const notice = await fetchSharedTabsNotice('owner', 'd1', 'delete');

    expect(apiSharedTabs).toHaveBeenCalledWith('owner', 'd1', expect.any(AbortSignal));
    expect(notice).toBe('2\u00a0of its tabs are also used in 2 other projects; they stay there.');
  });

  it('opens the confirmation without a notice when the read fails', async () => {
    // The data is safe either way (the server keeps shared tabs); the notice
    // is what it says, not what protects them. The api client reports the
    // failure itself.
    apiSharedTabs.mockRejectedValueOnce(new Error('offline'));

    expect(await fetchSharedTabsNotice('owner', 'd1', 'delete')).toBeNull();
  });

  it('has nothing to say for an offline project', async () => {
    apiSharedTabs.mockResolvedValueOnce(null);

    expect(await fetchSharedTabsNotice('owner', 'd1', 'offline')).toBeNull();
  });
});
