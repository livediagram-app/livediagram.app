// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Layer } from '@livediagram/document';

import { stubResizeObserver } from '@liveworkspace/vitest-config/stub-resize-observer';
import { LayersPanel, SINGLE_LAYER_HINT } from './LayersPanel';

beforeAll(stubResizeObserver);

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
  it('counts the layers and adds one from the button pinned at the foot', () => {
    const p = renderPanel([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
    expect(screen.getByText('2 layers')).toBeTruthy();
    const add = screen.getByRole('button', { name: 'New Layer' });
    // The tools' one footer look (layers.md "The Layers panel"): pinned at the foot, after Merge and Delete.
    const foot = add.closest('[data-tool-footer]');
    expect(foot).not.toBeNull();
    const del = screen.getByRole('button', { name: 'Delete Layer' });
    expect(del.compareDocumentPosition(foot!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(add);
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

  it('deletes a populated active layer at once from the footer, its toast offering Undo', () => {
    const p = renderPanel(
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      'b',
      new Map([['b', 2]]),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete Layer' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(p.onRemoveLayer).toHaveBeenCalledWith(
      'b',
      expect.objectContaining({ removed: expect.any(Function) }),
    );
  });

  it('deletes an empty active layer at once', () => {
    const p = renderPanel([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Layer' }));
    expect(p.onRemoveLayer).toHaveBeenCalledWith(
      'b',
      expect.objectContaining({ removed: expect.any(Function) }),
    );
  });
});

// liveworkspace/docs/specs/011-workbench/phone-drawers.md: a drawer on a phone, the popover on a desktop.
describe('LayersPanel on a phone', () => {
  const phone = (matches: boolean) =>
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          matches,
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  const one: Layer[] = [{ id: 'l1', name: 'Layer 1' }];

  it('opens as a drawer, New Layer working inside it and its scrim closing it', () => {
    phone(true);
    const p = renderPanel(one);
    const sheet = screen.getByRole('dialog', { name: 'Layers' });
    expect(sheet.querySelector('[data-sheet-handle]')).not.toBeNull();
    const add = screen.getByRole('button', { name: 'New Layer' });
    expect(add.closest('[data-tool-footer]')).not.toBeNull();
    fireEvent.click(add);
    expect(p.onAddLayer).toHaveBeenCalled();
    fireEvent.click(sheet.previousElementSibling as HTMLElement);
    expect(p.onPopoverClose).toHaveBeenCalledTimes(1);
  });

  it('stays the popover on a desktop', () => {
    phone(false);
    renderPanel(one);
    expect(document.querySelector('[data-phone-drawer]')).toBeNull();
    expect(screen.getByRole('region', { name: 'Layers' })).toBeTruthy();
  });
});
