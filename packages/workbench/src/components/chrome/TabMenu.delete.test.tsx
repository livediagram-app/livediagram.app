// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TabMenu, type TabMenuProps } from './TabMenu';

const viewport = vi.hoisted(() => ({ phone: false }));
vi.mock('../../hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => viewport.phone,
}));
vi.mock('../../lib/clamp-to-viewport', () => ({ clampToViewport: () => ({ x: 0, y: 0 }) }));

// Delete in the tab menu (docs/specs/007-editor/editor-app.md "Destructive actions" in each editor): asks nothing,
// since undo brings the tab back, except when deleting does what an undo cannot take back (liveplanner's
// deleteTabWarning): then a confirm anchored to Delete, in the anchored box and in a phone's sheet alike.

const noop = () => {};
function props(over: Partial<TabMenuProps> = {}): TabMenuProps {
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  return {
    anchor,
    onClose: noop,
    words: { item: 'tab', holder: 'plan' },
    onRename: noop,
    onDuplicate: noop,
    onClearContent: noop,
    onImport: noop,
    onExport: noop,
    onDelete: noop,
    canDelete: true,
    canClearContent: true,
    ...over,
  };
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  viewport.phone = false;
});

describe('Delete in the tab menu', () => {
  const open = (over: Partial<TabMenuProps>) => {
    render(<TabMenu {...props(over)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  };

  it('deletes at once, asking nothing', () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    open({ onDelete, onClose });
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog', { name: 'Delete this tab?' })).toBeNull();
  });

  it('asks first, with the warning, when deleting does what an undo cannot take back', async () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    open({ onDelete, onClose, deleteWarning: 'A form sends its responses here.' });
    expect(onDelete).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this tab?' });
    expect(dialog.textContent).toContain('A form sends its responses here.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the tab when the confirm is cancelled', async () => {
    const onDelete = vi.fn();
    open({ onDelete, deleteWarning: 'A form sends its responses here.' });
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this tab?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('asks in a phone’s sheet too', async () => {
    viewport.phone = true;
    open({ deleteWarning: 'A form sends its responses here.' });
    expect(await screen.findByRole('alertdialog', { name: 'Delete this tab?' })).toBeTruthy();
  });
});
