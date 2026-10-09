// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { penColourHex } from '@livediagram/document';
import { CanvasSurfaceProvider } from '@/components/canvas/CanvasSurfaceContext';
import { DEFAULT_LASER_CONFIG } from '@/lib/laser-config';
import { LaserColourRow } from './LaserColourRow';

// docs/specs/008-canvas/laser-panel.md, on the one colour picker
// (docs/specs/004-interface-design/colour-picker.md).
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

describe('LaserColourRow', () => {
  it('shows the colour in force, and opens the picker with Your colour first', () => {
    const onPick = vi.fn();
    const onOpen = vi.fn();
    render(
      <CanvasSurfaceProvider surface="dark">
        <LaserColourRow
          config={{ ...DEFAULT_LASER_CONFIG, colour: 'red' }}
          selfColour="#0ea5e9"
          onPick={onPick}
          onOpen={onOpen}
        />
      </CanvasSurfaceProvider>,
    );
    const trigger = screen.getByRole('button', { name: 'Colour: Red' });
    expect((trigger.querySelector('[data-swatch-chip]') as HTMLElement).style.backgroundColor).toBe(
      rgb(penColourHex('red', 'dark')),
    );
    fireEvent.click(trigger);
    expect(onOpen).toHaveBeenCalled();
    const colours = within(screen.getByRole('group', { name: 'Standard Colours' })).getAllByRole(
      'button',
    );
    expect(colours[0]!.getAttribute('aria-label')).toBe('Your colour');
    expect(screen.getByRole('button', { name: 'Red' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Your colour' }));
    expect(onPick).toHaveBeenCalledWith('presence');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
