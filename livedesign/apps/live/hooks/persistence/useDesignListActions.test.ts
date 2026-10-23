// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesignListItem } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiDeleteDesign: vi.fn(),
  apiDismissSharedWith: vi.fn(),
  apiSaveDesignMeta: vi.fn(),
  apiSetDesignFolder: vi.fn(),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/api/trash', () => ({ apiRestoreDesign: vi.fn() }));

const { apiDeleteDesign, apiSetDesignFolder } = await import('@/lib/api-client');
const { track } = await import('@/lib/telemetry');
const { isDesignDeleted } = await import('@/lib/design-tombstones');
const { apiRestoreDesign } = await import('@/lib/api/trash');
const { useDesignListActions } = await import('./useDesignListActions');

// Deleting from an Explorer list (docs/specs/013-workspace/trash.md "Deleting"): nothing is asked first, the row
// leaves at once, and only a delete the api accepted is said, with an Undo that puts it back.

const row = (id: string) => ({ id, name: `Doc ${id}`, folderId: null }) as DesignListItem;

function setup() {
  const confirm = vi.fn(async () => true);
  let list = [row('a'), row('b'), row('c')];
  const setDesignList = vi.fn(
    (next: DesignListItem[] | ((p: DesignListItem[]) => DesignListItem[])) => {
      list = typeof next === 'function' ? next(list) : next;
    },
  );
  const toast = { success: vi.fn(), error: vi.fn(), action: vi.fn(), dismissAction: vi.fn() };
  const { result } = renderHook(() =>
    useDesignListActions({
      ownerId: 'owner-1',
      designList: list,
      setDesignList,
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

describe('deleteDesign from a list', () => {
  it('asks nothing, and says it once the api accepted it, with an Undo', async () => {
    vi.mocked(apiDeleteDesign).mockResolvedValueOnce(undefined);
    const { actions, toast, confirm, ids } = setup();
    await actions.deleteDesign('b');
    expect(confirm).not.toHaveBeenCalled();
    expect(ids()).toEqual(['a', 'c']);
    expect(toast.action).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '“Doc b” deleted',
        actions: [expect.objectContaining({ label: 'Undo', ariaLabel: 'Undo: restore “Doc b”' })],
      }),
    );
    expect(track).toHaveBeenCalledWith('Document', 'Deleted');
  });

  it('puts the row back where it was on Undo', async () => {
    vi.mocked(apiDeleteDesign).mockResolvedValueOnce(undefined);
    vi.mocked(apiRestoreDesign).mockResolvedValueOnce(null);
    const { actions, toast, ids } = setup();
    await actions.deleteDesign('b');
    const [spec] = toast.action.mock.calls[0]! as [
      { key: string; actions: { onSelect: () => void }[] },
    ];
    spec.actions[0]!.onSelect();
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith('“Doc b” restored'));
    expect(toast.dismissAction).toHaveBeenCalledWith(spec.key);
    expect(apiRestoreDesign).toHaveBeenCalledWith('owner-1', 'b');
    expect(ids()).toEqual(['a', 'b', 'c']);
    expect(track).toHaveBeenCalledWith('Trash', 'Restored', 'Personal');
  });

  it('puts the row back where it was and says so when the delete fails', async () => {
    vi.mocked(apiDeleteDesign).mockRejectedValueOnce(new Error('offline'));
    const { actions, toast, ids } = setup();
    await actions.deleteDesign('b');
    expect(ids()).toEqual(['a', 'b', 'c']);
    expect(toast.action).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Could not delete “Doc b”. Try again.');
    expect(track).not.toHaveBeenCalled();
    // Its editor may save it again.
    expect(isDesignDeleted('b')).toBe(false);
  });
});

// docs/specs/013-workspace/folders.md "A move that fails says so".
describe('moveDesignToFolder', () => {
  it('says where it went once the api accepted it', async () => {
    vi.mocked(apiSetDesignFolder).mockResolvedValueOnce(undefined);
    const { actions, toast } = setup();
    actions.moveDesignToFolder('b', 'f1');
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith('“Doc b” moved to “Plans”'));
    expect(track).toHaveBeenCalledWith('Document', 'Moved');
  });

  it('says when it went back to My Work', async () => {
    vi.mocked(apiSetDesignFolder).mockResolvedValueOnce(undefined);
    const { actions, toast } = setup();
    actions.moveDesignToFolder('b', null);
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith('“Doc b” moved to My Work'));
  });

  it('puts the row back, says so and logs it when the move fails', async () => {
    vi.mocked(apiSetDesignFolder).mockRejectedValueOnce(new Error('offline'));
    const { actions, toast, folderOf } = setup();
    actions.moveDesignToFolder('b', 'f1');
    expect(folderOf('b')).toBe('f1');
    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Could not move “Doc b”. Try again.'),
    );
    expect(folderOf('b')).toBeNull();
    expect(track).not.toHaveBeenCalled();
    expect(vi.mocked(console.warn).mock.calls.map(([message]) => String(message))).toEqual([
      '[explorer-move] design failed design=b: offline',
    ]);
  });
});
