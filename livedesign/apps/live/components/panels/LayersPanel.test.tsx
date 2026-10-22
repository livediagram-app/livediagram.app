// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Layer } from '@livedesign/document';

import { LayersPanel, SINGLE_LAYER_HINT } from './LayersPanel';

// jsdom has no ResizeObserver; the movable panel measures itself with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// docs/specs/006-document/layers.md "The Layers panel": header bar, single-layer hint, footer.

function renderPanel(
  layers: Layer[],
  activeLayerId = layers[layers.length - 1]!.id,
  counts = new Map<string, number>(),
) {
  const props = {
    layers,
    activeLayerId,
    counts,
    elements: [],
    popoverOpen: true,
    popoverAnchor: { left: 0, top: 0, bottom: 0, arrowOffset: 0 },
    onPopoverClose: vi.fn(),
    onSelectLayer: vi.fn(),
    onAddLayer: vi.fn(),
    onRemoveLayer: vi.fn(),
    onRenameLayer: vi.fn(),
    onToggleVisibility: vi.fn(),
    onToggleLock: vi.fn(),
    onReorderLayer: vi.fn(),
    onMergeLayer: vi.fn(),
    onSetLayerOpacity: vi.fn(),
    onClearLayer: vi.fn(),
    onHideOtherLayers: vi.fn(),
    onPreviewLayer: vi.fn(),
    hoverPreviewEnabled: false,
    showPreview: true,
    showCount: true,
  };
  render(<LayersPanel {...props} />);
  return props;
}

describe('LayersPanel', () => {
  it('counts the layers and adds one from the header', () => {
    const p = renderPanel([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
    expect(screen.getByText('2 layers')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'New Layer' }));
    expect(p.onAddLayer).toHaveBeenCalledOnce();
    expect(screen.queryByText(SINGLE_LAYER_HINT)).toBeNull();
  });

  it('explains layers under a lone layer, and cannot delete it', () => {
    renderPanel([{ id: 'a', name: 'A' }]);
    expect(screen.getByText('1 layer')).toBeTruthy();
    expect(screen.getByText(SINGLE_LAYER_HINT)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete Layer' })).toHaveProperty('disabled', true);
  });

  it('merges the active layer from the labelled footer', () => {
    const p = renderPanel(
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      'b',
    );
    expect(screen.getByRole('button', { name: 'Merge with the layer above' })).toHaveProperty(
      'disabled',
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Merge with the layer below' }));
    expect(p.onMergeLayer).toHaveBeenCalledWith('below');
  });

  it('opens a row’s menu beside the panel from its options button', () => {
    renderPanel([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'A options' }));
    expect(screen.getByTestId('layer-row-menu').textContent).toContain('Merge With Layer Above');
  });

  it('asks before the footer deletes a populated active layer', () => {
    const p = renderPanel(
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      'b',
      new Map([['b', 2]]),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete Layer' }));
    expect(p.onRemoveLayer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(p.onRemoveLayer).toHaveBeenCalledWith('b');
  });

  it('deletes an empty active layer at once', () => {
    const p = renderPanel([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Layer' }));
    expect(p.onRemoveLayer).toHaveBeenCalledWith('b');
  });
});
