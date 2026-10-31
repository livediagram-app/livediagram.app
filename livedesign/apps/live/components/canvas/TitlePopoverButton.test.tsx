// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TitlePopoverButton, titleButtonClass } from './TitlePopoverButton';

// A logo page's title-bar opener (Guides, Mirror). Its tooltip repeats its name (packages/ui Tooltip): it said
// "Guides: on" while the button was named "Guides", and hovering it warned "[tooltip] label is not the accessible
// name". Whether it is on is the button's aria-pressed and pressed look.
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
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
});
