// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/trash', () => ({ apiRestoreDocument: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const { apiRestoreDocument } = await import('@/lib/api/trash');
const { track } = await import('@/lib/telemetry');
const { handOffDeleteUndo, offerDeleteUndo, takeDeleteUndo } =
  await import('./document-delete-undo');

// docs/specs/013-workspace/trash.md "Deleting": the Undo on "Document deleted", and its hand-over from the editor.
afterEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

const toast = () => ({ action: vi.fn(), dismissAction: vi.fn(), success: vi.fn(), error: vi.fn() });

describe('offerDeleteUndo', () => {
  it('restores on Undo, closes the toast, counts it by its Trash and says so', async () => {
    vi.mocked(apiRestoreDocument).mockResolvedValueOnce(null);
    const t = toast();
    const onRestored = vi.fn();
    offerDeleteUndo(t as never, { ownerId: 'me', id: 'd1', trash: 'Team', onRestored });
    const spec = t.action.mock.calls[0]![0] as { key: string; actions: { onSelect: () => void }[] };
    spec.actions[0]!.onSelect();
    expect(t.dismissAction).toHaveBeenCalledWith(spec.key);
    await vi.waitFor(() => expect(t.success).toHaveBeenCalledWith('Document restored'));
    expect(onRestored).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('Trash', 'Restored', 'Team');
  });

  it('says where it still is when the restore fails', async () => {
    vi.mocked(apiRestoreDocument).mockRejectedValueOnce(new Error('503'));
    const t = toast();
    offerDeleteUndo(t as never, { ownerId: 'me', id: 'd1', trash: 'Personal' });
    (t.action.mock.calls[0]![0] as { actions: { onSelect: () => void }[] }).actions[0]!.onSelect();
    await vi.waitFor(() => expect(t.error).toHaveBeenCalled());
    expect(t.success).not.toHaveBeenCalled();
  });
});

describe('the hand-over from the editor', () => {
  it('is taken once', () => {
    handOffDeleteUndo('d1', 'Personal', 1_000);
    expect(takeDeleteUndo(2_000)).toEqual({ id: 'd1', trash: 'Personal' });
    expect(takeDeleteUndo(2_000)).toBeNull();
  });

  it('is dropped when stale or malformed', () => {
    handOffDeleteUndo('d1', 'Personal', 1_000);
    expect(takeDeleteUndo(60_000)).toBeNull();
    sessionStorage.setItem('livediagram:deleted-document', '{"id":1}');
    expect(takeDeleteUndo()).toBeNull();
    sessionStorage.setItem('livediagram:deleted-document', 'not json');
    expect(takeDeleteUndo()).toBeNull();
  });
});
