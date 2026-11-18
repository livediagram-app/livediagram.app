// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('shows nothing while disabled, keeping the same control so it keeps its focus', () => {
    const { rerender } = render(
      <HoverCard title="Explorer">
        <button type="button" aria-label="Explorer" />
      </HoverCard>,
    );
    const button = screen.getByRole('button');
    button.focus();
    rerender(
      <HoverCard title="Explorer" disabled>
        <button type="button" aria-label="Explorer" />
      </HoverCard>,
    );
    fireEvent.pointerEnter(screen.getByRole('button'), { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(screen.getByRole('button')).toBe(button);
    expect(document.activeElement).toBe(button);
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

describe('for assistive technology', () => {
  it('describes its control by the description, kept beside any description it had', () => {
    render(
      <HoverCard title="Details view" description="A sortable table.">
        <button type="button" aria-describedby="own">
          Details
        </button>
      </HoverCard>,
    );
    const button = screen.getByRole('button', { name: 'Details' });
    const ids = button.getAttribute('aria-describedby')!.split(' ');
    expect(ids[0]).toBe('own');
    expect(document.getElementById(ids[1]!)?.textContent).toBe('A sortable table.');
  });

  it('adds nothing when there is no description', () => {
    render(
      <HoverCard title="Details view">
        <button type="button">Details</button>
      </HoverCard>,
    );
    expect(screen.getByRole('button').hasAttribute('aria-describedby')).toBe(false);
  });
});

// Work Tracker 1109: a trigger in a Document Picture-in-Picture window (livehuddle's mini view) draws its card in that
// window, placed against that window's size, never in the tab that opened it.
describe('HoverCard in a second document', () => {
  it('portals into the trigger’s own document and places against its window', () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const pipDoc = frame.contentDocument!;
    const pipWin = frame.contentWindow!;
    const container = pipDoc.body.appendChild(pipDoc.createElement('div'));
    try {
      const listen = vi.spyOn(pipWin, 'addEventListener');
      const { unmount } = render(
        <HoverCard title="Mute" description="Nobody hears you.">
          <button type="button" aria-label="Mute" />
        </HoverCard>,
        { container },
      );
      const button = pipDoc.querySelector('button')!;
      fireEvent.pointerEnter(button, { pointerType: 'mouse' });
      const card = pipDoc.querySelector('[role="tooltip"]');
      expect(card?.textContent).toBe('MuteNobody hears you.');
      expect(card?.parentElement).toBe(pipDoc.body);
      expect(document.querySelector('[role="tooltip"]')).toBeNull();
      // Re-placed on the window it shows in: its scroll and resize, not the opener's.
      expect(listen).toHaveBeenCalledWith('resize', expect.any(Function));
      // Escape in that window dismisses it.
      fireEvent.keyDown(pipDoc, { key: 'Escape' });
      expect(pipDoc.querySelector('[role="tooltip"]')).toBeNull();
      unmount();
    } finally {
      frame.remove();
    }
  });

  it('still portals into the page for a trigger in the page', () => {
    render(
      <HoverCard title="Zoom in">
        <button type="button" aria-label="Zoom in" />
      </HoverCard>,
    );
    fireEvent.pointerEnter(screen.getByRole('button'), { pointerType: 'mouse' });
    expect(screen.getByRole('tooltip').parentElement).toBe(document.body);
  });
});
