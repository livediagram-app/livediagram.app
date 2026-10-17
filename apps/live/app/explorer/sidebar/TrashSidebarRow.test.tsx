// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The sidebar's Trash as a drop target (docs/specs/013-workspace/explorer-structure.md "Dragging to the Trash"): it
// wakes while a document or folder is dragged, opens up while the drag is over it, and sends a drop through the
// item's own Delete. Anything else dragged leaves it alone.

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));

import { ExplorerProvider } from '../ExplorerContext';
import type { ExplorerStateValue } from '../useExplorerState';
import { DOCUMENT_DRAG_MIME, FOLDER_DRAG_MIME } from '@/components/panels/explorer-drag-mime';
import { TRASH_GULP_MS, TrashSidebarRow } from './TrashSidebarRow';

const deleteDocument = vi.fn(async () => {});
const deleteFolder = vi.fn(async () => {});
const folderActions = vi.fn(() => ({ delete: deleteFolder }));
const go = vi.fn();

function renderRow() {
  const value = {
    selected: { kind: 'home' },
    go,
    folders: [{ id: 'f1', name: 'Projects', parentId: null }],
    folderActions,
    deleteDocument,
  } as unknown as ExplorerStateValue;
  return render(
    <ExplorerProvider value={value}>
      <ul role="tree" aria-label="More">
        <TrashSidebarRow />
      </ul>
    </ExplorerProvider>,
  );
}

/** A drag carrying `types`, with `data` behind them (readable on drop). */
function dataTransfer(types: string[], data: Record<string, string> = {}) {
  return { types, getData: (t: string) => data[t] ?? '', dropEffect: 'none' };
}

/** The window hears a drag start (the source's half). */
function startDrag(types: string[]) {
  const e = new Event('dragstart') as DragEvent;
  Object.defineProperty(e, 'dataTransfer', { value: { types } });
  act(() => {
    window.dispatchEvent(e);
  });
}

const line = () => screen.getByRole('treeitem').querySelector('[data-tree-row]')!;

beforeEach(() => {
  vi.useFakeTimers();
  track.mockReset();
  deleteDocument.mockClear();
  deleteFolder.mockClear();
  folderActions.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TrashSidebarRow', () => {
  it('is the Trash row at rest, opening the Trash', () => {
    renderRow();
    expect(screen.getByRole('treeitem', { name: 'Trash' })).toBeTruthy();
    expect(line().textContent).toContain('Trash');
    fireEvent.click(line().querySelector('[data-tree-activate]')!);
    expect(go).toHaveBeenCalledWith({ kind: 'trash' });
  });

  it('wakes as a dashed target while a document is dragged anywhere', () => {
    renderRow();
    startDrag([DOCUMENT_DRAG_MIME]);
    expect(line().className).toContain('border-dashed');
    expect(line().textContent).toContain('Drop to Trash');
    expect(screen.getByRole('status').textContent).toBe('Drop to Trash');
    // The row keeps its name.
    expect(screen.getByRole('treeitem', { name: 'Trash' })).toBeTruthy();
  });

  it('stays asleep for a drag of anything else', () => {
    renderRow();
    startDrag(['text/plain']);
    expect(line().className).not.toContain('border-dashed');
    fireEvent.dragOver(line(), { dataTransfer: dataTransfer(['Files']) });
    expect(line().textContent).toContain('Trash');
    expect(line().textContent).not.toContain('Let go');
  });

  it('opens up as soon as the drag enters it', () => {
    renderRow();
    startDrag([FOLDER_DRAG_MIME]);
    fireEvent.dragEnter(line(), { dataTransfer: dataTransfer([FOLDER_DRAG_MIME]) });
    expect(line().textContent).toContain('Let go to trash it');
  });

  it('opens up while the drag is over it, then settles when it leaves', () => {
    renderRow();
    startDrag([DOCUMENT_DRAG_MIME]);
    fireEvent.dragEnter(line(), { dataTransfer: dataTransfer([DOCUMENT_DRAG_MIME]) });
    fireEvent.dragOver(line(), { dataTransfer: dataTransfer([DOCUMENT_DRAG_MIME]) });
    expect(line().className).toContain('bg-brand-700');
    expect(line().textContent).toContain('Let go to trash it');
    expect(line().querySelector('[data-trash-bin]')!.getAttribute('data-trash-bin')).toBe('tipped');
    fireEvent.dragLeave(line());
    expect(line().className).not.toContain('bg-brand-700');
    expect(line().textContent).toContain('Drop to Trash');
  });

  it('sends a dropped document to the Trash, and swallows it with one bounce', () => {
    renderRow();
    startDrag([DOCUMENT_DRAG_MIME]);
    fireEvent.drop(line(), {
      dataTransfer: dataTransfer([DOCUMENT_DRAG_MIME], { [DOCUMENT_DRAG_MIME]: 'd1' }),
    });
    expect(deleteDocument).toHaveBeenCalledWith('d1');
    expect(track).toHaveBeenCalledWith('UI', 'Selected', 'Sidebar.TrashDropDocument');
    expect(line().querySelector('[data-trash-bin]')!.getAttribute('data-trash-bin')).toBe('gulp');
    act(() => {
      vi.advanceTimersByTime(TRASH_GULP_MS);
    });
    expect(line().querySelector('[data-trash-bin]')!.getAttribute('data-trash-bin')).toBe('rest');
  });

  it("sends a dropped folder through the folder's own Delete", () => {
    renderRow();
    startDrag([FOLDER_DRAG_MIME]);
    fireEvent.drop(line(), {
      dataTransfer: dataTransfer([FOLDER_DRAG_MIME], { [FOLDER_DRAG_MIME]: 'f1' }),
    });
    expect(folderActions).toHaveBeenCalledWith(expect.objectContaining({ id: 'f1' }), null);
    expect(deleteFolder).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('UI', 'Selected', 'Sidebar.TrashDropFolder');
  });

  it('deletes nothing for a folder it does not know', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderRow();
    fireEvent.drop(line(), {
      dataTransfer: dataTransfer([FOLDER_DRAG_MIME], { [FOLDER_DRAG_MIME]: 'gone' }),
    });
    expect(deleteFolder).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('goes back to rest when the drag ends anywhere', () => {
    renderRow();
    startDrag([DOCUMENT_DRAG_MIME]);
    fireEvent.dragOver(line(), { dataTransfer: dataTransfer([DOCUMENT_DRAG_MIME]) });
    act(() => {
      window.dispatchEvent(new Event('dragend'));
    });
    expect(line().className).not.toContain('border-dashed');
    expect(line().className).not.toContain('bg-brand-700');
    expect(line().textContent).toContain('Trash');
  });
});
