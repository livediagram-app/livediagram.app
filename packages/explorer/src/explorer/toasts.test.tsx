// What the Explorer's toasts do: an answer (Undo) stays ten seconds, its clock stopped while hovered; deleting the
// folder on screen leaves for its space's root.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Folder } from '@liveworkspace/index-client';
import { TOAST_ANSWER_MS, ToastProvider, useToast } from '../ui/Toasts';
import { afterFolderDelete } from './Dialogs';

function Shows({ action }: { action: boolean }) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() =>
        toast.show('“Roadmap” deleted.', action ? { action: { label: 'Undo', run: () => {} } } : {})
      }
    >
      go
    </button>
  );
}

afterEach(() => vi.useRealTimers());

describe('toasts', () => {
  it('keeps an Undo up for TOAST_ANSWER_MS, paused while hovered', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Shows action />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'go' }));
    act(() => void vi.advanceTimersByTime(6000));
    const toast = screen.getByRole('status');
    expect(toast.textContent).toContain('deleted');
    fireEvent.mouseEnter(toast);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(screen.queryByRole('status')).toBeTruthy();
    fireEvent.mouseLeave(toast);
    act(() => void vi.advanceTimersByTime(TOAST_ANSWER_MS - 6000 - 1));
    expect(screen.queryByRole('status')).toBeTruthy();
    act(() => void vi.advanceTimersByTime(2));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('lets a plain toast go after five seconds', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Shows action={false} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'go' }));
    act(() => void vi.advanceTimersByTime(5001));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('deleting the folder on screen', () => {
  const f = (id: string, parentId: string | null, teamId: string | null = null): Folder => ({
    id,
    name: id,
    parentId,
    teamId,
    ownerId: 'user_me',
    createdAt: 1,
    updatedAt: 1,
  });
  const byId = new Map([f('a', null), f('b', 'a'), f('t', null, 'T1')].map((x) => [x.id, x]));

  it('leaves for My Work or the team, and stays put elsewhere', () => {
    expect(afterFolderDelete({ kind: 'folder', id: 'b' }, byId, byId.get('a')!)).toEqual({
      kind: 'all',
    });
    expect(
      afterFolderDelete({ kind: 'team', id: 'T1', folderId: 't' }, byId, byId.get('t')!),
    ).toEqual({ kind: 'team', id: 'T1' });
    expect(afterFolderDelete({ kind: 'folder', id: 'a' }, byId, byId.get('b')!)).toBeNull();
    expect(afterFolderDelete({ kind: 'recent' }, byId, byId.get('a')!)).toBeNull();
  });
});
