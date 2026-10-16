// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentListItem } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiDeleteDocument: vi.fn(),
  apiDismissSharedWith: vi.fn(),
  apiSaveDocumentMeta: vi.fn(),
  apiSetDocumentFolder: vi.fn(),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/api/trash', () => ({ apiRestoreDocument: vi.fn() }));

const { apiDeleteDocument } = await import('@/lib/api-client');
const { track } = await import('@/lib/telemetry');
const { isDocumentDeleted } = await import('@/lib/document-tombstones');
const { apiRestoreDocument } = await import('@/lib/api/trash');
const { useDocumentListActions } = await import('./useDocumentListActions');

// Deleting from an Explorer list (docs/specs/013-workspace/trash.md "Deleting"): nothing is asked first, the row
// leaves at once, and only a delete the api accepted is said, with an Undo that puts it back.

const row = (id: string) => ({ id, name: id }) as DocumentListItem;

function setup() {
  const confirm = vi.fn(async () => true);
  let list = [row('a'), row('b'), row('c')];
  const setDocumentList = vi.fn(
    (next: DocumentListItem[] | ((p: DocumentListItem[]) => DocumentListItem[])) => {
      list = typeof next === 'function' ? next(list) : next;
    },
  );
  const toast = { success: vi.fn(), error: vi.fn(), action: vi.fn(), dismissAction: vi.fn() };
  const { result } = renderHook(() =>
    useDocumentListActions({
      ownerId: 'owner-1',
      documentList: list,
      setDocumentList,
      confirm,
      toast: toast as never,
      deleteFolderFromHook: vi.fn(),
      afterDuplicate: vi.fn(),
    }),
  );
  return { actions: result.current, toast, confirm, ids: () => list.map((d) => d.id) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('deleteDocument from a list', () => {
  it('asks nothing, and says it once the api accepted it, with an Undo', async () => {
    vi.mocked(apiDeleteDocument).mockResolvedValueOnce(undefined);
    const { actions, toast, confirm, ids } = setup();
    await actions.deleteDocument('b');
    expect(confirm).not.toHaveBeenCalled();
    expect(ids()).toEqual(['a', 'c']);
    expect(toast.action).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Document deleted',
        actions: [expect.objectContaining({ label: 'Undo' })],
      }),
    );
    expect(track).toHaveBeenCalledWith('Document', 'Deleted');
  });

  it('puts the row back where it was on Undo', async () => {
    vi.mocked(apiDeleteDocument).mockResolvedValueOnce(undefined);
    vi.mocked(apiRestoreDocument).mockResolvedValueOnce(null);
    const { actions, toast, ids } = setup();
    await actions.deleteDocument('b');
    const [spec] = toast.action.mock.calls[0]! as [
      { key: string; actions: { onSelect: () => void }[] },
    ];
    spec.actions[0]!.onSelect();
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith('Document restored'));
    expect(toast.dismissAction).toHaveBeenCalledWith(spec.key);
    expect(apiRestoreDocument).toHaveBeenCalledWith('owner-1', 'b');
    expect(ids()).toEqual(['a', 'b', 'c']);
    expect(track).toHaveBeenCalledWith('Trash', 'Restored', 'Personal');
  });

  it('puts the row back where it was and says so when the delete fails', async () => {
    vi.mocked(apiDeleteDocument).mockRejectedValueOnce(new Error('offline'));
    const { actions, toast, ids } = setup();
    await actions.deleteDocument('b');
    expect(ids()).toEqual(['a', 'b', 'c']);
    expect(toast.action).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Could not delete the document. Please try again.');
    expect(track).not.toHaveBeenCalled();
    // Its editor may save it again.
    expect(isDocumentDeleted('b')).toBe(false);
  });
});
