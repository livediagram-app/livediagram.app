// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { track } from '@/lib/telemetry';
import { CanvasFocusProvider } from '@/hooks/canvas/useCanvasFocus';
import { FocusElementButton } from './FocusElementButton';
import { planPalette } from './plan-palette';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const bounds = { x: 10, y: 20, width: 300, height: 200 };

describe('Focus', () => {
  it('fits the element, keeping its press from the canvas', () => {
    const focus = vi.fn();
    const outer = vi.fn();
    render(
      <div onPointerDown={outer}>
        <CanvasFocusProvider value={focus}>
          <FocusElementButton bounds={bounds} kind="Sheet" palette={planPalette('light')} />
        </CanvasFocusProvider>
      </div>,
    );
    const button = screen.getByRole('button', { name: 'Focus Sheet' });
    fireEvent.pointerDown(button);
    fireEvent.click(button);
    expect(outer).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledWith({ x: 10, y: 20, w: 300, h: 200 });
    expect(track).toHaveBeenCalledWith('Plan', 'Toggled', 'SheetFocused');
  });

  it('is not drawn outside an editor canvas', () => {
    render(<FocusElementButton bounds={bounds} kind="Board" palette={planPalette('light')} />);
    expect(screen.queryByRole('button', { name: 'Focus Board' })).toBeNull();
  });
});
