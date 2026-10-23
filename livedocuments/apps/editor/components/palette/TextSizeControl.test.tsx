// @vitest-environment jsdom

// The one Text Size control (docs/specs/004-interface-design/fonts.md "Text size"): a 6 to 48 px
// slider that previews as it moves and commits once when let go, and a Scale icon toggle.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  arrowLabelFontSize,
  CELL_FONT_PX,
  LABEL_FONT_PX,
  NOTE_FONT_PX,
  type TextSize,
} from '@livedocuments/document';
import {
  presetPxFor,
  TEXT_SIZE_TICKS,
  TextSizeControl,
  textSizeReadout,
  textSizeThumbPx,
} from './TextSizeControl';

afterEach(() => cleanup());

const labelPx = presetPxFor('shape');

function renderControl(current: TextSize | null, opts: { withScale?: boolean } = {}) {
  const onSet = vi.fn();
  const onPreview = vi.fn();
  const onPreviewEnd = vi.fn();
  render(
    <TextSizeControl
      current={current}
      onSet={onSet}
      onPreview={onPreview}
      onPreviewEnd={onPreviewEnd}
      withScale={opts.withScale}
    />,
  );
  return {
    onSet,
    onPreview,
    onPreviewEnd,
    slider: screen.getByRole('slider', { name: 'Text Size' }),
  };
}

describe('textSizeThumbPx / textSizeReadout', () => {
  it('puts a px at itself and reads it out', () => {
    expect(textSizeThumbPx(18, labelPx)).toBe(18);
    expect(textSizeReadout(18, labelPx)).toBe('18px');
  });

  it('puts a preset at the px it draws at, clamped to the range, and reads the true px', () => {
    expect(textSizeThumbPx('sm', labelPx)).toBe(LABEL_FONT_PX.sm);
    expect(textSizeThumbPx('lg', labelPx)).toBe(LABEL_FONT_PX.lg);
    expect(textSizeThumbPx(60, labelPx)).toBe(48);
    expect(textSizeReadout('lg', labelPx)).toBe(`${LABEL_FONT_PX.lg}px`);
  });

  it('sits Scale and Mixed at Medium and says which they are', () => {
    expect(textSizeThumbPx('scale', labelPx)).toBe(LABEL_FONT_PX.md);
    expect(textSizeThumbPx(null, labelPx)).toBe(LABEL_FONT_PX.md);
    expect(textSizeReadout('scale', labelPx)).toBe('Scale');
    expect(textSizeReadout(null, labelPx)).toBe('Mixed');
  });
});

describe('presetPxFor', () => {
  it('reads each surface on its own scale', () => {
    expect(presetPxFor('sticky')('md')).toBe(NOTE_FONT_PX.md);
    expect(presetPxFor('arrow')('lg')).toBe(arrowLabelFontSize('lg'));
    expect(presetPxFor('table')('sm')).toBe(CELL_FONT_PX.sm);
    expect(presetPxFor('text')('md')).toBe(LABEL_FONT_PX.md);
  });
});

describe('TextSizeControl', () => {
  it('runs 6 to 48 in whole px with labelled breakpoints', () => {
    const { slider } = renderControl('md');
    expect(slider.getAttribute('min')).toBe('6');
    expect(slider.getAttribute('max')).toBe('48');
    expect(slider.getAttribute('step')).toBe('1');
    expect(TEXT_SIZE_TICKS).toEqual([6, 12, 24, 36, 48]);
    for (const t of TEXT_SIZE_TICKS) expect(screen.getByText(String(t))).toBeTruthy();
  });

  it('previews while it moves and commits once, as a px, when let go', () => {
    const { onSet, onPreview, slider } = renderControl('md');
    fireEvent.change(slider, { target: { value: '9' } });
    fireEvent.change(slider, { target: { value: '10' } });
    expect(onPreview).toHaveBeenLastCalledWith(10);
    expect(screen.getByText('10px')).toBeTruthy();
    expect(onSet).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider);
    expect(onSet).toHaveBeenCalledTimes(1);
    expect(onSet).toHaveBeenCalledWith(10);
  });

  it('closes the preview without a change when let go where it began', () => {
    const { onSet, onPreviewEnd, slider } = renderControl(14);
    fireEvent.change(slider, { target: { value: '20' } });
    fireEvent.change(slider, { target: { value: '14' } });
    fireEvent.keyUp(slider);
    expect(onSet).not.toHaveBeenCalled();
    expect(onPreviewEnd).toHaveBeenCalled();
  });

  it('sets Scale from its icon toggle, pressed while the size is Scale', () => {
    const { onSet } = renderControl('scale');
    const scale = screen.getByRole('button', { name: 'Scale' });
    expect(scale.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Scale', { selector: 'span' })).toBeTruthy();
    fireEvent.click(scale);
    expect(onSet).toHaveBeenCalledWith('scale');
  });

  it('offers no Scale where there is nothing to fit text to', () => {
    renderControl('md', { withScale: false });
    expect(screen.queryByRole('button', { name: 'Scale' })).toBeNull();
  });

  it('reads Mixed for a selection whose sizes differ', () => {
    renderControl(null);
    expect(screen.getByText('Mixed')).toBeTruthy();
  });
});
