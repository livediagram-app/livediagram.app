// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createImage, type Element } from '@livedocuments/document';
import { EditorContextMenu } from './EditorContextMenu';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

// docs/specs/009-elements/images.md "Alt text": an Editor sets it in the element menu's Image section, once the image
// has a picture to describe.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

function open(target: Element) {
  const onSetImageAlt = vi.fn();
  const given: Record<string, unknown> = {
    menu: { mode: 'element', elementId: target.id, x: 10, y: 10 },
    elements: [target],
    layers: [],
    theme: undefined,
    onSetImageAlt,
  };
  const props = new Proxy(given, {
    get: (t, k: string) => (k in t ? t[k] : vi.fn()),
    has: () => true,
  }) as unknown as EditorContextMenuProps;
  const Host = () => EditorContextMenu(props);
  render(<Host />);
  fireEvent.click(screen.getByRole('button', { name: /^Image/ }));
  return onSetImageAlt;
}

const picture = (over: Record<string, unknown> = {}) =>
  ({ ...createImage(0, 0), id: 'img', imageId: 'img-1', alt: 'photo.jpg', ...over }) as Element;

describe('the Image section’s Alt Text', () => {
  it('shows the stored words and writes the typed ones for this image', () => {
    const onSetImageAlt = open(picture());
    const field = screen.getByRole('textbox', { name: 'Alt Text' }) as HTMLTextAreaElement;
    expect(field.value).toBe('photo.jpg');
    fireEvent.change(field, { target: { value: 'A red bicycle' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onSetImageAlt).toHaveBeenCalledExactlyOnceWith('img', 'A red bicycle');
  });

  it('is not offered on a placeholder, which has nothing to describe', () => {
    open(picture({ imageId: null }));
    expect(screen.getByRole('button', { name: 'Select Image' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Alt Text' })).toBeNull();
  });
});
