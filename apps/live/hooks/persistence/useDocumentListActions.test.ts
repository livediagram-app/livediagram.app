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

const { apiDeleteDocument } = await import('@/lib/api-client');
const { track } = await import('@/lib/telemetry');
const { isDocumentDeleted } = await import('@/lib/document-tombstones');
const { useDocumentListActions } = await import('./useDocumentListActions');

// Deleting from an Explorer list (docs/specs/013-workspace/trash.md): the row leaves at once, and
// only a delete the api accepted is confirmed.

const row = (id: string) => ({ id, name: id }) as DocumentListItem;

function setup() {
  let list = [row('a'), row('b'), row('c')];
  const setDocumentList = vi.fn(
    (next: DocumentListItem[] | ((p: DocumentListItem[]) => DocumentListItem[])) => {
      list = typeof next === 'function' ? next(list) : next;
    },
  );
  const toast = { success: vi.fn(), error: vi.fn() };
  const { result } = renderHook(() =>
    useDocumentListActions({
      ownerId: 'owner-1',
      documentList: list,
      setDocumentList,
      confirm: vi.fn(async () => true) as never,
      toast: toast as never,
      deleteFolderFromHook: vi.fn(),
      afterDuplicate: vi.fn(),
    }),
  );
  return { actions: result.current, toast, ids: () => list.map((d) => d.id) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('deleteDocument from a list', () => {
  it('confirms the delete once the api accepted it', async () => {
    vi.mocked(apiDeleteDocument).mockResolvedValueOnce(undefined);
    const { actions, toast, ids } = setup();
    await actions.deleteDocument('b', undefined, { skipConfirm: true });
    expect(ids()).toEqual(['a', 'c']);
    expect(toast.success).toHaveBeenCalledWith('Document deleted');
    expect(track).toHaveBeenCalledWith('Document', 'Deleted');
  });

  it('puts the row back where it was and says so when the delete fails', async () => {
    vi.mocked(apiDeleteDocument).mockRejectedValueOnce(new Error('offline'));
    const { actions, toast, ids } = setup();
    await actions.deleteDocument('b', undefined, { skipConfirm: true });
    expect(ids()).toEqual(['a', 'b', 'c']);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Could not delete the document. Please try again.');
    expect(track).not.toHaveBeenCalled();
    // Its editor may save it again.
    expect(isDocumentDeleted('b')).toBe(false);
  });
});
