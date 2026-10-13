// @vitest-environment jsdom

// The Looks' Finish filter (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks").
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TAB_LOOKS } from '@/lib/tab-looks';
import { track } from '@/lib/telemetry';
import { LooksCarousel } from './LooksCarousel';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(() => cleanup());

const cards = () =>
  screen
    .getAllByRole('button')
    .filter((b) => b.hasAttribute('aria-pressed'))
    .map((b) => b.querySelector('span > span')?.textContent);

describe('the Looks finish filter', () => {
  it('shows every look, then only the looks of the chosen finish', () => {
    render(<LooksCarousel activeLook={undefined} onPickLook={() => {}} headingClass="" />);
    expect(cards()).toHaveLength(TAB_LOOKS.length);
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter looks by finish' }), {
      target: { value: 'sketch' },
    });
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'LooksFinishFilter');
    const sketch = TAB_LOOKS.filter((l) => l.finish === 'sketch').map((l) => l.label);
    expect(sketch.length).toBeGreaterThan(0);
    expect(cards()).toEqual(sketch);
  });
});
