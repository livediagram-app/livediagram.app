// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientPicker } from './ClientPicker';

// docs/specs/019-marketing/build-with-ai.md "The clients".
const wide = (matches: boolean) =>
  vi.stubGlobal('matchMedia', () => ({
    matches,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('ClientPicker', () => {
  it('reads as a list across the top on a phone and down the side on a wide screen', () => {
    wide(false);
    const { unmount } = render(<ClientPicker />);
    expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe('horizontal');
    unmount();
    wide(true);
    render(<ClientPicker />);
    expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe('vertical');
  });

  it('describes each tab by its group, which cannot sit in the list itself', () => {
    wide(true);
    render(<ClientPicker />);
    const tab = screen.getByRole('tab', { name: /Cursor/ });
    const group = document.getElementById(tab.getAttribute('aria-describedby')!);
    expect(group?.textContent).toBe('Editors');
  });

  it('opens on the client a link names, in its first render', () => {
    wide(true);
    window.history.replaceState(null, '', '/ai#cursor');
    vi.stubGlobal('requestAnimationFrame', () => 0);
    render(<ClientPicker />);
    expect(screen.getByRole('tab', { name: /Cursor/ }).getAttribute('aria-selected')).toBe('true');
  });
});
