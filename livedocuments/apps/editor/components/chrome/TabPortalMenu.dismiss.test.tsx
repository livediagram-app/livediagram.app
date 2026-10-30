// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { PortalMenu } from './TabPortalMenu';

vi.mock('@liveworkspace/workbench/lib/clamp-to-viewport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/workbench/lib/clamp-to-viewport')>()),
  clampToViewport: () => ({ x: 0, y: 0 }),
}));

// The tab menu closes on a press anywhere outside it, the canvas included, though the canvas stops its own
// pointer events (docs/specs/008-canvas/canvas-and-palette.md, Tab menu "Closing"; Work Tracker #41).

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
  };
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function open() {
  const onClose = vi.fn();
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  // The canvas stops every pointerdown it gets, so a listener on the bubble phase never hears it.
  const canvas = document.createElement('div');
  canvas.addEventListener('pointerdown', (e) => e.stopPropagation());
  document.body.appendChild(canvas);
  render(<PortalMenu {...props({ anchor, onClose })} />);
  return { onClose, anchor, canvas };
}

const press = (target: Element) =>
  act(() => {
    target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
  });

describe('Closing the tab menu', () => {
  it('closes on a click on the canvas', () => {
    const { onClose, canvas } = open();
    press(canvas);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open for a click inside it or on its own ellipsis', () => {
    const { onClose, anchor } = open();
    press(screen.getByRole('button', { name: 'Rename' }));
    press(anchor);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the window loses focus', () => {
    const { onClose } = open();
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
