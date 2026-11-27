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
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label="Add to Another Canvas">
      <button type="button" onClick={() => p.onPick(p.otherDocuments[0]!.id)}>
        {`Pick as ${p.ownerId}`}
      </button>
    </div>
  ),
}));

// livediagram's tab menu (liveworkspace/docs/specs/022-interface-design/action-parity.md "The tab menu"): the shared
// menu with this app's words and rows, unchanged on screen from its own copy.

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
    render(<TabMenu {...props({ otherDocuments: [{ id: 'd2', name: 'Other' }] })} />);
    expect(labels()).toEqual([
      'Rename',
      'Duplicate',
      'Lock Tab',
      'Delete',
      'Organise in Tab Folder',
      'Add to Another Canvas',
      'Import',
      'Export',
      'Clear',
    ]);
  });

  it('adds the tab to another canvas through its picker', async () => {
    const onCopyTo = vi.fn();
    render(<TabMenu {...props({ onCopyTo, otherDocuments: [{ id: 'd2', name: 'Other' }] })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Another Canvas' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pick as me' }));
    expect(onCopyTo).toHaveBeenCalledWith('d2');
  });
});

// Make Plan Cards in the tab menu (docs/specs/013-workspace/make-plan-cards.md "Where"): a row after Export, only when
// the tab bar offers it (the tab shown, with a shape that has words, in a session that may send).
describe('Make Plan Cards in the tab menu', () => {
  it('is a row after Export when offered, and asks when chosen', () => {
    const onMakePlanCards = vi.fn();
    render(<TabMenu {...props({ onMakePlanCards })} />);
    expect(labels().slice(-3)).toEqual(['Export', 'Make Plan Cards', 'Clear']);
    fireEvent.click(screen.getByRole('button', { name: 'Make Plan Cards' }));
    expect(onMakePlanCards).toHaveBeenCalledOnce();
  });

  it('is absent when not offered', () => {
    render(<TabMenu {...props()} />);
    expect(screen.queryByRole('button', { name: 'Make Plan Cards' })).toBeNull();
  });
});
