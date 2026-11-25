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

// liveknowledge's canvas menu for the current page (liveworkspace/docs/specs/022-interface-design/action-parity.md
// "The tab menu"): the shared menu with this app's words, no lock and no tab folder, unchanged on screen from its own
// copy. It opens only from the canvas, and only for a session that may change the knowledgebase's pages (BottomBar).

type Props = ComponentProps<typeof TabMenu>;
const noop = () => {};
const props = (over: Partial<Props> = {}): Props => ({
  point: { x: 10, y: 10 },
  canvas: { onPaste: noop, canPaste: true },
  onClose: noop,
  onRename: noop,
  onDuplicate: noop,
  onClearContent: noop,
  onImport: noop,
  onExport: noop,
  onCopyTo: noop,
  locked: false,
  selfId: 'me',
  otherDocuments: [{ id: 'k2', name: 'Other' }],
  onDelete: noop,
  canDelete: true,
  canClearContent: true,
  ...over,
});
const labels = () =>
  Array.from(screen.getByRole('dialog', { name: 'Canvas menu' }).querySelectorAll('button'), (b) =>
    (b.getAttribute('aria-label') ?? b.textContent ?? '').trim(),
  );

// A greyed row: a disabled button, or one inside an aria-disabled row.
const greyed = (name: string) => {
  const el =
    screen.queryByRole('button', { name }) ?? screen.getByText(name).closest('[aria-disabled]');
  return (
    (el as HTMLButtonElement).disabled === true || el?.closest('[aria-disabled="true"]') != null
  );
};

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('the canvas menu for a page', () => {
  it('reads as it always has: no lock, no tab folder', () => {
    render(<TabMenu {...props()} />);
    expect(labels()).toEqual([
      'Rename',
      'Duplicate',
      'Delete',
      'Paste',
      'Add to Knowledgebase',
      'Import',
      'Export',
      'Clear',
    ]);
  });

  it('greys Import and Delete on a locked page', () => {
    render(<TabMenu {...props({ locked: true })} />);
    for (const name of ['Delete', 'Import']) expect(greyed(name)).toBe(true);
    expect(greyed('Export')).toBe(false);
  });

  it('adds the page to another knowledgebase through its picker', async () => {
    const onCopyTo = vi.fn();
    render(<TabMenu {...props({ onCopyTo })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Knowledgebase' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pick as me' }));
    expect(onCopyTo).toHaveBeenCalledWith('k2');
  });
});
