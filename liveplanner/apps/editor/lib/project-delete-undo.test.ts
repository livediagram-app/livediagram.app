// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/trash', () => ({ apiRestoreProject: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const { apiRestoreProject } = await import('@/lib/api/trash');
const { track } = await import('@/lib/telemetry');
const { handOffDeleteUndo, offerDeleteUndo, takeDeleteUndo } =
  await import('./project-delete-undo');

// docs/specs/013-workspace/trash.md "Deleting": the Undo on "“Roadmap” deleted", and its hand-over from the editor.
afterEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

const toast = () => ({ action: vi.fn(), dismissAction: vi.fn(), success: vi.fn(), error: vi.fn() });

describe('offerDeleteUndo', () => {
  it('restores on Undo, closes the toast, counts it by its Trash and says so', async () => {
    vi.mocked(apiRestoreProject).mockResolvedValueOnce(null);
    const t = toast();
    const onRestored = vi.fn();
    offerDeleteUndo(t as never, { ownerId: 'me', id: 'd1', trash: 'Team', onRestored });
    const spec = t.action.mock.calls[0]![0] as {
      key: string;
      message: string;
      actions: { onSelect: () => void; ariaLabel: string }[];
    };
    expect(spec.message).toBe('Plan deleted');
    expect(spec.actions[0]!.ariaLabel).toBe('Undo: restore the plan');
    spec.actions[0]!.onSelect();
    expect(t.dismissAction).toHaveBeenCalledWith(spec.key);
    await vi.waitFor(() => expect(t.success).toHaveBeenCalledWith('Plan restored'));
    expect(onRestored).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('Trash', 'Restored', 'Team');
  });

  it('says where it still is when the restore fails', async () => {
    vi.mocked(apiRestoreProject).mockRejectedValueOnce(new Error('503'));
    const t = toast();
    offerDeleteUndo(t as never, { ownerId: 'me', id: 'd1', trash: 'Personal' });
    (t.action.mock.calls[0]![0] as { actions: { onSelect: () => void }[] }).actions[0]!.onSelect();
    await vi.waitFor(() => expect(t.error).toHaveBeenCalled());
    expect(t.success).not.toHaveBeenCalled();
  });

  it('names the project it deleted, restored or could not restore', async () => {
    vi.mocked(apiRestoreProject)
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('503'));
    const t = toast();
    offerDeleteUndo(t as never, { ownerId: 'me', id: 'd1', name: 'Roadmap', trash: 'Personal' });
    const spec = t.action.mock.calls[0]![0] as {
      message: string;
      actions: { onSelect: () => void; ariaLabel: string }[];
    };
    expect(spec.message).toBe('“Roadmap” deleted');
    expect(spec.actions[0]!.ariaLabel).toBe('Undo: restore “Roadmap”');
    spec.actions[0]!.onSelect();
    await vi.waitFor(() => expect(t.success).toHaveBeenCalledWith('“Roadmap” restored'));
    spec.actions[0]!.onSelect();
    await vi.waitFor(() =>
      expect(t.error).toHaveBeenCalledWith(
        'Could not restore “Roadmap”. It is in the Trash, in Settings.',
      ),
    );
  });
});

describe('the hand-over from the editor', () => {
  it('is taken once', () => {
    handOffDeleteUndo('d1', 'Personal', 'Roadmap', 1_000);
    expect(takeDeleteUndo(2_000)).toEqual({ id: 'd1', name: 'Roadmap', trash: 'Personal' });
    expect(takeDeleteUndo(2_000)).toBeNull();
  });

  it('carries no name for an unnamed project', () => {
    handOffDeleteUndo('d1', 'Local', '', 1_000);
    expect(takeDeleteUndo(2_000)).toEqual({ id: 'd1', name: null, trash: 'Local' });
  });

  it('is dropped when stale or malformed', () => {
    handOffDeleteUndo('d1', 'Personal', 'Roadmap', 1_000);
    expect(takeDeleteUndo(60_000)).toBeNull();
    sessionStorage.setItem('liveplanner:deleted-project', '{"id":1}');
    expect(takeDeleteUndo()).toBeNull();
    sessionStorage.setItem('liveplanner:deleted-project', 'not json');
    expect(takeDeleteUndo()).toBeNull();
  });
});
