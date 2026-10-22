// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Layer } from '@livepages/document';

import { LayerRowMenu, layerMenuPosition } from './LayerRowMenu';

// docs/specs/006-document/layers.md "Row context menu": every verb one click away, no categories.

const LAYER: Layer = { id: 'l1', name: 'Notes' };

function renderMenu(overrides: Partial<Parameters<typeof LayerRowMenu>[0]> = {}) {
  const props = {
    layer: LAYER,
    elementCount: 3,
    thumbViewBox: null,
    thumbMarkup: undefined,
    isTop: false,
    isBottom: false,
    anchor: { panelLeft: 900, rowBottom: 700 },
    onClose: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    canDelete: true,
    onSetOpacity: vi.fn(),
    onBringToTop: vi.fn(),
    onSendToBottom: vi.fn(),
    onHideOthers: vi.fn(),
    onToggleVisibility: vi.fn(),
    onToggleLock: vi.fn(),
    onClear: vi.fn(),
    onMergeUp: vi.fn(),
    onMergeDown: vi.fn(),
    ...overrides,
  };
  render(<LayerRowMenu {...props} />);
  return props;
}

const button = (name: string) => screen.getByRole('button', { name });

describe('LayerRowMenu', () => {
  it('names the layer and shows every verb without opening a category', () => {
    renderMenu();
    const menu = screen.getByTestId('layer-row-menu');
    expect(menu.textContent).toContain('Notes');
    expect(menu.textContent).toContain('3 elements');
    for (const verb of [
      'Hide Layer',
      'Lock Layer',
      'Hide Others',
      'Bring to Top',
      'Send to Bottom',
      'Merge With Layer Above',
      'Merge With Layer Below',
      'Rename',
      'Clear Layer',
      'Delete Layer',
    ]) {
      expect(menu.textContent).toContain(verb);
    }
    expect(screen.getByRole('slider')).toBeTruthy();
  });

  it('reads the current state in its toggle rows', () => {
    renderMenu({ layer: { ...LAYER, visible: false, locked: true } });
    expect(button('Show Layer')).toBeTruthy();
    expect(button('Unlock Layer')).toBeTruthy();
  });

  it('runs the toggles in place and the one-shot verbs then closes', () => {
    const p = renderMenu();
    fireEvent.click(button('Lock Layer'));
    expect(p.onToggleLock).toHaveBeenCalledOnce();
    expect(p.onClose).not.toHaveBeenCalled();
    fireEvent.click(button('Merge With Layer Below'));
    expect(p.onMergeDown).toHaveBeenCalledOnce();
    expect(p.onClose).toHaveBeenCalledOnce();
  });

  it('disables the verbs that need a neighbour at the stack edges', () => {
    renderMenu({ isTop: true });
    expect(screen.queryByRole('button', { name: 'Bring to Top' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Merge With Layer Above' })).toBeNull();
    expect(button('Send to Bottom')).toBeTruthy();
  });

  it('asks before deleting a populated layer', () => {
    const p = renderMenu();
    fireEvent.click(button('Delete Layer'));
    expect(p.onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Delete “Notes” and its 3 elements?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(p.onDelete).toHaveBeenCalledOnce();
  });

  // The confirm anchors to the row that asked, named by the click itself: no wrapper node carries a ref for it
  // (docs/specs/003-system-architecture/react-state-and-effects.md "Fragments and DOM events").
  it('anchors the confirm to the asking row, with no wrapper around it', () => {
    renderMenu();
    for (const name of ['Clear Layer', 'Delete Layer'])
      expect(button(name).parentElement?.attributes.length).toBeGreaterThan(0);
    fireEvent.click(button('Clear Layer'));
    expect(
      screen.getByRole('dialog', { name: 'Clear the 3 elements on “Notes”? The layer stays.' }),
    ).toBeTruthy();
  });

  it('deletes an empty layer straight away and cannot clear it', () => {
    const p = renderMenu({ elementCount: 0 });
    expect(screen.queryByRole('button', { name: 'Clear Layer' })).toBeNull();
    fireEvent.click(button('Delete Layer'));
    expect(p.onDelete).toHaveBeenCalledOnce();
  });

  it('asks before clearing', () => {
    const p = renderMenu();
    fireEvent.click(button('Clear Layer'));
    expect(
      screen.getByRole('dialog', { name: 'Clear the 3 elements on “Notes”? The layer stays.' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(p.onClear).toHaveBeenCalledOnce();
  });
});

describe('layerMenuPosition', () => {
  const viewport = { width: 1440, height: 900 };

  it('hangs left of the panel, its bottom on the row', () => {
    expect(layerMenuPosition({ panelLeft: 1000, rowBottom: 700 }, 400, viewport)).toEqual({
      left: 1000 - 8 - 256,
      top: 300,
    });
  });

  it('stays on screen when the row is near the top or the panel near the left edge', () => {
    expect(layerMenuPosition({ panelLeft: 40, rowBottom: 120 }, 400, viewport)).toEqual({
      left: 8,
      top: 8,
    });
  });

  it('never runs off the bottom', () => {
    expect(layerMenuPosition({ panelLeft: 1000, rowBottom: 2000 }, 400, viewport).top).toBe(492);
  });
});
