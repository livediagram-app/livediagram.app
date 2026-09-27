// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SelectionPopover } from './SelectionPopover';
import { MultiSelectionToolbar } from './MultiSelectionToolbar';
import { MinimalChromeProvider } from '@/components/providers/minimal-chrome';

// The selection toolbars (docs/specs/008-canvas/canvas-and-palette.md#selection-popover): More only on
// touch, and under Minimal chrome (docs/specs/007-editor/power-user-mode.md) no caption and no
// desktop bin.

function setTouch(touch: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(hover: none)' ? touch : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

const BOUNDS = { x: 100, y: 100, width: 80, height: 40 };

function renderSingle(minimal = false) {
  render(
    <MinimalChromeProvider value={minimal}>
      <SelectionPopover
        bounds={BOUNDS}
        canvasOffset={{ x: 0, y: 0 }}
        zoom={1}
        title="Selected Square"
        onDelete={() => {}}
        onDuplicate={() => {}}
        onOpenContextMenu={() => {}}
      />
    </MinimalChromeProvider>,
  );
}

function renderMulti(minimal = false) {
  render(
    <MinimalChromeProvider value={minimal}>
      <MultiSelectionToolbar
        anyLocked={false}
        allLocked={false}
        selectedElements={[]}
        onDuplicate={() => {}}
        onDelete={() => {}}
        onToggleLock={() => {}}
        onExport={() => {}}
        onOpenContextMenu={() => {}}
      />
    </MinimalChromeProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SelectionPopover', () => {
  it('has no More button on desktop: right-click opens the menu', () => {
    setTouch(false);
    renderSingle();
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('keeps More on touch, which cannot right-click', () => {
    setTouch(true);
    renderSingle();
    expect(screen.getByRole('button', { name: 'More actions' })).toBeTruthy();
  });

  it('names itself with the caption, shown until Minimal chrome', () => {
    setTouch(false);
    renderSingle();
    expect(screen.getByRole('toolbar', { name: 'Selected Square' })).toBeTruthy();
    expect(screen.getByText('Selected Square')).toBeTruthy();
    cleanup();
    renderSingle(true);
    expect(screen.getByRole('toolbar', { name: 'Selected Square' })).toBeTruthy();
    expect(screen.queryByText('Selected Square')).toBeNull();
  });

  it('drops the bin under Minimal chrome on desktop only', () => {
    setTouch(false);
    renderSingle(true);
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    cleanup();
    setTouch(true);
    renderSingle(true);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });
});

describe('MultiSelectionToolbar', () => {
  it('has no More button on desktop, and keeps it on touch', () => {
    setTouch(false);
    renderMulti();
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();
    cleanup();
    setTouch(true);
    renderMulti();
    expect(screen.getByRole('button', { name: 'More actions' })).toBeTruthy();
  });

  it('drops the bin under Minimal chrome on desktop only', () => {
    setTouch(false);
    renderMulti(true);
    expect(screen.queryByRole('button', { name: 'Delete selected elements' })).toBeNull();
    cleanup();
    setTouch(true);
    renderMulti(true);
    expect(screen.getByRole('button', { name: 'Delete selected elements' })).toBeTruthy();
  });
});
