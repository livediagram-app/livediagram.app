// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TabMenu, type TabMenuProps } from './TabMenu';

vi.mock('../../lib/clamp-to-viewport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/clamp-to-viewport')>()),
  clampToViewport: () => ({ x: 0, y: 0 }),
}));

// The tab menu's folder row (docs/specs/006-*/tab-folders.md in each editor): named for what it does, and it opens
// the folder dialog under the same name.

const noop = () => {};
function props(over: Partial<TabMenuProps> = {}): TabMenuProps {
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  return {
    anchor,
    onClose: noop,
    words: { item: 'tab', holder: 'canvas' },
    onRename: noop,
    onDuplicate: noop,
    onClearContent: noop,
    onImport: noop,
    onExport: noop,
    onDelete: noop,
    canDelete: true,
    canClearContent: true,
    folders: [],
    currentFolder: null,
    onMoveToFolder: noop,
    onRemoveFromFolder: noop,
    onSetFolderColour: noop,
    ...over,
  };
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('Organise in Tab Folder in the tab menu', () => {
  it('opens the folder dialog under the same name', async () => {
    render(<TabMenu {...props({ folders: [{ name: 'Drafts', count: 1, colour: null }] })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Organise in Tab Folder' }));
    const dialog = await screen.findByRole('dialog', { name: 'Organise in Tab Folder' });
    expect(within(dialog).getByRole('heading', { name: 'Organise in Tab Folder' })).toBeTruthy();
    expect(within(dialog).getByText('Drafts')).toBeTruthy();
  });

  // A folder's colour never moves the tab or closes the dialog (tab-folders.md "Membership UX").
  it("sets a folder's colour from its row and keeps the dialog open", async () => {
    const onSetFolderColour = vi.fn();
    const onMoveToFolder = vi.fn();
    const onClose = vi.fn();
    render(
      <TabMenu
        {...props({
          onClose,
          onMoveToFolder,
          onSetFolderColour,
          folders: [{ name: 'Drafts', count: 2, colour: null }],
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Organise in Tab Folder' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Folder Colour for Drafts/ }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Violet' }));
    expect(onSetFolderColour).toHaveBeenCalledWith('Drafts', 'violet');
    expect(onMoveToFolder).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Organise in Tab Folder' })).toBeTruthy();
  });

  // A keyboard user closing the picker lands back on the tab's ⋯, not on the page.
  it('gives focus back to the tab menu button when the dialog closes', async () => {
    const onClose = vi.fn();
    const p = props({ onClose });
    const { unmount } = render(<TabMenu {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Organise in Tab Folder' }));
    const dialog = await screen.findByRole('dialog', { name: 'Organise in Tab Folder' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
    unmount();
    expect(document.activeElement).toBe(p.anchor);
  });

  it('works with only a move handed in: a colour or No Folder does nothing', async () => {
    const onMoveToFolder = vi.fn();
    const onClose = vi.fn();
    render(
      <TabMenu
        {...props({
          onClose,
          currentFolder: 'Drafts',
          folders: [{ name: 'Drafts', count: 1, colour: null }],
          onRemoveFromFolder: undefined,
          onSetFolderColour: undefined,
          onMoveToFolder,
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Organise in Tab Folder' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Folder Colour for Drafts/ }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Violet' }));
    fireEvent.click(await screen.findByRole('button', { name: /No Folder/ }));
    expect(onMoveToFolder).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('is absent where the app offers no tab folders', () => {
    render(<TabMenu {...props({ onMoveToFolder: undefined })} />);
    expect(screen.queryByRole('button', { name: 'Organise in Tab Folder' })).toBeNull();
  });
});
