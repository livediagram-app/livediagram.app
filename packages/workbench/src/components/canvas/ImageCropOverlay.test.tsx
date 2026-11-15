// @vitest-environment jsdom

// Cropping on the canvas (docs/specs/009-elements/picture-crop-and-mask.md "Cropping in the editor"): the overlay
// in the grips layer, its bar, and how a crop ends.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createImage, type ImageElement } from '@livedocuments/document';
import { SelectionGripsContext } from '@liveworkspace/workbench/components/canvas/SelectionGripsLayer';
import { CanvasZoomProvider } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { ImageCropOverlay } from './ImageCropOverlay';
import { imageCropId, startImageCrop } from '@/lib/image-crop-store';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(cleanup);
beforeEach(() => startImageCrop('pic'));

const el: ImageElement = {
  ...createImage(0, 0),
  id: 'pic',
  imageId: 'img',
  width: 400,
  height: 200,
};

function show(onApply = vi.fn()) {
  const box = document.createElement('div');
  const arrows = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  document.body.append(box);
  render(
    <SelectionGripsContext.Provider value={{ box, arrows }}>
      <CanvasZoomProvider zoom={1}>
        <ImageCropOverlay
          element={el}
          src="data:,"
          natural={{ width: 800, height: 800 }}
          onApply={onApply}
        />
      </CanvasZoomProvider>
    </SelectionGripsContext.Provider>,
  );
  return { onApply, box };
}

describe('ImageCropOverlay', () => {
  it('shows the frame, eight handles and the bar', () => {
    const { box } = show();
    expect(box.querySelectorAll('[data-crop-handle]')).toHaveLength(8);
    expect(screen.getByRole('toolbar', { name: 'Crop Image' })).toBeTruthy();
    for (const name of ['Reset', 'Cancel', 'Done'])
      expect(screen.getByRole('button', { name })).toBeTruthy();
  });

  it('Cancel ends it, storing nothing', () => {
    const { onApply } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onApply).not.toHaveBeenCalled();
    expect(imageCropId()).toBeNull();
  });

  it('Done after an aspect stores the crop once, and ends it', () => {
    const { onApply } = show();
    fireEvent.click(screen.getByRole('radio', { name: 'Square' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onApply).toHaveBeenCalledExactlyOnceWith({
      x: 100,
      y: 0,
      width: 200,
      height: 200,
      crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
    });
    expect(imageCropId()).toBeNull();
  });

  it('a square aspect leaves only the corners; Escape cancels and Enter applies', () => {
    const { onApply, box } = show();
    fireEvent.click(screen.getByRole('radio', { name: 'Square' }));
    expect(box.querySelectorAll('[data-crop-handle]')).toHaveLength(4);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });
    expect(onApply).toHaveBeenCalledOnce();
    cleanup();
    startImageCrop('pic');
    const second = show();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(second.onApply).not.toHaveBeenCalled();
    expect(imageCropId()).toBeNull();
  });

  it('a drag on an edge moves the frame; a press off the picture applies', () => {
    const { onApply, box } = show();
    const east = box.querySelector('[data-crop-handle="e"]')!;
    fireEvent.pointerDown(east, { button: 0, clientX: 400, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(east, { clientX: 300, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(east, { pointerId: 1 });
    act(() => {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    expect(onApply).toHaveBeenCalledOnce();
    expect(onApply.mock.calls[0]![0]).toMatchObject({ x: 0, width: 300, height: 200 });
  });

  it('the arrows nudge the picture under the frame', () => {
    const { onApply } = show();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    const stored = onApply.mock.calls[0]![0] as { crop: { y: number } };
    expect(stored.crop.y).toBeCloseTo(0.225);
  });
});
