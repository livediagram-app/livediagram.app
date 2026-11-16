// @vitest-environment jsdom

// The one image being cropped (docs/specs/009-elements/picture-crop-and-mask.md "Cropping in the editor"): the
// overlay, the element's handles and the selection chrome all read it.

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  endImageCrop,
  imageCropId,
  startImageCrop,
  useImageCropId,
  useIsImageCropping,
} from './image-crop-store';

afterEach(() => endImageCrop());

describe('image crop store', () => {
  it('holds one id at a time, and none once ended', () => {
    startImageCrop('a');
    startImageCrop('a');
    expect(imageCropId()).toBe('a');
    startImageCrop('b');
    expect(imageCropId()).toBe('b');
    endImageCrop();
    endImageCrop();
    expect(imageCropId()).toBeNull();
  });

  it('tells the hooks as a crop starts and ends', () => {
    const id = renderHook(() => useImageCropId());
    const mine = renderHook(() => useIsImageCropping('a'));
    expect(id.result.current).toBeNull();
    expect(mine.result.current).toBe(false);
    act(() => startImageCrop('a'));
    expect(id.result.current).toBe('a');
    expect(mine.result.current).toBe(true);
    act(() => startImageCrop('b'));
    expect(id.result.current).toBe('b');
    expect(mine.result.current).toBe(false);
    act(() => endImageCrop());
    expect(id.result.current).toBeNull();
  });
});
