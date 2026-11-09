// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createImage, type Element } from '@livedocuments/document';
import { EditorContextMenu } from './EditorContextMenu';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import { endImageCrop, imageCropId } from '@/lib/image-crop-store';

// docs/specs/009-elements/picture-crop-and-mask.md: the Image section's Crop Image, Mask and Greyscale.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(() => {
  cleanup();
  endImageCrop();
});

function open(target: Element) {
  const onClose = vi.fn();
  const given: Record<string, unknown> = {
    menu: { mode: 'element', elementId: target.id, x: 10, y: 10 },
    elements: [target],
    theme: undefined,
    onClose,
  };
  const props = new Proxy(given, {
    get: (t, k: string) => (k in t ? t[k] : vi.fn()),
    has: () => true,
  }) as unknown as EditorContextMenuProps;
  const Host = () => EditorContextMenu(props);
  render(<Host />);
  fireEvent.click(screen.getByRole('button', { name: /^Image/ }));
  return onClose;
}

const picture = (over: Record<string, unknown> = {}) =>
  ({ ...createImage(0, 0), id: 'img', imageId: 'img-1', ...over }) as Element;

describe('the Image section’s crop, mask and greyscale', () => {
  it('Crop Image starts cropping this image and closes the menu', () => {
    const onClose = open(picture());
    fireEvent.click(screen.getByRole('button', { name: 'Crop Image' }));
    expect(imageCropId()).toBe('img');
    expect(onClose).toHaveBeenCalled();
  });

  it('offers no crop on a locked image, which keeps its place', () => {
    open(picture({ locked: true }));
    expect(screen.queryByRole('button', { name: 'Crop Image' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Change Image' })).toBeTruthy();
  });

  it('offers the masks and Greyscale', () => {
    open(picture());
    expect(screen.getByRole('button', { name: 'Circle' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Greyscale/ })).toBeTruthy();
  });
});
