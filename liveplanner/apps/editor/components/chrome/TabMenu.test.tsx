// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { TabMenu } from './TabMenu';

vi.mock('@liveworkspace/workbench/lib/clamp-to-viewport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/workbench/lib/clamp-to-viewport')>()),
  clampToViewport: () => ({ x: 0, y: 0 }),
}));

// liveplanner's tab menu (liveworkspace/docs/specs/022-interface-design/action-parity.md "The tab menu"): the shared
// menu with this app's words, its Import… and its own row, View As Diagram, unchanged on screen from its own copy.

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
  onToggleLock: noop,
  locked: false,
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
  Array.from(screen.getByRole('dialog').querySelectorAll('button'), (b) =>
    (b.getAttribute('aria-label') ?? b.textContent ?? '').trim(),
  );
// The lit file rows (a greyed row is not a button).
const fileRows = () => labels().filter((t) => /Import|Export|Download/.test(t));

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
      'Import…',
      'Export',
      'Clear',
    ]);
  });

  // docs/specs/006-project/tab-project-many-to-many.md "Add to Plan": not offered, a tab's cards stay in their plan.
  it('offers no way to add the tab to another plan', () => {
    render(<TabMenu {...props({ point: { x: 10, y: 10 }, anchor: undefined })} />);
    expect(screen.queryByRole('button', { name: /Add to/ })).toBeNull();
  });
});

describe('the tab menu’s Import and Export rows', () => {
  it('are Import… and Export on every tab, a Board or Sheet tab’s included', () => {
    const onExport = vi.fn();
    const onImport = vi.fn();
    render(<TabMenu {...props({ onExport, onImport })} />);
    // No Import CSV… or Import from Another Tool… beside it: both are rows of the one Import dialog.
    expect(fileRows()).toEqual(['Import…', 'Export']);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(onExport).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Import…' }));
    expect(onImport).toHaveBeenCalledOnce();
  });

  // docs/specs/026-plan/plan-tabs.md "The Import dialog": dimmed only when the dialog has nothing to press.
  it('dims Import… when the Import dialog would have nothing to press', () => {
    render(<TabMenu {...props({ canImport: false })} />);
    const row = screen.getByText('Import…').closest('[aria-disabled]');
    expect(row?.getAttribute('aria-disabled')).toBe('true');
    expect(fileRows()).toEqual(['Export']);
  });

  it('keeps Import… lit on a locked tab when the dialog offers another tool', () => {
    render(<TabMenu {...props({ locked: true, canImport: true })} />);
    expect(fileRows()).toEqual(['Import…', 'Export']);
  });

  it('dims Import… on a locked tab by default', () => {
    render(<TabMenu {...props({ locked: true })} />);
    expect(fileRows()).toEqual(['Export']);
  });
});

// View As Diagram (docs/specs/026-plan/view-as-diagram.md "Where"): a row after Export, only when the tab bar offers it
// (a Board tab, for those who may change tabs).
describe('View As Diagram in the tab menu', () => {
  it('is a row after Export when offered, and asks when chosen', () => {
    const onViewAsDiagram = vi.fn();
    render(<TabMenu {...props({ onViewAsDiagram })} />);
    expect(labels().slice(-3)).toEqual(['Export', 'View As Diagram', 'Clear']);
    fireEvent.click(screen.getByRole('button', { name: 'View As Diagram' }));
    expect(onViewAsDiagram).toHaveBeenCalledOnce();
  });

  it('is absent when not offered', () => {
    render(<TabMenu {...props()} />);
    expect(screen.queryByRole('button', { name: 'View As Diagram' })).toBeNull();
  });
});

// Delete asks first only when it does what an undo cannot take back (deleteTabWarning).
describe('Delete in the tab menu', () => {
  it('asks first, with the warning, for a tab a form sends its responses to', async () => {
    const onDelete = vi.fn();
    render(<TabMenu {...props({ onDelete, deleteWarning: 'A form sends its responses here.' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this tab?' });
    expect(dialog.textContent).toContain('A form sends its responses here.');
    expect(onDelete).not.toHaveBeenCalled();
  });
});
