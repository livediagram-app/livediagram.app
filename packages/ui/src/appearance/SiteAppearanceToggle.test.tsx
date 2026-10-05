// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SiteHeader } from '../SiteHeader';
import { APPEARANCE_STORAGE_KEY } from './appearance-storage';
import { resetAppearanceForTests } from './appearance-store';
import { SiteAppearanceToggle } from './SiteAppearanceToggle';

// The public sites' Appearance control (docs/specs/004-interface-design/appearance.md).

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
});

const toggle = () => screen.getByRole('button', { name: /^Appearance: / });

describe('SiteAppearanceToggle', () => {
  it('starts on System and follows a dark device', () => {
    osPrefersDark = true;
    render(<SiteAppearanceToggle />);
    expect(toggle()).toHaveProperty('ariaLabel', 'Appearance: System. Switch to Light.');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('cycles Light, Dark, System, painting and persisting each pick', () => {
    render(<SiteAppearanceToggle />);
    act(() => fireEvent.click(toggle()));
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(toggle()).toHaveProperty('ariaLabel', 'Appearance: Light. Switch to Dark.');

    act(() => fireEvent.click(toggle()));
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => fireEvent.click(toggle()));
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('system');
    expect(toggle()).toHaveProperty('ariaLabel', 'Appearance: System. Switch to Light.');
  });

  it('keeps an explicit Light over a dark device', () => {
    osPrefersDark = true;
    localStorage.setItem(APPEARANCE_STORAGE_KEY, 'light');
    render(<SiteAppearanceToggle />);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

describe('SiteHeader', () => {
  // docs/specs/004-interface-design/appearance.md: the toggle is never in the header; it lives on the page-edge
  // rail, which shows only where there is a gutter for it (xl up).
  it('keeps the Appearance toggle out of the header, on the rail', () => {
    render(<SiteHeader ctaSurface="Home" />);
    const toggles = screen.getAllByRole('button', { name: /^Appearance: / });
    expect(toggles).toHaveLength(1);
    expect(toggles[0]!.closest('header')).toBeNull();
    expect(toggles[0]!.closest('[role="toolbar"]')?.getAttribute('aria-label')).toBe('Appearance');
  });

  it("keeps the rail's Appearance card when sharing is off", () => {
    render(<SiteHeader actions={<a href="/new">Start drawing</a>} shareRail={false} />);
    expect(screen.getByRole('link', { name: 'Start drawing' })).toBeTruthy();
    expect(toggle().closest('header')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull();
  });
});
