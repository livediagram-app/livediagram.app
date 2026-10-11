// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { PortalMenu } from './TabPortalMenu';

vi.mock('@/lib/clamp-to-viewport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/clamp-to-viewport')>()),
  clampToViewport: () => ({ x: 0, y: 0 }),
}));

// A tab added to another document lives on there when deleted here (docs/specs/006-document/tab-document-many-to-many.md),
// and the menu can't tell which tabs are, so Delete's confirm never claims the content is gone for good.

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
    folderNames: [],
    currentFolder: null,
    onMoveToFolder: noop,
    onRemoveFromFolder: noop,
    onDelete: noop,
    canDelete: true,
    canClearContent: true,
    ...over,
  } as Props;
}

afterEach(() => cleanup());

describe('Delete in the tab menu', () => {
  it('confirms with copy that allows for a tab another document also holds', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    render(<PortalMenu {...props({ anchor })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(
      screen.getByText(
        "Delete this tab? Unless another document also holds it, its content can't be recovered.",
      ),
    ).toBeTruthy();
  });
});
