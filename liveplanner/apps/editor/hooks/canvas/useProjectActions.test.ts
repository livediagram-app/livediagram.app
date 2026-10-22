// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackMock = vi.fn<typeof import('@/lib/telemetry').track>();
const setFolderMock = vi.fn<typeof import('@/lib/api-client').apiSetProjectFolder>();
vi.mock('@/lib/telemetry', () => ({
  track: (...a: Parameters<typeof trackMock>) => trackMock(...a),
}));
vi.mock('@/lib/api-client', () => ({
  apiCopyProject: vi.fn(),
  apiSetProjectFolder: (...a: Parameters<typeof setFolderMock>) => setFolderMock(...a),
}));
vi.mock('@/hooks/persistence/useProjectListActions', () => ({
  useProjectListActions: () => ({}),
}));
vi.mock('@/hooks/ui/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const { useProjectActions } = await import('./useProjectActions');

// The two hooks useProjectActions calls are mocked above; one render gives its actions.
function actions() {
  return renderHook(() =>
    useProjectActions({
      projectId: null,
      projectName: '',
      projectList: [],
      setProjectList: vi.fn(),
      confirm: vi.fn() as never,
      ownerId: 'me',
      hookDeleteFolder: vi.fn(async () => true),
      folders: [],
      sharedProjects: [],
      setSharedProjects: vi.fn(),
      copying: false,
      setCopying: vi.fn(),
      sessionShareCode: null,
      refreshTeamLibraries: vi.fn(),
      refreshProjectList: vi.fn(),
    }),
  ).result.current;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

// docs/specs/017-telemetry/telemetry.md: Team·Added·Project counts a project ENTERING a team library,
// whichever surface filed it; Team·Moved·Project is every other scope move.
describe('moveProjectTo telemetry', () => {
  beforeEach(() => {
    trackMock.mockReset();
    setFolderMock.mockReset().mockResolvedValue(undefined);
  });

  it('counts a personal project filed into a team as Added', async () => {
    actions().moveProjectTo('d1', { teamId: 't1', folderId: null }, null);
    await flush();
    expect(trackMock).toHaveBeenCalledExactlyOnceWith('Team', 'Added', 'Project');
  });

  it('counts a move within or out of a team as Moved', async () => {
    actions().moveProjectTo('d1', { teamId: 't1', folderId: 'f1' }, 't1');
    actions().moveProjectTo('d1', { teamId: null, folderId: null }, 't1');
    // A caller that does not say where the project came from (team library rows).
    actions().moveProjectTo('d1', { teamId: 't2', folderId: null });
    await flush();
    expect(trackMock.mock.calls).toEqual([
      ['Team', 'Moved', 'Project'],
      ['Team', 'Moved', 'Project'],
      ['Team', 'Moved', 'Project'],
    ]);
  });

  it('counts nothing when the server refused the move', async () => {
    setFolderMock.mockRejectedValue(new Error('403'));
    actions().moveProjectTo('d1', { teamId: 't1', folderId: null }, null);
    await flush();
    expect(trackMock).not.toHaveBeenCalled();
  });
});
