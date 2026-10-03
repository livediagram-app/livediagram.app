// @vitest-environment jsdom

// A folder just created opens renaming (docs/specs/013-workspace/folders.md): the row enters rename
// mode and tells the tree, once, so the request clears; clearing it leaves the rename open.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PanelFolderItem, type PanelFolder } from './PanelFolderItem';
import { PanelTreeProvider, type PanelTree } from './PanelTreeContext';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const folder: PanelFolder = { id: 'f1', name: 'Specs', parentId: null };

function tree(over: Partial<PanelTree> = {}): PanelTree {
  return {
    ownerId: 'me',
    currentDocumentId: null,
    exitingDocumentIds: new Set(),
    expanded: {},
    onToggle: vi.fn(),
    onOpenDocument: vi.fn(),
    onRenameFolder: vi.fn(),
    pendingRenameFolderId: null,
    onRenameFolderCommitted: vi.fn(),
    onCreateChild: vi.fn(),
    onCreateTeamChild: vi.fn(),
    ...over,
  };
}

const node = (t: PanelTree) => (
  <PanelTreeProvider value={t}>
    <ul role="tree" aria-label="Spaces">
      <PanelFolderItem
        folder={folder}
        depth={1}
        index={{ foldersByParent: new Map(), documentsByFolder: new Map() }}
      />
    </ul>
  </PanelTreeProvider>
);
const renameInput = () => screen.queryByDisplayValue('Specs');

afterEach(() => cleanup());

describe('PanelFolderItem rename request', () => {
  it('opens renaming when created pending, and clears the request once', () => {
    const committed = vi.fn();
    const { rerender } = render(
      node(tree({ pendingRenameFolderId: 'f1', onRenameFolderCommitted: committed })),
    );
    expect(renameInput()).not.toBeNull();
    expect(committed).toHaveBeenCalledTimes(1);
    rerender(node(tree({ pendingRenameFolderId: null, onRenameFolderCommitted: committed })));
    expect(renameInput()).not.toBeNull();
    expect(committed).toHaveBeenCalledTimes(1);
  });

  it('opens renaming when it becomes the pending folder', () => {
    const committed = vi.fn();
    const { rerender } = render(node(tree({ onRenameFolderCommitted: committed })));
    expect(renameInput()).toBeNull();
    rerender(node(tree({ pendingRenameFolderId: 'f1', onRenameFolderCommitted: committed })));
    expect(renameInput()).not.toBeNull();
    expect(committed).toHaveBeenCalledTimes(1);
  });

  it('ignores another folder pending', () => {
    const committed = vi.fn();
    render(node(tree({ pendingRenameFolderId: 'other', onRenameFolderCommitted: committed })));
    expect(renameInput()).toBeNull();
    expect(committed).not.toHaveBeenCalled();
  });
});
