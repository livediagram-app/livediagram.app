// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contrastRatio, type TextContrastProbe, type TextGround } from '@livedocuments/document';
import { ColourPicker } from './ColourPicker';
import { noColour } from '@liveworkspace/workbench/components/colour/colour-options';

// docs/specs/004-interface-design/colour-picker.md "Reading on its ground": the picker's readability row judges the
// swatch the pointer or focus rested on. The row itself is the shared ContrastHint
// (@liveworkspace/workbench/components/colour/ContrastHint.test.tsx).
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const PAPER: TextGround = { tones: ['#ffffff'], on: 'page' };
const hint = () => screen.getByTestId('contrast-hint');
const on = (ground: TextGround, current: string | null): TextContrastProbe => ({
  ground,
  large: false,
  exported: false,
  current,
  colourOf: (id) => (id.startsWith('#') ? id : null),
});

describe('ColourPicker with a contrast probe', () => {
  const probe = (current: string | null) => [on(PAPER, current)];
  const theme = [
    { id: '#fef08a', colour: '#fef08a', label: 'Pale yellow' },
    { id: '#0f172a', colour: '#0f172a', label: 'Navy' },
  ];
  // A key pressed in the picker, then the focus it moves.
  const keyTo = (name: string) => {
    fireEvent.keyDown(screen.getByRole('group', { name: 'Text colour' }), { key: 'Shift' });
    fireEvent.focus(screen.getByRole('button', { name }));
  };
  function setup(current: string | null, onPreviewEnd?: () => void) {
    const onPick = vi.fn();
    render(
      <ColourPicker
        label="Text colour"
        value={current}
        onPick={onPick}
        theme={theme}
        leading={[noColour('transparent', 'No text colour')]}
        contrast={probe(current)}
        onPreviewEnd={onPreviewEnd}
      />,
    );
    return { onPick, root: screen.getByRole('group', { name: 'Text colour' }) };
  }

  it('judges the colour in force when nothing is hovered', () => {
    setup('#fef08a');
    expect(hint().textContent).toContain('Hard to read');
  });

  it('judges the swatch hovered or focused, and goes back when the pointer leaves', () => {
    const onPreviewEnd = vi.fn();
    const { root } = setup('#0f172a', onPreviewEnd);
    expect(hint().childElementCount).toBe(0);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Pale yellow' }), {
      pointerType: 'mouse',
    });
    expect(hint().textContent).toContain('Hard to read');
    // No colour judges nothing.
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'No text colour' }), {
      pointerType: 'mouse',
    });
    expect(hint().childElementCount).toBe(0);
    keyTo('Pale yellow');
    expect(hint().textContent).toContain('Hard to read');
    fireEvent.pointerLeave(root, { pointerType: 'mouse' });
    expect(hint().childElementCount).toBe(0);
    expect(onPreviewEnd).toHaveBeenCalled();
  });

  it('forgets the hovered swatch when focus leaves the picker', () => {
    const { root } = setup('#0f172a');
    keyTo('Pale yellow');
    expect(hint().textContent).toContain('Hard to read');
    fireEvent.blur(root, { relatedTarget: document.body });
    expect(hint().childElementCount).toBe(0);
    // Focus moving inside the picker keeps it.
    keyTo('Pale yellow');
    fireEvent.blur(root, { relatedTarget: screen.getByRole('button', { name: 'Navy' }) });
    expect(hint().textContent).toContain('Hard to read');
  });

  it('does not judge the swatches focused as the picker opens, only focus moved by a key', () => {
    setup(null);
    // Opening focuses the first key, then the Tab stop: with no swatch picked, a pale one here.
    fireEvent.focus(screen.getByRole('button', { name: 'No text colour' }));
    fireEvent.focus(screen.getByRole('button', { name: 'Pale yellow' }));
    expect(hint().childElementCount).toBe(0);
    keyTo('Pale yellow');
    expect(hint().textContent).toContain('Hard to read');
  });

  it('picks the suggested shade with Use', () => {
    const { onPick } = setup('#fef08a');
    fireEvent.click(screen.getByRole('button', { name: /^Use #/ }));
    expect(contrastRatio(onPick.mock.calls[0]![0] as string, '#ffffff')).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('shows no hint region without a probe', () => {
    render(<ColourPicker label="Fill" value={null} onPick={vi.fn()} theme={theme} />);
    expect(screen.queryByTestId('contrast-hint')).toBeNull();
  });

  it('keeps judging the swatch rested on when the pointer crosses others on its way down to Use', () => {
    const now = vi.spyOn(performance, 'now');
    const onPreview = vi.fn();
    const onPick = vi.fn();
    render(
      <ColourPicker
        label="Text colour"
        value="#0f172a"
        onPick={onPick}
        theme={theme}
        contrast={probe('#0f172a')}
        onPreview={onPreview}
      />,
    );
    const mouse = { pointerType: 'mouse' };
    now.mockReturnValue(0);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Pale yellow' }), mouse);
    // Resting on the pale one, then a frame on Navy on the way down to the row.
    now.mockReturnValue(600);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Navy' }), mouse);
    expect(hint().childElementCount).toBe(0);
    now.mockReturnValue(630);
    fireEvent.pointerEnter(document.querySelector('[data-contrast-row]')!, mouse);
    expect(hint().textContent).toContain('Hard to read');
    expect(onPreview).toHaveBeenLastCalledWith('#fef08a');
    fireEvent.click(screen.getByRole('button', { name: /^Use #/ }));
    const picked = onPick.mock.calls[0]![0] as string;
    expect(contrastRatio(picked, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('goes back to the colour in force when the pointer rested on no swatch on its way to the row', () => {
    const now = vi.spyOn(performance, 'now');
    const onPreviewEnd = vi.fn();
    render(
      <ColourPicker
        label="Text colour"
        value="#0f172a"
        onPick={vi.fn()}
        theme={theme}
        contrast={probe('#0f172a')}
        onPreviewEnd={onPreviewEnd}
      />,
    );
    const mouse = { pointerType: 'mouse' };
    now.mockReturnValue(0);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Pale yellow' }), mouse);
    expect(hint().textContent).toContain('Hard to read');
    now.mockReturnValue(20);
    fireEvent.pointerEnter(document.querySelector('[data-contrast-row]')!, mouse);
    expect(hint().childElementCount).toBe(0);
    expect(onPreviewEnd).toHaveBeenCalled();
    // Resting on the row, then coming back to it, changes nothing.
    fireEvent.pointerEnter(document.querySelector('[data-contrast-row]')!, mouse);
    expect(hint().childElementCount).toBe(0);
  });
});
