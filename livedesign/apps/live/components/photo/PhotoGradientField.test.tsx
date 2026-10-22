// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Gradient } from '@livedesign/photo-engine';
import { GradientEditor, PhotoGradientField } from './PhotoGradientField';

// docs/specs/031-photo/photo-tools.md "Fills and gradients": the gradient editor's presets, stops and the
// chosen stop's settings.
const bw: Gradient = {
  colours: [
    { at: 0, colour: '#000000' },
    { at: 1, colour: '#ffffff' },
  ],
  opacities: [
    { at: 0, opacity: 1 },
    { at: 1, opacity: 1 },
  ],
};

afterEach(cleanup);

describe('the gradient editor', () => {
  it('takes a preset whole', () => {
    const onChange = vi.fn<(g: Gradient) => void>();
    render(<GradientEditor value={bw} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ocean' }));
    expect(onChange.mock.calls[0]![0].colours.map((s) => s.colour)).toEqual([
      '#0b3d91',
      '#1fa2ff',
      '#a6ffcb',
    ]);
  });

  it('adds a colour stop on a press beside the strip', () => {
    const onChange = vi.fn<(g: Gradient) => void>();
    render(<GradientEditor value={bw} onChange={onChange} />);
    const stops = screen.getByRole('group', { name: 'Gradient Stops' });
    const colourRow = stops.lastElementChild as HTMLElement;
    fireEvent.pointerDown(colourRow, { clientX: 0, clientY: 0, pointerId: 1 });
    expect(onChange.mock.calls[0]![0].colours).toHaveLength(3);
  });

  it('deletes the chosen stop, but never the last of its kind', () => {
    const onChange = vi.fn<(g: Gradient) => void>();
    const { rerender } = render(<GradientEditor value={bw} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Stop' }));
    const one = onChange.mock.calls[0]![0];
    expect(one.colours).toEqual([{ at: 1, colour: '#ffffff' }]);
    rerender(<GradientEditor value={one} onChange={onChange} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Colour stop at 100%' }), {
      clientX: 0,
      clientY: 0,
      pointerId: 1,
    });
    expect(screen.getByRole('button', { name: 'Delete Stop' })).toHaveProperty('disabled', true);
  });

  it('opens from its strip', () => {
    render(<PhotoGradientField label="Gradient" value={bw} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gradient' }));
    expect(screen.getByRole('group', { name: 'Gradient Stops' })).toBeTruthy();
  });
});
