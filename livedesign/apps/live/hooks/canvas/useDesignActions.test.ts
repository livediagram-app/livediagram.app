// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackMock = vi.fn<typeof import('@/lib/telemetry').track>();
const setFolderMock = vi.fn<typeof import('@/lib/api-client').apiSetDesignFolder>();
vi.mock('@/lib/telemetry', () => ({
  track: (...a: Parameters<typeof trackMock>) => trackMock(...a),
}));
vi.mock('@/lib/api-client', () => ({
  apiCopyDesign: vi.fn(),
  apiSetDesignFolder: (...a: Parameters<typeof setFolderMock>) => setFolderMock(...a),
}));
vi.mock('@/hooks/persistence/useDesignListActions', () => ({
  useDesignListActions: () => ({}),
}));
vi.mock('@/hooks/ui/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const { useDesignActions } = await import('./useDesignActions');

// The two hooks useDesignActions calls are mocked above; one render gives its actions.
function actions() {
  return renderHook(() =>
    useDesignActions({
      designId: null,
      designName: '',
      designList: [],
      setDesignList: vi.fn(),
      confirm: vi.fn() as never,
      ownerId: 'me',
      hookDeleteFolder: vi.fn(async () => true),
      folders: [],
      sharedDesigns: [],
      setSharedDesigns: vi.fn(),
      copying: false,
      setCopying: vi.fn(),
      sessionShareCode: null,
      refreshTeamLibraries: vi.fn(),
      refreshDesignList: vi.fn(),
    }),
  ).result.current;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

// docs/specs/017-telemetry/telemetry.md: Team·Added·Document counts a design ENTERING a team library,
// whichever surface filed it; Team·Moved·Document is every other scope move.
describe('moveDesignTo telemetry', () => {
  beforeEach(() => {
    trackMock.mockReset();
    setFolderMock.mockReset().mockResolvedValue(undefined);
  });

  it('counts a personal design filed into a team as Added', async () => {
    actions().moveDesignTo('d1', { teamId: 't1', folderId: null }, null);
    await flush();
    expect(trackMock).toHaveBeenCalledExactlyOnceWith('Team', 'Added', 'Design');
  });

  it('counts a move within or out of a team as Moved', async () => {
    actions().moveDesignTo('d1', { teamId: 't1', folderId: 'f1' }, 't1');
    actions().moveDesignTo('d1', { teamId: null, folderId: null }, 't1');
    // A caller that does not say where the design came from (team library rows).
    actions().moveDesignTo('d1', { teamId: 't2', folderId: null });
    await flush();
    expect(trackMock.mock.calls).toEqual([
      ['Team', 'Moved', 'Design'],
      ['Team', 'Moved', 'Design'],
      ['Team', 'Moved', 'Design'],
    ]);
  });

  it('counts nothing when the server refused the move', async () => {
    setFolderMock.mockRejectedValue(new Error('403'));
    actions().moveDesignTo('d1', { teamId: 't1', folderId: null }, null);
    await flush();
    expect(trackMock).not.toHaveBeenCalled();
  });
});
