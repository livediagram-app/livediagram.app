// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { PortalMenu } from './TabPortalMenu';

vi.mock('@liveworkspace/workbench/lib/clamp-to-viewport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/workbench/lib/clamp-to-viewport')>()),
  clampToViewport: () => ({ x: 0, y: 0 }),
}));

// Delete in the tab menu (docs/specs/007-editor/editor-app.md "Destructive actions"): asks nothing, since undo brings
// the tab back, except when deleting does what an undo cannot take back (deleteTabWarning).

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
    otherProjects: [],
    folderNames: [],
    currentFolder: null,
    onMoveToFolder: noop,
    onRemoveFromFolder: noop,
    onDelete: noop,
    canDelete: true,
    canClearContent: true,
    ...over,
  };
}

afterEach(() => cleanup());

describe('Delete in the tab menu', () => {
  const open = (over: Partial<Props>) => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    render(<PortalMenu {...props({ anchor, ...over })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  };

  it('deletes at once, asking nothing', () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    open({ onDelete, onClose });
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Delete this tab?' })).toBeNull();
  });

  it('asks first, with the warning, when deleting does what an undo cannot take back', () => {
    const onDelete = vi.fn();
    open({ onDelete, deleteWarning: 'A form sends its responses here.' });
    expect(onDelete).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Delete this tab?' });
    expect(dialog.textContent).toContain('A form sends its responses here.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
