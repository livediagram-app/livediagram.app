// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Layer } from '@livedocuments/document';

import { LayerRow, layerMetaLine } from './LayerRow';

// docs/specs/006-document/layers.md "The Layers panel": the row's meta line and its toggles.

describe('layerMetaLine', () => {
  const layer: Layer = { id: 'l', name: 'Notes' };

  it('counts elements, or says Empty', () => {
    expect(layerMetaLine(layer, 25, true)).toBe('25 elements');
    expect(layerMetaLine(layer, 1, true)).toBe('1 element');
    expect(layerMetaLine(layer, 0, true)).toBe('Empty');
  });

  it('drops the count when the preference is off, but keeps Empty', () => {
    expect(layerMetaLine(layer, 25, false)).toBe('');
    expect(layerMetaLine(layer, 0, false)).toBe('Empty');
  });

  it('appends opacity, lock and visibility state', () => {
    expect(layerMetaLine({ ...layer, opacity: 0.5, locked: true, visible: false }, 2, true)).toBe(
      '2 elements · 50% opacity · Locked · Hidden',
    );
  });
});

function renderRow(overrides: Partial<Parameters<typeof LayerRow>[0]> = {}) {
  const props: Parameters<typeof LayerRow>[0] = {
    layer: { id: 'l', name: 'Notes' },
    activeLayerId: 'other',
    counts: new Map([['l', 4]]),
    showPreview: true,
    showCount: true,
    thumbViewBox: null,
    thumbMarkup: new Map(),
    renamingId: null,
    setRenamingId: vi.fn(),
    commitRename: vi.fn(),
    dragId: null,
    dropTargetId: null,
    dropEdge: null,
    enterRowPreview: vi.fn(),
    leaveRowPreview: vi.fn(),
    rowPointerDown: () => () => {},
    rowPointerMove: () => {},
    rowPointerUp: () => {},
    openRowMenu: vi.fn(),
    onSelectLayer: vi.fn(),
    onToggleVisibility: vi.fn(),
    onToggleLock: vi.fn(),
    ...overrides,
  };
  render(
    <ul>
      <LayerRow {...props} />
    </ul>,
  );
  return props;
}

describe('LayerRow', () => {
  it('toggles lock and visibility without activating the row', () => {
    const p = renderRow();
    fireEvent.click(screen.getByRole('button', { name: 'Lock Notes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hide Notes' }));
    expect(p.onToggleLock).toHaveBeenCalledWith('l');
    expect(p.onToggleVisibility).toHaveBeenCalledWith('l');
    expect(p.onSelectLayer).not.toHaveBeenCalled();
  });

  it('activates on click and opens the menu from its options button', () => {
    const p = renderRow();
    fireEvent.click(screen.getByText('Notes'));
    expect(p.onSelectLayer).toHaveBeenCalledWith('l');
    fireEvent.click(screen.getByRole('button', { name: 'Notes options' }));
    expect(p.openRowMenu).toHaveBeenCalled();
  });

  it('draws the insertion line on the edge the drop lands', () => {
    renderRow({ dragId: 'x', dropTargetId: 'l', dropEdge: 'top' });
    expect(screen.getByTestId('layer-drop-line').className).toContain('-top-');
  });
});
