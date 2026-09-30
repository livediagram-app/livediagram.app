// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { APPEARANCE_STORAGE_KEY, resetAppearanceForTests } from '@livediagram/ui';
import { AppearanceToggle } from './AppearanceToggle';

// The editor's Appearance control (docs/specs/004-interface-design/appearance.md) and its power
// user quick switch (docs/specs/007-editor/power-user-mode.md#quick-appearance-switch).

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

let osPrefersDark = false;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  osPrefersDark = false;
  window.matchMedia = vi.fn((query: string) => ({
    matches: osPrefersDark && query.includes('dark'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  resetAppearanceForTests();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  track.mockReset();
  vi.restoreAllMocks();
});

const toggle = () => screen.getByRole('button', { name: /^Appearance: / });
const stored = () => localStorage.getItem(APPEARANCE_STORAGE_KEY);
const painted = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

function renderToggle(powerUser: boolean) {
  render(<AppearanceToggle quick={powerUser} />);
}

describe('AppearanceToggle', () => {
  describe('outside power user mode', () => {
    it('cycles Light, Dark, System', () => {
      renderToggle(false);
      expect(toggle().getAttribute('aria-label')).toBe('Appearance: System. Switch to Light.');
      act(() => fireEvent.click(toggle()));
      expect(stored()).toBe('light');
      act(() => fireEvent.click(toggle()));
      expect(stored()).toBe('dark');
      act(() => fireEvent.click(toggle()));
      expect(stored()).toBe('system');
    });

    it('leaves the context menu to the browser', () => {
      renderToggle(false);
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      act(() => void toggle().dispatchEvent(event));
      expect(event.defaultPrevented).toBe(false);
      expect(stored()).toBeNull();
    });
  });

  describe('in power user mode', () => {
    it('switches between Light and Dark on click', () => {
      renderToggle(true);
      act(() => fireEvent.click(toggle()));
      expect(stored()).toBe('dark');
      expect(painted()).toBe('dark');
      expect(toggle().getAttribute('aria-label')).toBe(
        'Appearance: Dark. Switch to Light. Right-click to follow your device.',
      );
      act(() => fireEvent.click(toggle()));
      expect(stored()).toBe('light');
      expect(painted()).toBe('light');
      act(() => fireEvent.click(toggle()));
      expect(stored()).toBe('dark');
      expect(track.mock.calls).toEqual([
        ['UI', 'Toggled', 'Dark'],
        ['UI', 'Toggled', 'Light'],
        ['UI', 'Toggled', 'Dark'],
      ]);
    });

    it('flips System to the opposite of what the device paints', () => {
      osPrefersDark = true;
      resetAppearanceForTests();
      renderToggle(true);
      expect(toggle().getAttribute('aria-label')).toBe(
        'Appearance: System. Switch to Light. Right-click to follow your device.',
      );
      act(() => fireEvent.click(toggle()));
      expect(stored()).toBe('light');
      expect(painted()).toBe('light');
    });

    it('sets System on right-click, without the browser menu', () => {
      osPrefersDark = true;
      localStorage.setItem(APPEARANCE_STORAGE_KEY, 'light');
      resetAppearanceForTests();
      renderToggle(true);
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      act(() => void toggle().dispatchEvent(event));
      expect(event.defaultPrevented).toBe(true);
      expect(stored()).toBe('system');
      expect(painted()).toBe('dark');
      expect(track).toHaveBeenCalledWith('UI', 'Toggled', 'System');
    });

    it('changes nothing on right-click when already on System', () => {
      renderToggle(true);
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      act(() => void toggle().dispatchEvent(event));
      expect(event.defaultPrevented).toBe(true);
      expect(stored()).toBeNull();
      expect(track).not.toHaveBeenCalled();
    });
  });
});
