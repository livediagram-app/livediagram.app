// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SnapColoursApi } from '@/hooks/canvas/useSnapColours';
import { SnapColoursSection } from './SnapColoursSection';

const api = (over: Partial<SnapColoursApi> = {}): SnapColoursApi => ({
  colours: ['#e03131', '#1971c2', '#868e96'],
  blocked: false,
  snap: vi.fn(() => 3),
  ...over,
});

// docs/specs/023-draw-mode/draw-mode.md "Snap colours".
describe('SnapColoursSection', () => {
  it('is not there while the board has no custom colours to snap', () => {
    const { container } = render(<SnapColoursSection snap={api({ colours: [] })} />);
    expect(container.innerHTML).toBe('');
  });

  it('names how many custom colours there are, shows them and offers the snap', () => {
    render(<SnapColoursSection snap={api()} />);
    const group = screen.getByRole('group', { name: 'Colours' });
    expect(group.querySelector('[data-flyout-heading]')!.textContent).toBe('Colours');
    expect(within(group).getByText('3 custom colours')).toBeTruthy();
    const swatches = group.querySelectorAll('[data-snap-swatch]');
    expect([...swatches].map((s) => s.getAttribute('data-snap-swatch'))).toEqual([
      '#e03131',
      '#1971c2',
      '#868e96',
    ]);
    expect(swatches[0]!.getAttribute('aria-hidden')).toBe('true');
    expect(within(group).getByRole('button', { name: 'Snap to stock colours' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('says one custom colour in the singular, and shows at most eight swatches', () => {
    const { rerender } = render(<SnapColoursSection snap={api({ colours: ['#e03131'] })} />);
    expect(screen.getByText('1 custom colour')).toBeTruthy();
    const many = Array.from({ length: 11 }, (_, i) => `#e031${(10 + i).toString(16)}`);
    rerender(<SnapColoursSection snap={api({ colours: many })} />);
    expect(screen.getByText('11 custom colours')).toBeTruthy();
    expect(document.querySelectorAll('[data-snap-swatch]')).toHaveLength(8);
  });

  it('snaps once on a press and confirms it in a polite status, in place of the button', () => {
    const snap = api();
    const { rerender } = render(<SnapColoursSection snap={snap} />);
    fireEvent.click(screen.getByRole('button', { name: 'Snap to stock colours' }));
    expect(snap.snap).toHaveBeenCalledTimes(1);
    // The board now has none: the section stays to say what happened.
    rerender(<SnapColoursSection snap={api({ colours: [], snap: snap.snap })} />);
    expect(screen.getByRole('status').textContent).toBe(
      '3 custom colours snapped to stock colours',
    );
    expect(screen.queryByRole('button', { name: 'Snap to stock colours' })).toBeNull();
    // The button is gone: the focus is on the confirmation, not lost.
    expect(document.activeElement).toBe(screen.getByRole('status'));
  });

  it('confirms one colour in the singular', () => {
    render(<SnapColoursSection snap={api({ colours: ['#e03131'], snap: vi.fn(() => 1) })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Snap to stock colours' }));
    expect(screen.getByRole('status').textContent).toBe('1 custom colour snapped to stock colours');
  });

  it('offers the colours again once an undo brings them back', () => {
    const snap = api();
    const { rerender } = render(<SnapColoursSection snap={snap} />);
    fireEvent.click(screen.getByRole('button', { name: 'Snap to stock colours' }));
    rerender(<SnapColoursSection snap={api({ colours: [] })} />);
    rerender(<SnapColoursSection snap={api()} />);
    expect(screen.getByRole('button', { name: 'Snap to stock colours' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('keeps the button disabled while the board cannot be edited', () => {
    const snap = api({ blocked: true });
    render(<SnapColoursSection snap={snap} />);
    const button = screen.getByRole('button', { name: 'Snap to stock colours' });
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.click(button);
    expect(snap.snap).not.toHaveBeenCalled();
  });

  it('shows nothing new when a press snapped nothing', () => {
    render(<SnapColoursSection snap={api({ snap: vi.fn(() => 0) })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Snap to stock colours' }));
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Snap to stock colours' })).toBeTruthy();
  });
});
