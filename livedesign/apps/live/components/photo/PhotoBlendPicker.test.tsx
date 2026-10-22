// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BLEND_MODE_GROUPS } from '@livedesign/photo-engine';
import { PhotoBlendPicker } from './PhotoBlendPicker';

// docs/specs/031-photo/photo-layers.md "The Layers tab": the blend mode, previewed while pointed at.
afterEach(cleanup);

describe('the blend mode picker', () => {
  it('previews the mode pointed at, keeps the one pressed, and puts the photo back when closed', () => {
    const onPreview = vi.fn();
    const onChange = vi.fn();
    render(
      <PhotoBlendPicker
        value="normal"
        groups={BLEND_MODE_GROUPS}
        onPreview={onPreview}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Blend Mode: Normal' }));
    const multiply = screen.getByRole('menuitem', { name: 'Multiply' });
    fireEvent.pointerEnter(multiply.parentElement!);
    expect(onPreview).toHaveBeenLastCalledWith('multiply');
    fireEvent.focus(screen.getByRole('menuitem', { name: 'Screen' }));
    expect(onPreview).toHaveBeenLastCalledWith('screen');
    fireEvent.click(multiply);
    expect(onChange).toHaveBeenCalledWith('multiply');
    fireEvent.click(screen.getByRole('button', { name: 'Blend Mode: Normal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blend Mode: Normal' }));
    expect(onPreview).toHaveBeenLastCalledWith(null);
  });
});
