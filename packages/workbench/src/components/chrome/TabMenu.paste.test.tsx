// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TabMenu, type TabMenuProps } from './TabMenu';

// jsdom lays nothing out, so the keep-on-screen clamp would chase a box that never moves.
vi.mock('../../lib/clamp-to-viewport', () => ({ clampToViewport: () => ({ x: 0, y: 0 }) }));

// Paste in the tab / canvas menu (docs/specs/008-canvas/canvas-and-palette.md "Canvas menu: Paste" in each editor).
// Opened from an empty-canvas right-click, Paste is a labelled row at the top: that click is usually "put what I
// copied HERE". From the tab's ⋯ button it is an icon in the quick-action toolbar, one tab verb among several.

const noop = () => {};
function props(over: Partial<TabMenuProps> = {}): TabMenuProps {
  return {
    onClose: noop,
    words: { item: 'tab', holder: 'canvas' },
    onRename: noop,
    onDuplicate: noop,
    onClearContent: noop,
    onImport: noop,
    onExport: noop,
    onDelete: noop,
    canDelete: true,
    canClearContent: true,
    canvas: { onPaste: noop, canPaste: true },
    ...over,
  };
}

const pasteRow = () => document.querySelector<HTMLElement>('[data-testid="canvas-paste-row"] > *');
const pasteIcon = () =>
  screen
    .queryAllByRole('button', { name: /^paste$/i })
    .find((b) => !b.closest('[data-testid="canvas-paste-row"]')) ?? null;

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('Paste in the menu', () => {
  it('leads the canvas right-click menu as a labelled row', () => {
    render(<TabMenu {...props({ point: { x: 10, y: 10 } })} />);
    expect(pasteRow()!.textContent).toContain('Paste');
    // Not twice: the toolbar drops its icon when the row is there.
    expect(pasteIcon()).toBeNull();
  });

  it('pastes and closes from the row', () => {
    const onPaste = vi.fn();
    const onClose = vi.fn();
    render(
      <TabMenu
        {...props({ point: { x: 10, y: 10 }, onClose, canvas: { onPaste, canPaste: true } })}
      />,
    );
    fireEvent.click(pasteRow()!);
    expect(onPaste).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalled();
  });

  it('stays put and greys out when there is nothing to paste', () => {
    render(
      <TabMenu
        {...props({ point: { x: 10, y: 10 }, canvas: { onPaste: noop, canPaste: false } })}
      />,
    );
    expect(pasteRow()!.getAttribute('aria-disabled')).toBe('true');
  });

  it('is an icon in the toolbar of the tab ⋯ menu that pastes and closes', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    const onPaste = vi.fn();
    const onClose = vi.fn();
    render(<TabMenu {...props({ anchor, onClose, canvas: { onPaste, canPaste: true } })} />);
    expect(pasteRow()).toBeNull();
    fireEvent.click(pasteIcon()!);
    expect(onPaste).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalled();
  });

  it('greys the icon, saying why, when there is nothing to paste', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    render(<TabMenu {...props({ anchor, canvas: { onPaste: noop, canPaste: false } })} />);
    const icon = pasteIcon() as HTMLButtonElement;
    expect(icon.getAttribute('aria-disabled') === 'true' || icon.disabled).toBe(true);
  });
});
