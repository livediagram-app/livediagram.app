// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { EllipsisMenuButton } from './EllipsisMenuButton';

vi.mock('@liveworkspace/workbench/lib/clamp-to-viewport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/workbench/lib/clamp-to-viewport')>()),
  clampToViewport: () => ({ x: 0, y: 0 }),
}));

// Send to Plan's Send All (docs/specs/013-workspace/send-to-plan.md): the tab pill's ⋯ button hands the row on to the
// menu it opens, so an Editor finds Send Stickies to Plan there as on the canvas's right-click menu.

type Props = ComponentProps<typeof EllipsisMenuButton>;

function props(over: Partial<Props> = {}): Props {
  const noop = () => {};
  return {
    open: true,
    onToggle: noop,
    onClose: noop,
    onRename: noop,
    onDuplicate: noop,
    onClearContent: noop,
    onImport: noop,
    onExport: noop,
    onCopyTo: noop,
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

describe('Send Stickies to Plan on the tab pill’s menu', () => {
  it('shows the row it is given, sends and closes the menu', () => {
    const onSendStickies = vi.fn();
    const onClose = vi.fn();
    render(<EllipsisMenuButton {...props({ onSendStickies, onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send Stickies to Plan' }));
    expect(onSendStickies).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('has no row when the tab has nothing to send', () => {
    render(<EllipsisMenuButton {...props({ onSendStickies: null })} />);
    expect(screen.getByRole('button', { name: 'Export' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send Stickies to Plan' })).toBeNull();
  });
});
