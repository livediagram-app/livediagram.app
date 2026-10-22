// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectListItem, Folder } from '@/lib/api-client';
import type { TeamProjectRow } from '@/hooks/persistence/useTeamLibrariesSweep';

vi.mock('@/lib/api-client', () => ({
  apiCreateFolder: vi.fn(),
  apiSetProjectFolder: vi.fn(),
  apiUpdateFolder: vi.fn(),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const { apiCreateFolder, apiSetProjectFolder, apiUpdateFolder } = await import('@/lib/api-client');
const { track } = await import('@/lib/telemetry');
const { useExplorerMoves } = await import('./useExplorerMoves');

// A move that fails says so (docs/specs/013-workspace/folders.md "A move that fails says so"): every
// move ends in its toast or lands, and a failure logs `[explorer-move] <kind> failed`.

const doc = (id: string) => ({ id, name: id, folderId: null }) as ProjectListItem;
const teamDoc = (id: string, teamId: string) =>
  ({ id, folderId: null, team: { id: teamId } }) as TeamProjectRow;

function setup() {
  let list = [doc('a'), doc('b')];
  const setProjects = vi.fn(
    (next: ProjectListItem[] | ((p: ProjectListItem[]) => ProjectListItem[])) => {
      list = typeof next === 'function' ? next(list) : next;
    },
  );
  const toast = { error: vi.fn() };
  const refreshFolders = vi.fn(() => Promise.resolve());
  const refreshTeamLibraries = vi.fn();
  const refreshPersonal = vi.fn(() => Promise.resolve());
  const { result } = renderHook(() =>
    useExplorerMoves({
      ownerId: 'owner-1',
      projects: list,
      setProjects,
      folders: [] as Folder[],
      teams: [],
      teamFolders: [],
      teamProjects: [teamDoc('t1', 'team-1')],
      descendantSet: () => new Set<string>(),
      refreshFolders,
      refreshTeamLibraries,
      refreshPersonal,
      moveProjectToFolder: vi.fn(),
      toast,
    }),
  );
  return {
    moves: result.current,
    toast,
    refreshFolders,
    refreshTeamLibraries,
    refreshPersonal,
    ids: () => list.map((d) => d.id),
  };
}

const warned = () => vi.mocked(console.warn).mock.calls.map(([message]) => String(message));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('moving a folder', () => {
  it('refreshes the folders once the move landed, and counts it', async () => {
    vi.mocked(apiUpdateFolder).mockResolvedValueOnce({} as Folder);
    const { moves, toast, refreshFolders } = setup();
    moves.moveFolderToParent('f1', 'f2');
    await vi.waitFor(() => expect(refreshFolders).toHaveBeenCalled());
    expect(track).toHaveBeenCalledWith('Folder', 'Moved');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('says so, and logs it, when the move fails', async () => {
    vi.mocked(apiUpdateFolder).mockRejectedValueOnce(new Error('offline'));
    const { moves, toast, refreshFolders } = setup();
    moves.moveFolderToParent('f1', 'f2');
    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Could not move the folder. Try again.'),
    );
    expect(refreshFolders).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
    expect(warned()).toEqual(['[explorer-move] folder failed folder=f1: offline']);
  });
});

describe('moving a project into a team', () => {
  it('brings the row back, says so and logs it when the move fails', async () => {
    vi.mocked(apiSetProjectFolder).mockRejectedValueOnce(new Error('offline'));
    const { moves, toast, ids } = setup();
    moves.moveProjectToTeam('b', 'team-1');
    expect(ids()).toEqual(['a']);
    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Couldn’t move “b” to the team. Try again.'),
    );
    expect(ids()).toEqual(['b', 'a']);
    expect(warned()).toEqual(['[explorer-move] project-to-team failed project=b: offline']);
  });
});

describe('moving a team project within its team', () => {
  it('re-sweeps the teams once the move landed', async () => {
    vi.mocked(apiSetProjectFolder).mockResolvedValueOnce(undefined);
    const { moves, toast, refreshTeamLibraries } = setup();
    moves.moveProjectTo('t1', { teamId: 'team-1', folderId: 'tf1' });
    await vi.waitFor(() => expect(refreshTeamLibraries).toHaveBeenCalled());
    expect(track).toHaveBeenCalledWith('Team', 'Moved', 'Project');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('says so, and logs it, when the move fails', async () => {
    vi.mocked(apiSetProjectFolder).mockRejectedValueOnce(new Error('offline'));
    const { moves, toast, refreshTeamLibraries } = setup();
    moves.moveProjectTo('t1', { teamId: 'team-1', folderId: 'tf1' });
    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Could not move the project. Try again.'),
    );
    expect(refreshTeamLibraries).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
    expect(warned()).toEqual(['[explorer-move] team-project failed project=t1: offline']);
  });
});

describe('moving a team project out of its team', () => {
  it('re-sweeps the teams and My Projects once the move landed', async () => {
    vi.mocked(apiSetProjectFolder).mockResolvedValueOnce(undefined);
    const { moves, refreshTeamLibraries, refreshPersonal } = setup();
    moves.moveProjectTo('t1', { teamId: null, folderId: null });
    await vi.waitFor(() => expect(refreshPersonal).toHaveBeenCalledWith('owner-1'));
    expect(refreshTeamLibraries).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('Team', 'Removed', 'Project');
  });

  it.each([
    ['to My Projects', null],
    ['to another team', 'team-2'],
  ])('says so, and logs it, when the move %s fails', async (_, teamId) => {
    vi.mocked(apiSetProjectFolder).mockRejectedValueOnce(new Error('offline'));
    const { moves, toast, refreshPersonal } = setup();
    moves.moveProjectTo('t1', { teamId, folderId: null });
    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Couldn’t move the project out of the team. Try again.',
      ),
    );
    expect(refreshPersonal).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
    expect(warned()).toEqual(['[explorer-move] team-project-out failed project=t1: offline']);
  });
});

describe('making a folder from the picker', () => {
  it('hands the folder back once made', async () => {
    vi.mocked(apiCreateFolder).mockResolvedValueOnce({
      id: 'n1',
      name: 'New',
      parentId: null,
    } as Folder);
    const { moves, toast } = setup();
    await expect(moves.createMoveFolder('New', null, null)).resolves.toEqual({
      id: 'n1',
      name: 'New',
      parentId: null,
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('answers none, says so and logs it when the folder cannot be made', async () => {
    vi.mocked(apiCreateFolder).mockRejectedValueOnce(new Error('offline'));
    const { moves, toast } = setup();
    await expect(moves.createMoveFolder('New', null, null)).resolves.toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Could not create “New”. Try again.');
    expect(warned()).toEqual(['[explorer-move] new-folder failed: offline']);
  });
});
