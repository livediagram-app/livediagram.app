// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { APPEARANCE_STORAGE_KEY, resetAppearanceForTests } from '@liveplanner/ui';
import { AppearanceToggle } from './AppearanceToggle';

// The editor's Appearance control (docs/specs/004-interface-design/appearance.md): it cycles, for everyone.

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  window.matchMedia = vi.fn((query: string) => ({
    matches: false,
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

describe('AppearanceToggle', () => {
  it('cycles Light, Dark, System, painting each', () => {
    render(<AppearanceToggle />);
    expect(toggle().getAttribute('aria-label')).toBe('Appearance: System. Switch to Light.');
    act(() => {
      fireEvent.click(toggle());
    });
    expect(stored()).toBe('light');
    expect(painted()).toBe('light');
    act(() => {
      fireEvent.click(toggle());
    });
    expect(stored()).toBe('dark');
    expect(painted()).toBe('dark');
    act(() => {
      fireEvent.click(toggle());
    });
    expect(stored()).toBe('system');
    expect(track.mock.calls).toEqual([
      ['UI', 'Toggled', 'Light'],
      ['UI', 'Toggled', 'Dark'],
      ['UI', 'Toggled', 'System'],
    ]);
  });

  it('leaves the context menu to the browser', () => {
    render(<AppearanceToggle />);
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => void toggle().dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false);
    expect(stored()).toBeNull();
  });
});
