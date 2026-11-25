// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { TabMenu } from './TabMenu';

vi.mock('@liveworkspace/workbench/lib/clamp-to-viewport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/workbench/lib/clamp-to-viewport')>()),
  clampToViewport: () => ({ x: 0, y: 0 }),
}));
// The picker itself is the dialog's own test; here, only what the menu hands it.
vi.mock('@/components/dialogs/TabOrganiseDialogs', () => ({
  AddTabToDocumentDialog: (p: {
    ownerId: string;
    otherDocuments: { id: string }[];
    onPick: (id: string) => void;
  }) => (
    <button type="button" onClick={() => p.onPick(p.otherDocuments[0]!.id)}>
      {`Pick as ${p.ownerId}`}
    </button>
  ),
}));

// livedocuments' tab menu (liveworkspace/docs/specs/022-interface-design/action-parity.md "The tab menu"): the shared
// menu with this app's words, unchanged on screen from its own copy.

type Props = ComponentProps<typeof TabMenu>;
const noop = () => {};
const props = (over: Partial<Props> = {}): Props => ({
  anchor: document.body.appendChild(document.createElement('button')),
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
  otherDocuments: [{ id: 'd2', name: 'Other' }],
  folders: [],
  currentFolder: null,
  onMoveToFolder: noop,
  onRemoveFromFolder: noop,
  onSetFolderColour: noop,
  onDelete: noop,
  canDelete: true,
  canClearContent: true,
  ...over,
});
const labels = () =>
  Array.from(screen.getByRole('dialog', { name: 'Tab menu' }).querySelectorAll('button'), (b) =>
    (b.getAttribute('aria-label') ?? b.textContent ?? '').trim(),
  );

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('the tab menu', () => {
  it('reads as it always has', () => {
    render(<TabMenu {...props()} />);
    expect(labels()).toEqual([
      'Rename',
      'Duplicate',
      'Lock Tab',
      'Delete',
      'Organise in Tab Folder',
      'Add to Document',
      'Import',
      'Export',
      'Clear',
    ]);
  });

  it('adds the tab to another document through its picker', async () => {
    const onCopyTo = vi.fn();
    render(<TabMenu {...props({ onCopyTo })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Document' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pick as me' }));
    expect(onCopyTo).toHaveBeenCalledWith('d2');
  });
});
