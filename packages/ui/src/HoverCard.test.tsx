// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HoverCard } from './HoverCard';
import { resetHintRegistry } from './hint/hint-registry';

afterEach(() => resetHintRegistry());

describe('HoverCard', () => {
  it('shows its title and description at once on hover, as a white card', () => {
    render(
      <HoverCard title="Zoom in" description="Zoom in by 10%.">
        <button type="button" aria-label="Zoom in" />
      </HoverCard>,
    );
    fireEvent.pointerEnter(screen.getByRole('button'), { pointerType: 'mouse' });
    const card = screen.getByRole('tooltip');
    expect(card.dataset.hint).toBe('hover-card');
    expect(card.textContent).toBe('Zoom inZoom in by 10%.');
    expect(card.className).toContain('bg-white');
    expect(card.className.split(' ')).toEqual(
      expect.arrayContaining(['dark:bg-slate-800', 'dark:border-slate-700']),
    );
    expect(card.className).toContain('pointer-events-auto');
  });

  it('keeps its layout wrapper and the classes callers pass through', () => {
    const { container } = render(
      <HoverCard title="Bar" block className="h-full" style={{ width: '40%' }}>
        <div />
      </HoverCard>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toBe('flex w-full h-full');
    expect(wrapper.style.width).toBe('40%');
  });

  it('is inline-flex by default', () => {
    const { container } = render(
      <HoverCard title="Bar">
        <div />
      </HoverCard>,
    );
    expect((container.firstElementChild as HTMLElement).className).toBe('inline-flex');
  });
});
