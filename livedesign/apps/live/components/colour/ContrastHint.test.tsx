// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contrastRatio, type TextGround } from '@livedesign/design';
import type { TextContrastProbe } from '@/lib/text-contrast-probe';
import { ColourPicker } from './ColourPicker';
import { ContrastHint } from './ContrastHint';
import { noColour } from './colour-options';

// docs/specs/004-interface-design/colour-picker.md "Reading on its ground".
afterEach(cleanup);

const PAPER: TextGround = { tones: ['#ffffff'], on: 'page' };
const hint = () => screen.getByTestId('contrast-hint');

describe('ContrastHint', () => {
  it('says nothing while the colour reads', () => {
    render(<ContrastHint colour="#0f172a" ground={PAPER} large={false} onUse={vi.fn()} />);
    expect(hint().childElementCount).toBe(0);
    expect(hint().getAttribute('role')).toBe('status');
  });

  it('shows the ratio and the target under 4.5:1, and Use applies a shade that passes', () => {
    const onUse = vi.fn();
    render(<ContrastHint colour="#fde047" ground={PAPER} large={false} onUse={onUse} />);
    expect(hint().textContent).toContain('Hard to read on this page');
    // Floored, never rounded up onto the target.
    expect(hint().textContent).toContain(
      `${Math.floor(contrastRatio('#fde047', '#ffffff') * 10) / 10}:1, aim for 4.5:1`,
    );
    const use = screen.getByRole('button', { name: /^Use #[0-9a-f]{6}, a darker shade/ });
    fireEvent.click(use);
    const picked = onUse.mock.calls[0]![0] as string;
    expect(contrastRatio(picked, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('holds large text to 3:1', () => {
    render(<ContrastHint colour="#949494" ground={PAPER} large onUse={vi.fn()} />);
    expect(hint().childElementCount).toBe(0);
    cleanup();
    render(<ContrastHint colour="#b0b0b0" ground={PAPER} large onUse={vi.fn()} />);
    expect(hint().textContent).toContain('aim for 3:1');
  });

  it('offers a lighter shade on a dark fill and names the ground', () => {
    render(
      <ContrastHint
        colour="#1e3a8a"
        ground={{ tones: ['#0f172a'], on: 'shape' }}
        large={false}
        onUse={vi.fn()}
      />,
    );
    expect(hint().textContent).toContain('Hard to read on its fill');
    expect(
      screen.getByRole('button', { name: /a lighter shade that reads on its fill/ }),
    ).toBeTruthy();
  });

  it('shows no Use when no shade of the hue passes, and nothing for no colour', () => {
    render(
      <ContrastHint
        colour="#808080"
        ground={{ tones: ['#000000', '#ffffff'], on: 'card' }}
        large={false}
        onUse={vi.fn()}
      />,
    );
    expect(hint().textContent).toContain('on the shape behind');
    expect(screen.queryByRole('button')).toBeNull();
    cleanup();
    render(<ContrastHint colour={null} ground={PAPER} large={false} onUse={vi.fn()} />);
    expect(hint().childElementCount).toBe(0);
  });
});

describe('ColourPicker with a contrast probe', () => {
  const probe = (current: string | null): TextContrastProbe => ({
    ground: PAPER,
    large: false,
    current,
    colourOf: (id) => (id.startsWith('#') ? id : null),
  });
  const theme = [
    { id: '#fef08a', colour: '#fef08a', label: 'Pale yellow' },
    { id: '#0f172a', colour: '#0f172a', label: 'Navy' },
  ];
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
    fireEvent.focus(screen.getByRole('button', { name: 'Pale yellow' }));
    expect(hint().textContent).toContain('Hard to read');
    fireEvent.pointerLeave(root, { pointerType: 'mouse' });
    expect(hint().childElementCount).toBe(0);
    expect(onPreviewEnd).toHaveBeenCalled();
  });

  it('forgets the hovered swatch when focus leaves the picker', () => {
    const { root } = setup('#0f172a');
    fireEvent.focus(screen.getByRole('button', { name: 'Pale yellow' }));
    expect(hint().textContent).toContain('Hard to read');
    fireEvent.blur(root, { relatedTarget: document.body });
    expect(hint().childElementCount).toBe(0);
    // Focus moving inside the picker keeps it.
    fireEvent.focus(screen.getByRole('button', { name: 'Pale yellow' }));
    fireEvent.blur(root, { relatedTarget: screen.getByRole('button', { name: 'Navy' }) });
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
});
