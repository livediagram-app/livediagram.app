// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrashedPage } from '@liveknowledge/api-schema';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { DAY_MONTH } from '@liveworkspace/ui/date-format';

// The page Trash in the editor (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page Trash"; blueprint
// page-tree.md "The page Trash"): the store, the tree's row, the dialog.

const api = vi.hoisted(() => ({
  list: vi.fn(),
  restore: vi.fn(),
  forever: vi.fn(),
  empty: vi.fn(),
}));
vi.mock('@/lib/api/page-trash', () => ({
  apiPageTrash: api.list,
  apiRestorePage: api.restore,
  apiDeletePageForever: api.forever,
  apiEmptyPageTrash: api.empty,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
const confirm = vi.hoisted(() => ({ answer: true, asked: vi.fn() }));
vi.mock('@liveworkspace/workbench/hooks/ui/useConfirm', () => ({
  useConfirm: () => async (o: { title: string }) => {
    confirm.asked(o);
    return confirm.answer;
  },
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import {
  TRASH_REFRESH_MS,
  createPageTrashStore,
  pageTrashStore,
  trashedCount,
  trashedIds,
} from '@/lib/knowledge/page-trash-store';
import { trashedLinkCss } from '@/lib/knowledge/page-link-titles';
import { PageTrashRailButton, PageTrashRow, trashLabel } from './PageTrashRow';
import {
  PageTrashDialog,
  PageTrashHost,
  restoreFailure,
  subpagesLine,
  trashedLine,
} from './PageTrashDialog';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 21, 12);
const RELEASE: TrashedPage = {
  id: 'release',
  name: 'Release Process',
  trashedAt: NOW - 18 * DAY,
  trashedBy: 'Ana',
  subpages: [
    { id: 'rollbacks', name: 'Rollbacks' },
    { id: 'hotfix', name: '' },
  ],
};
const NOTES: TrashedPage = { id: 'notes', name: '', trashedAt: NOW, trashedBy: null, subpages: [] };
const SESSION = { documentId: 'kb', who: { ownerId: 'p1', shareCode: null } };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(NOW);
  api.list.mockResolvedValue([RELEASE, NOTES]);
  api.restore.mockResolvedValue({ restored: ['release', 'rollbacks', 'hotfix'], topLevel: false });
  api.forever.mockResolvedValue(undefined);
  api.empty.mockResolvedValue(undefined);
  confirm.answer = true;
});
afterEach(() => {
  act(() => pageTrashStore.attach(null));
  vi.useRealTimers();
  vi.clearAllMocks();
});

const flush = () => act(async () => {});

describe('the store', () => {
  it('reads the Trash for a session, and forgets it for none', async () => {
    const store = createPageTrashStore();
    store.attach(SESSION);
    await flush();
    expect(api.list).toHaveBeenCalledWith(SESSION.who, 'kb');
    expect(store.get()).toMatchObject({ documentId: 'kb', loaded: true, failed: false });
    expect(trashedCount(store.get().pages)).toBe(4);
    expect(trashedIds(store.get().pages)).toEqual(['release', 'rollbacks', 'hotfix', 'notes']);
    expect(store.holds('hotfix')).toBe(true);
    expect(store.holds('other')).toBe(false);
    // The same session again reads nothing more.
    store.attach({ ...SESSION, who: { ...SESSION.who } });
    expect(api.list).toHaveBeenCalledTimes(1);
    store.attach(null);
    expect(store.get().pages).toEqual([]);
    await store.refresh();
    store.scheduleRefresh();
    store.open();
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(await store.restore('release')).toBeNull();
    await store.deleteForever('release');
    await store.empty();
    expect(api.restore).not.toHaveBeenCalled();
  });

  it('reads again a while after the page count changes, once for a burst', async () => {
    const store = createPageTrashStore();
    store.attach(SESSION);
    await flush();
    store.scheduleRefresh();
    store.scheduleRefresh();
    await act(async () => vi.advanceTimersByTime(TRASH_REFRESH_MS));
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('says a first read failed, and keeps what it had after a later one fails', async () => {
    api.list.mockRejectedValueOnce(new Error('offline'));
    const store = createPageTrashStore();
    store.attach(SESSION);
    await flush();
    expect(store.get()).toMatchObject({ loaded: false, failed: true });
    await store.refresh();
    expect(store.get()).toMatchObject({ loaded: true, failed: false });
    api.list.mockRejectedValueOnce(new Error('offline'));
    await store.refresh();
    expect(store.get()).toMatchObject({ loaded: true, failed: false });
  });

  it('drops a read another knowledgebase has overtaken', async () => {
    let answer: (pages: TrashedPage[]) => void = () => {};
    api.list.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const store = createPageTrashStore();
    store.attach(SESSION);
    store.attach({ ...SESSION, documentId: 'other' });
    answer([RELEASE]);
    await flush();
    expect(store.get().documentId).toBe('other');
    expect(store.get().pages).toEqual([RELEASE, NOTES]);
  });

  it('drops a failure another knowledgebase has overtaken', async () => {
    let fail: (e: Error) => void = () => {};
    api.list.mockReturnValueOnce(new Promise((_, reject) => (fail = reject)));
    const store = createPageTrashStore();
    store.attach(SESSION);
    store.attach({ ...SESSION, documentId: 'other' });
    fail(new Error('x'));
    await flush();
    expect(store.get().failed).toBe(false);
  });

  it('takes a page out as it is restored, deleted or emptied, and puts it back when that fails', async () => {
    const store = createPageTrashStore();
    store.attach(SESSION);
    await flush();
    api.restore.mockRejectedValueOnce(new Error('x'));
    await expect(store.restore('release')).rejects.toThrow('x');
    expect(store.get().pages).toHaveLength(2);
    api.forever.mockRejectedValueOnce(new Error('x'));
    await expect(store.deleteForever('notes')).rejects.toThrow('x');
    expect(store.get().pages).toHaveLength(2);
    api.empty.mockRejectedValueOnce(new Error('x'));
    await expect(store.empty()).rejects.toThrow('x');
    expect(store.get().pages).toHaveLength(2);
    await store.deleteForever('notes');
    expect(store.get().pages.map((p) => p.id)).toEqual(['release']);
    await store.empty();
    expect(store.get().pages).toEqual([]);
  });

  it('opens at a page, and closes', async () => {
    const store = createPageTrashStore();
    store.open('x');
    expect(store.get().open).toBe(false);
    store.attach(SESSION);
    store.open('rollbacks');
    expect(store.get()).toMatchObject({ open: true, focus: 'rollbacks' });
    store.close();
    expect(store.get()).toMatchObject({ open: false, focus: null });
  });
});

describe('the words', () => {
  it('reads each line', () => {
    expect(trashLabel(0)).toBe('Trash, empty');
    expect(trashLabel(1)).toBe('Trash, 1 page');
    expect(trashLabel(4)).toBe('Trash, 4 pages');
    expect(subpagesLine(1)).toBe('and 1 Subpage');
    expect(subpagesLine(3)).toBe('and 3 Subpages');
    expect(trashedLine(RELEASE, NOW)).toBe(
      `Deleted by Ana, ${DAY_MONTH.format(RELEASE.trashedAt)} · 12 days left`,
    );
    expect(trashedLine({ trashedAt: NOW - 29 * DAY, trashedBy: null }, NOW)).toBe(
      `Deleted ${DAY_MONTH.format(NOW - 29 * DAY)} · 1 day left`,
    );
    expect(trashedLine({ trashedAt: NOW - 31 * DAY, trashedBy: null }, NOW)).toContain(
      'Removed at the next clean-up',
    );
    expect(restoreFailure(new ApiError('restore page', 409, 'page_limit'))).toContain('500 pages');
    expect(restoreFailure(new Error('x'))).toBe('Could not restore the page. Try again.');
    expect(restoreFailure(new Error('x'), 'Onboarding')).toBe(
      'Could not restore “Onboarding”. Try again.',
    );
  });

  it('writes "In the Trash" into a link to a trashed page', () => {
    expect(trashedLinkCss([])).toBe('');
    const css = trashedLinkCss(['a', 'b']);
    expect(css).toContain('[data-page="a"]');
    expect(css).toContain('{content:"In the Trash"}');
    expect(css).toContain('{cursor:pointer}');
  });
});

describe('the Trash row', () => {
  it('is hidden while the Trash is empty, and counts what it holds', async () => {
    api.list.mockResolvedValueOnce([]);
    act(() => pageTrashStore.attach(SESSION));
    await flush();
    const { rerender, container } = render(<PageTrashRow />);
    expect(container.querySelector('[data-page-trash-row]')).toBeNull();
    await act(() => pageTrashStore.refresh());
    rerender(<PageTrashRow />);
    expect(screen.getByRole('button', { name: 'Trash, 4 pages' }).className).toContain('min-h-8');
    rerender(<PageTrashRow touch />);
    const full = screen.getByRole('button', { name: 'Trash, 4 pages' });
    expect(full.className).toContain('min-h-11');
    expect(full.textContent).toContain('4');
  });

  it('opens the Trash, telling the sheet first', async () => {
    act(() => pageTrashStore.attach(SESSION));
    await flush();
    const onOpen = vi.fn();
    render(<PageTrashRow onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trash, 4 pages' }));
    expect(onOpen).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'PageTrash');
    expect(pageTrashStore.get().open).toBe(true);
  });

  it('stands on the rail as an icon only while it holds pages', async () => {
    api.list.mockResolvedValueOnce([]);
    act(() => pageTrashStore.attach(SESSION));
    await flush();
    const { container } = render(<PageTrashRailButton className="x" />);
    expect(container.querySelector('[data-page-trash-rail]')).toBeNull();
    await act(() => pageTrashStore.refresh());
    expect(container.querySelector('[data-page-trash-rail] > span')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Trash, 4 pages' }));
    expect(pageTrashStore.get().open).toBe(true);
  });
});

const editor = { see: true, deleteForever: true };
const participant = { see: true, deleteForever: false };

async function openDialog(rights = editor, focus: string | null = null) {
  act(() => pageTrashStore.attach(SESSION));
  await flush();
  act(() => pageTrashStore.open(focus));
  await flush();
  return render(<PageTrashHost rights={rights} />);
}

describe('the Trash dialog', () => {
  it('lists each page with its subpages, who and when, and Restore and Delete Forever for an Editor', async () => {
    await openDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Release Process');
    expect(dialog.textContent).toContain('and 2 Subpages');
    expect(dialog.textContent).toContain(
      `Deleted by Ana, ${DAY_MONTH.format(RELEASE.trashedAt)} · 12 days left`,
    );
    expect(dialog.textContent).toContain('Untitled Page');
    expect(screen.getByRole('button', { name: 'Restore Release Process' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete Forever: Release Process' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Empty Trash' })).toBeTruthy();
  });

  it("is a Participant's without Delete Forever or Empty Trash", async () => {
    await openDialog(participant);
    expect(screen.queryByRole('button', { name: /Delete Forever/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Empty Trash' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Restore Release Process' })).toBeTruthy();
  });

  it('marks the page a link opened it at', async () => {
    const { container } = await openDialog(editor, 'rollbacks');
    const marked = container.ownerDocument.querySelector('[aria-current="true"]');
    expect(marked?.getAttribute('data-trash-page')).toBe('release');
  });

  it('restores a page, and says when it came back at the top level', async () => {
    await openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Restore Release Process' }));
    await flush();
    expect(api.restore).toHaveBeenCalledWith(SESSION.who, 'kb', 'release');
    expect(toast.success).toHaveBeenCalledWith('Restored Release Process.');
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'RestorePage');
    api.restore.mockResolvedValueOnce({ restored: ['notes'], topLevel: true });
    fireEvent.click(screen.getByRole('button', { name: 'Restore Untitled Page' }));
    await flush();
    expect(toast.success).toHaveBeenCalledWith(
      'Restored Untitled Page at the top level: its parent page is gone.',
    );
  });

  it('says why a restore failed', async () => {
    api.restore.mockRejectedValueOnce(new ApiError('restore page', 409, 'page_limit'));
    await openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Restore Release Process' }));
    await flush();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('500 pages'));
  });

  it('deletes a page forever after asking, and not when declined', async () => {
    await openDialog();
    confirm.answer = false;
    fireEvent.click(screen.getByRole('button', { name: 'Delete Forever: Untitled Page' }));
    await flush();
    expect(api.forever).not.toHaveBeenCalled();
    confirm.answer = true;
    fireEvent.click(screen.getByRole('button', { name: 'Delete Forever: Release Process' }));
    await flush();
    expect(confirm.asked).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'Delete Release Process Forever?',
        message: expect.stringContaining('its subpages'),
        confirmLabel: 'Delete Forever',
      }),
    );
    expect(api.forever).toHaveBeenCalledWith(SESSION.who, 'kb', 'release');
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'DeletePageForever');
    api.forever.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Forever: Untitled Page' }));
    await flush();
    expect(confirm.asked).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'The page is removed for good. This cannot be undone.' }),
    );
    expect(toast.error).toHaveBeenCalledWith('Could not delete “Untitled Page”. Try again.');
  });

  it('empties the Trash after asking, into its empty state', async () => {
    await openDialog();
    confirm.answer = false;
    fireEvent.click(screen.getByRole('button', { name: 'Empty Trash' }));
    await flush();
    expect(api.empty).not.toHaveBeenCalled();
    confirm.answer = true;
    api.empty.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(screen.getByRole('button', { name: 'Empty Trash' }));
    await flush();
    expect(toast.error).toHaveBeenCalledWith('Could not empty the Trash. Try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Empty Trash' }));
    await flush();
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'EmptyPageTrash');
    expect(screen.getByRole('dialog').textContent).toContain('No Pages in the Trash');
  });

  it('shows the loading and the failed states, and tries again', async () => {
    let answer: (pages: TrashedPage[]) => void = () => {};
    api.list.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    // The open's own read is the one that fails; the first, overtaken by it, is dropped when it answers.
    api.list.mockRejectedValueOnce(new Error('x'));
    act(() => pageTrashStore.attach(SESSION));
    act(() => pageTrashStore.open());
    render(<PageTrashDialog rights={editor} onClose={vi.fn()} />);
    expect(screen.getByRole('status', { name: 'Loading the Trash' })).toBeTruthy();
    await flush();
    answer([]);
    await flush();
    expect(screen.getByRole('dialog').textContent).toContain('Could Not Load');
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await flush();
    expect(screen.getByRole('dialog').textContent).toContain('Release Process');
  });

  it('closes, and draws nothing for a session that may not see the Trash', async () => {
    const { container, rerender } = await openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(pageTrashStore.get().open).toBe(false);
    act(() => pageTrashStore.open());
    rerender(<PageTrashHost rights={{ see: false, deleteForever: false }} />);
    expect(container.ownerDocument.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe('who sees the Trash', () => {
  const state = (over: Record<string, unknown> = {}) =>
    ({
      documentId: 'kb',
      hydrated: true,
      can: { editPages: true, manageKnowledgebase: true },
      isStructureReadOnly: false,
      sessionTabScope: null,
      embedMode: false,
      workbench: null,
      sessionCommunity: false,
      ...over,
    }) as never;

  it('is a writer of the whole saved knowledgebase, and Delete Forever an Editor', async () => {
    const { pageTrashRightsOf } = await import('./usePageTrash');
    expect(pageTrashRightsOf(state(), false)).toEqual({ see: true, deleteForever: true });
    expect(
      pageTrashRightsOf(state({ can: { editPages: true, manageKnowledgebase: false } }), false),
    ).toEqual({ see: true, deleteForever: false });
    for (const over of [
      { can: { editPages: false, manageKnowledgebase: false } },
      { isStructureReadOnly: true },
      { sessionTabScope: 'tab' },
      { embedMode: true },
      { workbench: {} },
      { sessionCommunity: true },
      { hydrated: false },
      { documentId: null },
    ])
      expect(pageTrashRightsOf(state(over), false).see).toBe(false);
    // An Offline knowledgebase has no Trash.
    expect(pageTrashRightsOf(state(), true)).toEqual({ see: false, deleteForever: false });
  });
});
