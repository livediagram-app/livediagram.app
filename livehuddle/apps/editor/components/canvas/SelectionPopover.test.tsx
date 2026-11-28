// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SelectionPopover } from './SelectionPopover';
import { MultiSelectionToolbar } from './MultiSelectionToolbar';
// The selection toolbars (docs/specs/008-canvas/canvas-and-palette.md#selection-popover): More, the
// caption and the bin on every device, for everyone.

function setTouch(touch: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(hover: none)' ? touch : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
}

const BOUNDS = { x: 100, y: 100, width: 80, height: 40 };

function renderSingle() {
  render(
    <SelectionPopover
      bounds={BOUNDS}
      canvasOffset={{ x: 0, y: 0 }}
      zoom={1}
      title="Selected Square"
      onDelete={() => {}}
      onDuplicate={() => {}}
      onOpenContextMenu={() => {}}
    />,
  );
}

function renderMulti() {
  render(
    <MultiSelectionToolbar
      selectedElements={[]}
      onDuplicate={() => {}}
      onDelete={() => {}}
      onExport={() => {}}
      onOpenContextMenu={() => {}}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SelectionPopover', () => {
  it.each([false, true])('shows More and the bin, touch %s', (touch) => {
    setTouch(touch);
    renderSingle();
    expect(screen.getByRole('button', { name: 'More actions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('names itself with the caption, which it shows', () => {
    setTouch(false);
    renderSingle();
    expect(screen.getByRole('toolbar', { name: 'Selected Square' })).toBeTruthy();
    expect(screen.getByText('Selected Square')).toBeTruthy();
  });
});

// docs/specs/008-canvas/canvas-and-palette.md "Format painter": its one way in, beside Duplicate.
describe('MultiSelectionToolbar', () => {
  it.each([false, true])('shows More and the bin, touch %s', (touch) => {
    setTouch(touch);
    renderMulti();
    expect(screen.getByRole('button', { name: 'More actions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete selected elements' })).toBeTruthy();
  });
});

// docs/specs/004-interface-design/touch-targets.md: its 32px buttons sit 4px apart, so each reaches a
// 44px tap area both ways on a touch screen, drawn behind the buttons so each still wins its own box.
describe('SelectionPopover tap areas', () => {
  it('gives every 32px button a positioned 44px touch pad, behind it in the toolbar’s own stacking context', () => {
    setTouch(true);
    renderSingle();
    const bar = screen.getByTestId('selection-popover');
    expect(bar.className).toContain('[&_.h-8]:touch-target-packed');
    expect(bar.className).toContain('[&_.h-8]:relative');
    expect(bar.className).toMatch(/\bisolate\b/);
    // The in-flow strip that scrolls the buttons sits over the pads too (its -my-1.5 py-1.5 band), so it is a stacking
    // context of its own and the pads draw over it: a tap just above or below a button lands on that button. jsdom
    // has no layout to hit-test, so this checks the class the browser needs.
    expect(screen.getByTestId('selection-popover-strip').className).toMatch(/\bisolate\b/);
    expect(screen.getByRole('button', { name: 'Duplicate' }).className).toMatch(/\bh-8\b/);
  });
});

// docs/specs/002-project-scope/not-in-livehuddle.md "Element and Tab Locking": neither toolbar offers a lock, and
// Delete is always live.
describe('no Lock on the selection toolbars', () => {
  it('shows no Lock button and a live Delete on one element', () => {
    setTouch(false);
    renderSingle();
    expect(screen.queryByRole('button', { name: /lock/i })).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Delete' }).disabled).toBe(false);
  });

  it('shows no Lock button and a live Delete on a multi-selection', () => {
    setTouch(false);
    renderMulti();
    expect(screen.queryByRole('button', { name: /lock/i })).toBeNull();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Delete selected elements' }).disabled,
    ).toBe(false);
  });
});
