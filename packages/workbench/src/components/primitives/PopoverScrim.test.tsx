// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PopoverScrim } from './PopoverScrim';

afterEach(cleanup);

describe('PopoverScrim', () => {
  it('dims the window under its popover, hidden from assistive technology, fading in with motion', () => {
    const { container } = render(<PopoverScrim />);
    const scrim = container.querySelector<HTMLElement>('[data-popover-scrim]')!;
    expect(scrim.getAttribute('aria-hidden')).toBe('true');
    for (const c of ['fixed', 'inset-0', 'z-[var(--z-toolbar)]', 'motion-safe:animate-fade-in'])
      expect(scrim.className.split(' ')).toContain(c);
    expect(scrim.className).toMatch(/bg-slate-900\/\d+/);
    expect(scrim.className).toMatch(/dark:bg-slate-950\/\d+/);
  });

  it("closes on a click and hands focus back to the popover's button", async () => {
    const onClose = vi.fn();
    const { container, getByRole } = render(
      <>
        <span data-dock-button="">
          <button type="button" aria-expanded="true">
            Explorer
          </button>
        </span>
        <PopoverScrim onClose={onClose} />
      </>,
    );
    const scrim = container.querySelector<HTMLElement>('[data-popover-scrim]')!;
    // The press never moves focus to the page, nor reaches a document's outside-press listener.
    const outside = vi.fn();
    document.addEventListener('pointerdown', outside);
    expect(fireEvent.mouseDown(scrim)).toBe(false);
    fireEvent.pointerDown(scrim);
    document.removeEventListener('pointerdown', outside);
    expect(outside).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(document.activeElement).toBe(getByRole('button', { name: 'Explorer' })),
    );
  });
});
