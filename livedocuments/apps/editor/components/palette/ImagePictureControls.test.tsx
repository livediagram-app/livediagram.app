// @vitest-environment jsdom

// The Image section's Mask tiles and Greyscale toggle (docs/specs/009-elements/picture-crop-and-mask.md).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createImage, createShape, type Element, type ImageElement } from '@livedocuments/document';
import { ImagePictureControls, withImageGreyscale, withImageMask } from './ImagePictureControls';
import type { ElementStyleOps } from '@/lib/element-style-ops';

afterEach(cleanup);

const picture = (over: Partial<ImageElement> = {}): ImageElement => ({
  ...createImage(0, 0),
  imageId: 'img-1',
  ...over,
});

function show(target: ImageElement) {
  const ops: ElementStyleOps = {
    preview: vi.fn(),
    end: vi.fn(),
    commit: vi.fn(),
    burst: vi.fn(),
    commitTab: vi.fn(),
  };
  render(<ImagePictureControls target={target} ops={ops} />);
  const last = () =>
    (ops.commit as ReturnType<typeof vi.fn>).mock.calls.at(-1)! as [
      (e: Element) => Element,
      string,
    ];
  return { ops, last };
}

describe('ImagePictureControls', () => {
  it('offers No Mask and the eight masks, the current one pressed', () => {
    show(picture({ mask: 'hexagon' }));
    for (const name of [
      'No Mask',
      'Circle',
      'Rounded',
      'Arch',
      'Hexagon',
      'Diamond',
      'Triangle',
      'Star',
      'Blob',
    ])
      expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hexagon' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('sets a mask in one commit, and pressing it again takes it off', () => {
    const { last } = show(picture());
    fireEvent.click(screen.getByRole('button', { name: 'Star' }));
    const [map, kind] = last();
    expect(kind).toBe('ImageMask');
    expect(map(picture())).toMatchObject({ mask: 'star' });
    cleanup();
    const again = show(picture({ mask: 'star' }));
    fireEvent.click(screen.getByRole('button', { name: 'Star' }));
    expect(again.last()[0](picture({ mask: 'star' }))).not.toHaveProperty('mask');
  });

  it('previews a mask on hover and ends it on leave', () => {
    const { ops } = show(picture());
    const tile = screen.getByRole('button', { name: 'Circle' });
    fireEvent.pointerEnter(tile, { pointerType: 'mouse' });
    expect(ops.preview).toHaveBeenCalled();
    fireEvent.pointerLeave(tile, { pointerType: 'mouse' });
    expect(ops.end).toHaveBeenCalled();
  });

  it('turns greyscale on and off', () => {
    const { last } = show(picture());
    fireEvent.click(screen.getByRole('button', { name: /Greyscale/ }));
    const [map, kind] = last();
    expect(kind).toBe('ImageGreyscale');
    expect(map(picture())).toMatchObject({ greyscale: true });
    cleanup();
    const on = show(picture({ greyscale: true }));
    fireEvent.click(screen.getByRole('button', { name: /Greyscale/ }));
    expect(on.last()[0](picture({ greyscale: true }))).not.toHaveProperty('greyscale');
  });

  it('leaves other kinds as they are', () => {
    const box = createShape('square', 0, 0);
    expect(withImageMask(box, 'circle')).toBe(box);
    expect(withImageGreyscale(box, true)).toBe(box);
  });
});
