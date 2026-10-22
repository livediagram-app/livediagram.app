// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectListItem } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiDeleteProject: vi.fn(),
  apiDismissSharedWith: vi.fn(),
  apiSaveProjectMeta: vi.fn(),
  apiSetProjectFolder: vi.fn(),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/api/trash', () => ({ apiRestoreProject: vi.fn() }));

const { apiDeleteProject, apiSetProjectFolder } = await import('@/lib/api-client');
const { track } = await import('@/lib/telemetry');
const { isProjectDeleted } = await import('@/lib/project-tombstones');
const { apiRestoreProject } = await import('@/lib/api/trash');
const { useProjectListActions } = await import('./useProjectListActions');

// Deleting from an Explorer list (docs/specs/013-workspace/trash.md "Deleting"): nothing is asked first, the row
// leaves at once, and only a delete the api accepted is said, with an Undo that puts it back.

const row = (id: string) => ({ id, name: `Doc ${id}`, folderId: null }) as ProjectListItem;

function setup() {
  const confirm = vi.fn(async () => true);
  let list = [row('a'), row('b'), row('c')];
  const setProjectList = vi.fn(
    (next: ProjectListItem[] | ((p: ProjectListItem[]) => ProjectListItem[])) => {
      list = typeof next === 'function' ? next(list) : next;
    },
  );
  const toast = { success: vi.fn(), error: vi.fn(), action: vi.fn(), dismissAction: vi.fn() };
  const { result } = renderHook(() =>
    useProjectListActions({
      ownerId: 'owner-1',
      projectList: list,
      setProjectList,
      confirm,
      toast: toast as never,
      deleteFolderFromHook: vi.fn(),
      folders: [{ id: 'f1', name: 'Plans', parentId: null }],
      afterDuplicate: vi.fn(),
    }),
  );
  return {
    actions: result.current,
    toast,
    confirm,
    ids: () => list.map((d) => d.id),
    folderOf: (id: string) => list.find((d) => d.id === id)?.folderId,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('deleteProject from a list', () => {
  it('asks nothing, and says it once the api accepted it, with an Undo', async () => {
    vi.mocked(apiDeleteProject).mockResolvedValueOnce(undefined);
    const { actions, toast, confirm, ids } = setup();
    await actions.deleteProject('b');
    expect(confirm).not.toHaveBeenCalled();
    expect(ids()).toEqual(['a', 'c']);
    expect(toast.action).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '“Doc b” deleted',
        actions: [expect.objectContaining({ label: 'Undo', ariaLabel: 'Undo: restore “Doc b”' })],
      }),
    );
    expect(track).toHaveBeenCalledWith('Project', 'Deleted');
  });

  it('puts the row back where it was on Undo', async () => {
    vi.mocked(apiDeleteProject).mockResolvedValueOnce(undefined);
    vi.mocked(apiRestoreProject).mockResolvedValueOnce(null);
    const { actions, toast, ids } = setup();
    await actions.deleteProject('b');
    const [spec] = toast.action.mock.calls[0]! as [
      { key: string; actions: { onSelect: () => void }[] },
    ];
    spec.actions[0]!.onSelect();
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith('“Doc b” restored'));
    expect(toast.dismissAction).toHaveBeenCalledWith(spec.key);
    expect(apiRestoreProject).toHaveBeenCalledWith('owner-1', 'b');
    expect(ids()).toEqual(['a', 'b', 'c']);
    expect(track).toHaveBeenCalledWith('Trash', 'Restored', 'Personal');
  });

  it('puts the row back where it was and says so when the delete fails', async () => {
    vi.mocked(apiDeleteProject).mockRejectedValueOnce(new Error('offline'));
    const { actions, toast, ids } = setup();
    await actions.deleteProject('b');
    expect(ids()).toEqual(['a', 'b', 'c']);
    expect(toast.action).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Could not delete “Doc b”. Try again.');
    expect(track).not.toHaveBeenCalled();
    // Its editor may save it again.
    expect(isProjectDeleted('b')).toBe(false);
  });
});

// docs/specs/013-workspace/folders.md "A move that fails says so".
describe('moveProjectToFolder', () => {
  it('says where it went once the api accepted it', async () => {
    vi.mocked(apiSetProjectFolder).mockResolvedValueOnce(undefined);
    const { actions, toast } = setup();
    actions.moveProjectToFolder('b', 'f1');
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith('“Doc b” moved to “Plans”'));
    expect(track).toHaveBeenCalledWith('Project', 'Moved');
  });

  it('says when it went back to My Projects', async () => {
    vi.mocked(apiSetProjectFolder).mockResolvedValueOnce(undefined);
    const { actions, toast } = setup();
    actions.moveProjectToFolder('b', null);
    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('“Doc b” moved to My Projects'),
    );
  });

  it('puts the row back, says so and logs it when the move fails', async () => {
    vi.mocked(apiSetProjectFolder).mockRejectedValueOnce(new Error('offline'));
    const { actions, toast, folderOf } = setup();
    actions.moveProjectToFolder('b', 'f1');
    expect(folderOf('b')).toBe('f1');
    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Could not move “Doc b”. Try again.'),
    );
    expect(folderOf('b')).toBeNull();
    expect(track).not.toHaveBeenCalled();
    expect(vi.mocked(console.warn).mock.calls.map(([message]) => String(message))).toEqual([
      '[explorer-move] project failed project=b: offline',
    ]);
  });
});
