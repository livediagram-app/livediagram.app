// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TitlePopoverButton, titleButtonClass } from './TitlePopoverButton';

// A phone or a desktop (useIsMobileViewport), a desktop unless a test says otherwise.
const phone = vi.hoisted(() => ({ on: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => phone.on,
}));

// A logo page's title-bar opener (Guides, Mirror). Its tooltip repeats its name (packages/ui Tooltip): it said
// "Guides: on" while the button was named "Guides", and hovering it warned "[tooltip] label is not the accessible
// name". Whether it is on is the button's aria-pressed and pressed look.
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  phone.on = false;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('TitlePopoverButton', () => {
  it('has a tooltip that is its name while on, its state in aria-pressed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <TitlePopoverButton
        name="Guides"
        on
        labelled
        className={titleButtonClass}
        icon={<svg />}
        width={240}
      >
        body
      </TitlePopoverButton>,
    );
    const button = screen.getByRole('button', { name: 'Guides' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.pointerEnter(button, { pointerType: 'mouse' });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('tooltip').textContent).toBe('Guides');
    expect(warn).not.toHaveBeenCalledWith(
      '[tooltip] label is not the accessible name',
      expect.anything(),
    );
  });

  // A phone's sheet drew a padded body (the Device popover's Orientation and Frame) flush with the sheet's edges,
  // while the sheet's name and an unpadded body's rows sat in from them.
  it.each([
    [true, 'px-4'],
    [false, null],
  ])(
    'on a phone, a body padded %s sits in from the sheet sides as on a desktop',
    (padded, inset) => {
      phone.on = true;
      render(
        <TitlePopoverButton
          name="Device"
          labelled={false}
          className={titleButtonClass}
          icon={<svg />}
          width={240}
          padded={padded}
        >
          body
        </TitlePopoverButton>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Device' }));
      const body = screen
        .getByRole('dialog', { name: 'Device' })
        .querySelector('[data-title-sheet-body]');
      expect(body?.textContent).toBe('body');
      expect(body?.classList.contains('px-4') ?? false).toBe(inset !== null);
    },
  );
});
