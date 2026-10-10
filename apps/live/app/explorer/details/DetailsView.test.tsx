// @vitest-environment jsdom

// The Details view's table (docs/specs/013-workspace/explorer-details-view.md).

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Folder } from '@/lib/api-client';
import { writeLocalStorageValue } from '@/hooks/ui/useLocalStorageValue';
import { DOCUMENT_DRAG_MIME } from '@/components/panels/explorer-drag-mime';
import type { ExplorerViewProps } from '../explorer-view-props';
import type { PaneDocument } from '../views';
import { DetailsView } from './DetailsView';
import { DETAILS_SORT_STORAGE_KEY } from './useDetailsSort';

beforeEach(() => {
  // A row's snapshot prefetch watches for the viewport; jsdom has none.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  act(() => writeLocalStorageValue(DETAILS_SORT_STORAGE_KEY, 'updated:desc'));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const doc = (id: string, over: Partial<PaneDocument> = {}): PaneDocument => ({
  id,
  name: id,
  folderId: null,
  savedAt: 1,
  shareCode: null,
  ownerId: 'me',
  // Empty, so no thumbnail is fetched.
  empty: true,
  ...over,
});

const folder: Folder = {
  id: 'f1',
  name: 'Projects',
  parentId: null,
  createdAt: 1,
  updatedAt: 1,
  teamId: null,
} as Folder;

function view(documents: PaneDocument[], folders: Folder[] = []): ExplorerViewProps {
  return {
    folders,
    documents,
    ownerId: 'me',
    onOpenFolder: vi.fn(),
    onCommitRenameFolder: vi.fn(),
    onCancelRenameFolder: vi.fn(),
    renamingFolderId: null,
    renamingDocumentId: null,
    onCommitRenameDocument: vi.fn(),
    onCancelRenameDocument: vi.fn(),
    folderActions: () => ({
      rename: vi.fn(),
      newSubfolder: vi.fn(),
      move: vi.fn(),
      delete: vi.fn(),
    }),
    onStartRenameDocument: vi.fn(),
    onDuplicateDocument: vi.fn(),
    onDeleteDocument: vi.fn(),
    onMoveDocument: vi.fn(),
    childrenCount: () => 1,
    documentsCount: () => 2,
  };
}

const rowNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[0]!.textContent);

describe('DetailsView', () => {
  it('heads every column, Updated sorted newest first', () => {
    render(<DetailsView {...view([doc('a')])} />);
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers.slice(0, 7)).toEqual([
      'Name',
      'Type',
      'Comments',
      'Access',
      'Size',
      'Created',
      'Updated, sorted descending',
    ]);
    const sorted = screen.getAllByRole('columnheader').filter((h) => h.hasAttribute('aria-sort'));
    expect(sorted.map((h) => h.getAttribute('aria-sort'))).toEqual(['descending']);
  });

  it('shows a counted document: mode, comments, access and size', () => {
    render(
      <DetailsView
        {...view([
          doc('Plan', { stats: { mode: 'plan', elements: 12, comments: 3, bytes: 12 * 1024 } }),
        ])}
      />,
    );
    const cells = within(screen.getAllByRole('row')[1]!).getAllByRole('cell');
    expect(cells[1]!.textContent).toBe('Plan');
    expect(cells[2]!.textContent).toBe('3');
    expect(cells[3]!.textContent).toBe('Editor');
    expect(cells[4]!.textContent).toMatch(/^12 objects \(12 KB\)$/);
  });

  it('says what is not counted yet', () => {
    render(<DetailsView {...view([doc('Old', { stats: null })])} />);
    const cells = within(screen.getAllByRole('row')[1]!).getAllByRole('cell');
    for (const i of [1, 2, 4]) expect(cells[i]!.textContent).toBe('–Not counted yet');
  });

  it('shows the role a shared document grants', () => {
    render(
      <DetailsView
        {...view([doc('Theirs', { shared: { role: 'view', ownerName: 'Ann', shareCode: 's' } })])}
      />,
    );
    expect(within(screen.getAllByRole('row')[1]!).getAllByRole('cell')[3]!.textContent).toBe(
      'Viewer',
    );
  });

  it('lists folders first, with their item count', () => {
    render(<DetailsView {...view([doc('Doc', { savedAt: 99 })], [folder])} />);
    expect(rowNames()).toEqual(['Projects', 'Doc']);
    const cells = within(screen.getAllByRole('row')[1]!).getAllByRole('cell');
    expect(cells[1]!.textContent).toBe('Folder');
    expect(cells[4]!.textContent).toBe('3 items');
  });

  it('sorts by a pressed column, then reverses it', () => {
    render(<DetailsView {...view([doc('b'), doc('c'), doc('a')])} />);
    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(rowNames()).toEqual(['a', 'b', 'c']);
    fireEvent.click(screen.getByRole('button', { name: /^Name, sorted ascending$/ }));
    expect(rowNames()).toEqual(['c', 'b', 'a']);
  });

  it('drags a document row, but not one shared with the reader', () => {
    render(
      <DetailsView
        {...view([
          doc('Mine'),
          doc('Theirs', { shared: { role: 'edit', ownerName: null, shareCode: 's' } }),
        ])}
      />,
    );
    const [mine, theirs] = screen.getAllByRole('row').slice(1);
    expect(mine!.getAttribute('draggable')).toBe('true');
    expect(theirs!.hasAttribute('draggable')).toBe(false);
    const setData = vi.fn();
    fireEvent.dragStart(mine!, { dataTransfer: { setData, effectAllowed: '' } });
    expect(setData).toHaveBeenCalledWith(DOCUMENT_DRAG_MIME, 'Mine');
  });

  it('hides each menu until hover', () => {
    render(<DetailsView {...view([doc('a')])} />);
    expect(screen.getByRole('button', { name: 'Menu for a' }).className).toContain(
      'pointer-fine:opacity-0',
    );
  });
});
