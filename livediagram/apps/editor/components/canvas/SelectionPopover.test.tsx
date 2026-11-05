// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

function renderMulti(allLocked = false) {
  render(
    <MultiSelectionToolbar
      allLocked={allLocked}
      selectedElements={[]}
      onDuplicate={() => {}}
      onDelete={() => {}}
      onToggleLock={() => {}}
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

describe('MultiSelectionToolbar', () => {
  it.each([false, true])('shows More and the bin, touch %s', (touch) => {
    setTouch(touch);
    renderMulti();
    expect(screen.getByRole('button', { name: 'More actions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete selected elements' })).toBeTruthy();
  });
});

// Mind map (docs/specs/009-elements/mind-node.md): Add Child / Add Sibling ride the toolbar of a mind node.
describe('SelectionPopover mind-node growth', () => {
  it('offers Add Child and Add Sibling, each firing its own grower', () => {
    setTouch(false);
    const child = vi.fn();
    const sibling = vi.fn();
    render(
      <SelectionPopover
        bounds={BOUNDS}
        canvasOffset={{ x: 0, y: 0 }}
        zoom={1}
        onAddMindChild={child}
        onAddMindSibling={sibling}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Child' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Sibling' }));
    expect(child).toHaveBeenCalledOnce();
    expect(sibling).toHaveBeenCalledOnce();
  });

  it('shows neither on an element that is not a mind node', () => {
    setTouch(false);
    renderSingle();
    expect(screen.queryByRole('button', { name: 'Add Child' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Sibling' })).toBeNull();
  });
});

describe('Edit Points (docs/specs/023-draw-mode/path-tool.md "Editing")', () => {
  afterEach(cleanup);

  it('offers Edit Points for a path and opens its edit mode', () => {
    setTouch(false);
    const onEditPoints = vi.fn();
    render(
      <SelectionPopover
        bounds={BOUNDS}
        canvasOffset={{ x: 0, y: 0 }}
        zoom={1}
        title="Selected Path"
        onEditPoints={onEditPoints}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Edit Points/ }));
    expect(onEditPoints).toHaveBeenCalled();
  });
});

// docs/specs/004-interface-design/touch-targets.md: its 32px buttons sit 4px apart, so each reaches a
// 44px-tall tap area on a touch screen, never a sideways one.
describe('SelectionPopover tap areas', () => {
  it('gives every 32px button a positioned, vertical-only touch pad', () => {
    setTouch(true);
    renderSingle();
    const bar = screen.getByTestId('selection-popover');
    expect(bar.className).toContain('[&_.h-8]:touch-target-y');
    expect(bar.className).toContain('[&_.h-8]:relative');
    expect(bar.className).not.toMatch(/\[&_\.h-8\]:touch-target(\s|$)/);
    expect(screen.getByRole('button', { name: 'Duplicate' }).className).toMatch(/\bh-8\b/);
  });
});

// A click locks every member unless all are locked already, so the button says what it will do: Lock for a
// mixed selection, Unlock only for a fully locked one.
describe('MultiSelectionToolbar lock', () => {
  it('offers Lock for a selection that is only partly locked', () => {
    setTouch(false);
    renderMulti(false);
    expect(screen.getByRole('button', { name: 'Lock selected elements' })).toBeTruthy();
  });

  it('offers Unlock once every member is locked', () => {
    setTouch(false);
    renderMulti(true);
    expect(screen.getByRole('button', { name: 'Unlock selected elements' })).toBeTruthy();
  });
});

// A toolbar wider than a phone (a flowchart step's full set) scrolls sideways inside 95vw, and the
// step's menus hang from the card, outside the strip's clip.
describe('SelectionPopover overflow', () => {
  function renderFlowchartStep() {
    setTouch(true);
    render(
      <SelectionPopover
        bounds={BOUNDS}
        canvasOffset={{ x: 0, y: 0 }}
        zoom={1}
        title="Selected Step"
        onDelete={() => {}}
        onDuplicate={() => {}}
        onOpenContextMenu={() => {}}
        flowchartStep={{
          onAddStep: () => {},
          onAddBranch: () => {},
          stepType: 'process',
          onSetStepType: () => {},
          lanes: [{ id: 'l1', title: 'Sales' }],
          laneId: 'l1',
          onMoveToLane: () => {},
        }}
      />,
    );
  }

  it('caps the buttons at 95vw in a strip that scrolls sideways', () => {
    renderFlowchartStep();
    const strip = screen.getByTestId('selection-popover-strip');
    expect(screen.getByTestId('selection-popover').className).toContain('max-w-[95vw]');
    expect(strip.className).toContain('overflow-x-auto');
    expect(strip.contains(screen.getByRole('button', { name: 'Step Type' }))).toBe(true);
    expect(strip.contains(screen.getByRole('button', { name: 'Delete' }))).toBe(true);
  });

  it('opens a step menu anchored to the card, so the strip does not clip it', () => {
    renderFlowchartStep();
    fireEvent.click(screen.getByRole('button', { name: 'Step Type' }));
    const menu = screen.getByRole('listbox');
    // Its containing block is the first positioned ancestor: neither the dropdown nor the strip may be one.
    let host = menu.parentElement;
    while (host && !/\b(relative|absolute)\b/.test(host.className)) host = host.parentElement;
    expect(host).toBe(screen.getByTestId('selection-popover'));
    expect(menu.className).not.toContain('left-0');
  });

  it('opens the menu under its trigger however far the strip is scrolled, and closes it on a scroll', () => {
    renderFlowchartStep();
    const strip = screen.getByTestId('selection-popover-strip');
    strip.scrollLeft = 40;
    fireEvent.click(screen.getByRole('button', { name: 'Step Type' }));
    expect(screen.getByRole('listbox').style.marginLeft).toBe('-40px');
    fireEvent.scroll(strip);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
