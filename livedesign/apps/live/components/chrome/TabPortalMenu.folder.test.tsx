// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { PortalMenu } from './TabPortalMenu';

vi.mock('@liveworkspace/workbench/lib/clamp-to-viewport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/workbench/lib/clamp-to-viewport')>()),
  clampToViewport: () => ({ x: 0, y: 0 }),
}));

// The tab menu's folder row (docs/specs/006-design/tab-folders.md): named for what it does, and it
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
    otherDesigns: [],
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

describe('Organise in Tab Folder in the tab menu', () => {
  it('opens the folder dialog under the same name', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    render(<PortalMenu {...props({ anchor, folderNames: ['Drafts'] })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Organise in Tab Folder' }));
    const dialog = screen.getByRole('dialog', { name: 'Organise in Tab Folder' });
    expect(within(dialog).getByRole('heading', { name: 'Organise in Tab Folder' })).toBeTruthy();
    expect(within(dialog).getByText('Drafts')).toBeTruthy();
  });
});
