// @vitest-environment jsdom

// A folder just created opens renaming (docs/specs/013-workspace/folders.md): the node enters rename mode
// and tells the tree, once, so the request clears; clearing it leaves the rename open.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FolderNode, type PanelFolder, type PanelFolderTree } from './FolderNode';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const folder: PanelFolder = { id: 'f1', name: 'Specs', parentId: null };

function tree(over: Partial<PanelFolderTree> = {}): PanelFolderTree {
  return {
    foldersByParent: new Map(),
    documentsByFolder: new Map(),
    expanded: {},
    onToggleExpanded: vi.fn(),
    onRenameFolder: vi.fn(),
    rows: {} as PanelFolderTree['rows'],
    ...over,
  };
}

const node = (t: PanelFolderTree) => (
  <ul>
    <FolderNode folder={folder} depth={0} tree={t} />
  </ul>
);
const renameInput = () => screen.queryByDisplayValue('Specs');

afterEach(() => cleanup());

describe('FolderNode rename request', () => {
  it('opens renaming when created pending, and clears the request once', () => {
    const committed = vi.fn();
    const { rerender } = render(
      node(tree({ pendingRenameId: 'f1', onRenameFolderCommitted: committed })),
    );
    expect(renameInput()).not.toBeNull();
    expect(committed).toHaveBeenCalledTimes(1);
    rerender(node(tree({ pendingRenameId: null, onRenameFolderCommitted: committed })));
    expect(renameInput()).not.toBeNull();
    expect(committed).toHaveBeenCalledTimes(1);
  });

  it('opens renaming when it becomes the pending folder', () => {
    const committed = vi.fn();
    const { rerender } = render(node(tree({ onRenameFolderCommitted: committed })));
    expect(renameInput()).toBeNull();
    rerender(node(tree({ pendingRenameId: 'f1', onRenameFolderCommitted: committed })));
    expect(renameInput()).not.toBeNull();
    expect(committed).toHaveBeenCalledTimes(1);
  });

  it('ignores another folder pending', () => {
    const committed = vi.fn();
    render(node(tree({ pendingRenameId: 'other', onRenameFolderCommitted: committed })));
    expect(renameInput()).toBeNull();
    expect(committed).not.toHaveBeenCalled();
  });
});
