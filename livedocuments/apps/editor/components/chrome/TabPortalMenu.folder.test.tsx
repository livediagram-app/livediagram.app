// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { PortalMenu } from './TabPortalMenu';

vi.mock('@liveworkspace/workbench/lib/clamp-to-viewport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/workbench/lib/clamp-to-viewport')>()),
  clampToViewport: () => ({ x: 0, y: 0 }),
}));

// The tab menu's folder row (docs/specs/006-document/tab-folders.md): named for what it does, and it
// opens the folder dialog under the same name.

type Props = ComponentProps<typeof PortalMenu>;

function props(over: Partial<Props> = {}): Props {
  const noop = () => {};
  return {
    onClose: noop,
    onRename: noop,
    onDuplicate: noop,
    onClearContent: noop,
    onImport: noop,
    onExport: noop,
    onCopyTo: noop,
    onToggleLock: noop,
    locked: false,
    selfId: 'me',
    otherDocuments: [],
    folders: [],
    currentFolder: null,
    onMoveToFolder: noop,
    onRemoveFromFolder: noop,
    onSetFolderColour: noop,
    onDelete: noop,
    canDelete: true,
    canClearContent: true,
    ...over,
  };
}

afterEach(() => cleanup());

describe('Organise in Tab Folder in the tab menu', () => {
  it('opens the folder dialog under the same name', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    render(
      <PortalMenu {...props({ anchor, folders: [{ name: 'Drafts', count: 1, colour: null }] })} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Organise in Tab Folder' }));
    const dialog = screen.getByRole('dialog', { name: 'Organise in Tab Folder' });
    expect(within(dialog).getByRole('heading', { name: 'Organise in Tab Folder' })).toBeTruthy();
    expect(within(dialog).getByText('Drafts')).toBeTruthy();
  });

  // A folder's colour never moves the tab or closes the dialog (tab-folders.md "Membership UX").
  it("sets a folder's colour from its row and keeps the dialog open", () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    const onSetFolderColour = vi.fn();
    const onMoveToFolder = vi.fn();
    const onClose = vi.fn();
    render(
      <PortalMenu
        {...props({
          anchor,
          onClose,
          onMoveToFolder,
          onSetFolderColour,
          folders: [{ name: 'Drafts', count: 2, colour: null }],
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Organise in Tab Folder' }));
    fireEvent.click(screen.getByRole('button', { name: /^Folder Colour for Drafts/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Violet' }));
    expect(onSetFolderColour).toHaveBeenCalledWith('Drafts', 'violet');
    expect(onMoveToFolder).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Organise in Tab Folder' })).toBeTruthy();
    anchor.remove();
  });

  // A keyboard user closing the picker lands back on the tab's ⋯, not on the page.
  it('gives focus back to the tab menu button when the dialog closes', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    const onClose = vi.fn();
    const { unmount } = render(<PortalMenu {...props({ anchor, onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Organise in Tab Folder' }));
    const dialog = screen.getByRole('dialog', { name: 'Organise in Tab Folder' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
    unmount();
    expect(document.activeElement).toBe(anchor);
    anchor.remove();
  });
});
