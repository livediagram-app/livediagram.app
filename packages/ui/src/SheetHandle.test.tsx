// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SHEET_HANDLE_PX, SheetHandle } from './SheetHandle';

const props = () => ({
  onPointerDown: vi.fn(),
  onPointerMove: vi.fn(),
  onPointerUp: vi.fn(),
  onPointerCancel: vi.fn(),
});

describe('SheetHandle', () => {
  it('is a strip tall enough for a thumb, carrying the drag', () => {
    const handleProps = props();
    const { container } = render(<SheetHandle handleProps={handleProps} className="sm:hidden" />);
    const strip = container.querySelector<HTMLElement>('[data-sheet-handle]')!;
    expect(strip.style.height).toBe(`${SHEET_HANDLE_PX}px`);
    expect(SHEET_HANDLE_PX).toBeGreaterThanOrEqual(32);
    expect(strip.className).toContain('sm:hidden');
    fireEvent.pointerDown(strip);
    expect(handleProps.onPointerDown).toHaveBeenCalledOnce();
  });

  it('wears a sheet’s own pill colour when given one', () => {
    const { container } = render(<SheetHandle handleProps={props()} pillColor="rgb(1, 2, 3)" />);
    const pill = container.querySelector<HTMLElement>('[data-sheet-handle] span')!;
    expect(pill.style.backgroundColor).toBe('rgb(1, 2, 3)');
    expect(pill.className).not.toContain('bg-slate-300');
  });
});
