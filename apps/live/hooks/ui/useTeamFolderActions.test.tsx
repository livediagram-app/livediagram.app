// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackMock = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...args: unknown[]) => trackMock(...args) }));

const api = vi.hoisted(() => ({
  apiCreateFolder: vi.fn(),
  apiUpdateFolder: vi.fn(),
  apiDeleteFolder: vi.fn(),
}));
vi.mock('@/lib/api-client', () => api);

import { useTeamFolderActions } from './useTeamFolderActions';

// Team-library folder verbs from the Explorer panel (spec/35). spec/22's Folder
// entry types a team folder `Team`; without it these three read as personal
// Explorer folders on the dashboard.
function handlers() {
  const { result } = renderHook(() =>
    useTeamFolderActions({
      clerkUserId: 'user_1',
      viewerId: 'user_1',
      teamFolders: [{ id: 'f1', name: 'Specs' } as never],
      refreshTeamLibraries: () => {},
      confirm: (async () => true) as never,
    }),
  );
  return result.current!;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  trackMock.mockReset();
  api.apiCreateFolder.mockReset().mockResolvedValue({ id: 'f2', name: 'New folder' });
  api.apiUpdateFolder.mockReset().mockResolvedValue(undefined);
  api.apiDeleteFolder.mockReset().mockResolvedValue(undefined);
});

describe('useTeamFolderActions telemetry', () => {
  it('types create, rename and delete as Team', async () => {
    const h = handlers();
    await h.create('team_1', null);
    h.rename('f1', 'Renamed');
    h.delete('f1');
    await settle();
    await settle();
    expect(trackMock.mock.calls).toEqual([
      ['Folder', 'Created', 'Team'],
      ['Folder', 'Renamed', 'Team'],
      ['Folder', 'Deleted', 'Team'],
    ]);
  });

  it('reports nothing when the server refuses', async () => {
    api.apiCreateFolder.mockRejectedValue(new Error('403'));
    api.apiUpdateFolder.mockRejectedValue(new Error('403'));
    const h = handlers();
    await h.create('team_1', null);
    h.rename('f1', 'Renamed');
    await settle();
    expect(trackMock).not.toHaveBeenCalled();
  });
});
