// @vitest-environment jsdom

// docs/specs/008-canvas/magnifier.md "The settings popover": the magnification slider, the Size and Shape
// choices (Custom only while the lens sits between the presets), the hint, Escape; and the mode's cluster button.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MAGNIFIER_CONFIG, type MagnifierConfig } from '@/lib/magnifier-config';
import { createMagnifierStore } from '@/lib/magnifier-store';
import { MAGNIFIER_HINT, MAGNIFIER_TOUCH_HINT, MagnifierPopover } from './MagnifierPopover';
import { MagnifierClusterButton } from './MagnifierClusterButton';

afterEach(() => cleanup());

// jsdom has no ResizeObserver; the popover measures itself with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const memoryStore = (config: MagnifierConfig = DEFAULT_MAGNIFIER_CONFIG) =>
  createMagnifierStore({ load: () => config, save: () => {}, report: () => {} });

describe('MagnifierPopover', () => {
  it('shows the settings as they stand, and the hint', async () => {
    render(<MagnifierPopover onClose={() => {}} store={memoryStore()} />);
    const slider = await screen.findByRole('slider', { name: 'Magnification' });
    expect(slider.getAttribute('aria-valuetext')).toBe('Magnification 2x');
    const size = screen.getByRole('radiogroup', { name: 'Lens size' });
    expect(
      [...size.querySelectorAll('[role="radio"]')].map((r) => [
        r.textContent,
        r.getAttribute('aria-checked'),
      ]),
    ).toEqual([
      ['Small', 'false'],
      ['Medium', 'true'],
      ['Large', 'false'],
    ]);
    expect(screen.getByRole('radio', { name: 'Square' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(MAGNIFIER_HINT)).toBeTruthy();
  });

  it('changes the lens at once from each control', async () => {
    const store = memoryStore();
    render(<MagnifierPopover onClose={() => {}} store={store} />);
    fireEvent.change(await screen.findByRole('slider', { name: 'Magnification' }), {
      target: { value: '4.5' },
    });
    expect(store.get().zoom).toBe(4.5);
    expect(
      (await screen.findByRole('slider', { name: 'Magnification' })).getAttribute('aria-valuetext'),
    ).toBe('Magnification 4.5x');
    fireEvent.click(screen.getByRole('radio', { name: 'Large' }));
    expect(store.get().size).toBe(360);
    fireEvent.click(screen.getByRole('radio', { name: 'Round' }));
    expect(store.get().shape).toBe('round');
    expect((await screen.findByRole('radio', { name: 'Round' })).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('says Custom while Shift+scroll left the lens between the sizes', async () => {
    const store = memoryStore({ ...DEFAULT_MAGNIFIER_CONFIG, size: 300 });
    render(<MagnifierPopover onClose={() => {}} store={store} />);
    const custom = await screen.findByRole('radio', { name: 'Custom' });
    expect(custom.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('300px')).toBeTruthy();
    // Custom is a reading, not a size: pressing it changes nothing.
    fireEvent.click(custom);
    expect(store.get().size).toBe(300);
    act(() => store.set('size', 160));
    expect(screen.queryByRole('radio', { name: 'Custom' })).toBeNull();
  });

  it('gives a touch screen the finger hint, whatever its width', async () => {
    const before = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(hover: none)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }));
    try {
      render(<MagnifierPopover onClose={() => {}} store={memoryStore()} />);
      expect(await screen.findByText(MAGNIFIER_TOUCH_HINT)).toBeTruthy();
      expect(screen.queryByText(MAGNIFIER_HINT)).toBeNull();
    } finally {
      window.matchMedia = before;
    }
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<MagnifierPopover onClose={onClose} store={memoryStore()} />);
    await screen.findByRole('slider', { name: 'Magnification' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('MagnifierClusterButton', () => {
  it('names the magnification and opens the settings from itself', async () => {
    const store = memoryStore();
    const onToggle = vi.fn();
    render(<MagnifierClusterButton open={false} onToggle={onToggle} store={store} />);
    const button = await screen.findByRole('button', { name: 'Magnifier settings, 2x' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledWith(button);
    act(() => store.set('zoom', 3.5));
    expect(await screen.findByRole('button', { name: 'Magnifier settings, 3.5x' })).toBeTruthy();
  });
});
