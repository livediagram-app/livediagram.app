// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { PortalMenu } from './TabPortalMenu';

// jsdom lays nothing out, so the keep-on-screen clamp would chase a box that
// never moves. Where the menu sits is not what this file is about.
vi.mock('@/lib/clamp-to-viewport', () => ({ clampToViewport: () => ({ x: 0, y: 0 }) }));

// Paste in the tab / canvas menu (docs/specs/008-canvas/canvas-and-palette.md "Canvas menu: Paste"). Opened from
// an empty-canvas right-click, Paste is a labelled row at the top: that click
// is usually "put what I copied HERE". From the tab's ⋯ button it is an icon
// in the quick-action toolbar, one tab verb among several.

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
    otherDiagrams: [],
    folderNames: [],
    currentFolder: null,
    onMoveToFolder: noop,
    onRemoveFromFolder: noop,
    onDelete: noop,
    canDelete: true,
    canClearContent: true,
    canvas: {
      onAutoAlign: noop,
      onAutoLayout: noop,
      onPreviewCleanup: noop,
      onEndCleanupPreview: noop,
      onPaste: noop,
      canPaste: true,
    },
    ...over,
  } as Props;
}

const pasteRow = () => document.querySelector<HTMLElement>('[data-testid="canvas-paste-row"] > *');
const pasteIcon = () =>
  screen
    .queryAllByRole('button', { name: /^paste$/i })
    .find((b) => !b.closest('[data-testid="canvas-paste-row"]')) ?? null;

afterEach(() => cleanup());

describe('Paste in the menu', () => {
  it('leads the canvas right-click menu as a labelled row', () => {
    render(<PortalMenu {...props({ point: { x: 10, y: 10 } })} />);
    expect(pasteRow()).not.toBeNull();
    expect(pasteRow()!.textContent).toContain('Paste');
    // Not twice: the toolbar drops its icon when the row is there.
    expect(pasteIcon()).toBeNull();
  });

  it('pastes and closes from the row', () => {
    const onPaste = vi.fn();
    const onClose = vi.fn();
    const base = props({ point: { x: 10, y: 10 }, onClose });
    render(<PortalMenu {...base} canvas={{ ...base.canvas!, onPaste }} />);
    fireEvent.click(pasteRow()!);
    expect(onPaste).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalled();
  });

  it('stays put and greys out when there is nothing to paste', () => {
    const base = props({ point: { x: 10, y: 10 } });
    render(<PortalMenu {...base} canvas={{ ...base.canvas!, canPaste: false }} />);
    expect(pasteRow()!.getAttribute('aria-disabled')).toBe('true');
  });

  it('is an icon in the toolbar of the tab ⋯ menu', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    render(<PortalMenu {...props({ anchor })} />);
    expect(pasteIcon()).not.toBeNull();
    expect(pasteRow()).toBeNull();
  });
});
