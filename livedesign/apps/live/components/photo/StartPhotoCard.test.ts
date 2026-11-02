// @vitest-environment jsdom
// docs/specs/031-photo/photo-pages.md "Making a photo page": a photo just started has a tool in hand.
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LaidOutPage } from '@livedesign/design';
import { photoOf } from '@/lib/photo-editor/photo-test-utils';
import { photoTools } from '@/lib/photo-editor/tool-state';
import { photoView } from './photo-view-test-utils';
import { chainedSize, customPixels, readyTool, StartPhotoCard } from './StartPhotoCard';

beforeEach(() => photoTools.take(null));
afterEach(cleanup);

describe('a photo just started', () => {
  it('picks up the Brush on a blank photo and Move on a picture, keeping a tool already in hand', () => {
    readyTool(true);
    expect(photoTools.get().tool).toBe('brush');
    photoTools.take(null);
    readyTool(false);
    expect(photoTools.get().tool).toBe('move');
    photoTools.take('lasso');
    readyTool(true);
    expect(photoTools.get().tool).toBe('lasso');
  });

  it('makes a blank photo transparent: one Background layer with no pixels', () => {
    const { view, s } = photoView(photoOf(16, 12, []), {});
    const page = { id: 'p', rect: { x: 0, y: 0, width: 16, height: 12 } } as unknown as LaidOutPage;
    render(createElement(StartPhotoCard, { page, photo: view, zoom: 1 }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(s.photo.layers.map((l) => l.name)).toEqual(['Background']);
    expect(s.raster(s.photo.layers[0]!.id).keys()).toEqual([]);
  });
});

// docs/specs/031-photo/photo-pages.md "Making a photo page": Custom's width and height fields, with Keep Shape.
describe('the Custom size', () => {
  const mount = () => {
    const { view } = photoView(photoOf(16, 12, []), {});
    const page = { id: 'p', rect: { x: 0, y: 0, width: 16, height: 12 } } as unknown as LaidOutPage;
    render(createElement(StartPhotoCard, { page, photo: view, zoom: 1 }));
    fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
    return {
      width: screen.getByLabelText<HTMLInputElement>('Width'),
      height: screen.getByLabelText<HTMLInputElement>('Height'),
      create: screen.getByRole<HTMLButtonElement>('button', { name: 'Create' }),
    };
  };

  it('can be cleared and retyped, keeping the shape it started with', () => {
    const { width, height, create } = mount();
    expect([width.value, height.value]).toEqual(['1920', '1080']);
    fireEvent.change(width, { target: { value: '' } });
    expect(width.value).toBe('');
    expect(create.disabled).toBe(true);
    expect(screen.getByText('Enter a whole number of pixels.')).toBeTruthy();
    // Typed a key at a time, as a person does.
    for (const typed of ['3', '38', '384', '3840'])
      fireEvent.change(width, { target: { value: typed } });
    expect([width.value, height.value]).toEqual(['3840', '2160']);
    expect(create.disabled).toBe(false);
    fireEvent.blur(width);
    expect(width.value).toBe('3840');
  });

  it('sets one side alone without Keep Shape', () => {
    const { width, height } = mount();
    fireEvent.click(screen.getByRole('switch', { name: 'Keep Shape' }));
    fireEvent.change(height, { target: { value: '500' } });
    expect([width.value, height.value]).toEqual(['1920', '500']);
  });
});

describe('chainedSize', () => {
  it('follows the held shape, never the rounded last pair', () => {
    expect(chainedSize({ width: 3, height: 2 }, 'width', 3840, 16 / 9)).toEqual({
      width: 3840,
      height: 2160,
    });
    expect(chainedSize({ width: 3, height: 2 }, 'height', 1080, 16 / 9)).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(chainedSize({ width: 9, height: 9 }, 'width', 1, 1 / 1000)).toEqual({
      width: 1,
      height: 1000,
    });
    expect(chainedSize({ width: 9, height: 9 }, 'width', 1, 1000)).toEqual({ width: 1, height: 1 });
    expect(chainedSize({ width: 9, height: 7 }, 'width', 4, null)).toEqual({ width: 4, height: 7 });
  });

  it('reads only whole positive pixels', () => {
    expect(['', ' ', '0', '-5', 'abc', '1e9999'].map(customPixels)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(['1', '1.4', '1.6', ' 42 '].map(customPixels)).toEqual([1, 1, 2, 42]);
  });
});
