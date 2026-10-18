// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The first run's field (docs/specs/013-workspace/explorer-home.md "First run"): it searches templates in the wizard,
// and Start Blank makes a blank diagram at once.

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));

import { WelcomeSearch } from './WelcomeSearch';

const assign = vi.fn();
beforeEach(() => {
  track.mockReset();
  assign.mockReset();
  vi.stubGlobal('location', { ...window.location, assign });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('WelcomeSearch', () => {
  it('opens the wizard on the words', () => {
    render(<WelcomeSearch />);
    const field = screen.getByRole('searchbox', { name: 'Search templates' });
    fireEvent.change(field, { target: { value: 'retro' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(assign).toHaveBeenCalledWith('/new?q=retro');
    expect(track).toHaveBeenCalledWith('Home', 'Selected', 'Welcome.Search');
  });

  it('starts a blank diagram from its end', () => {
    render(<WelcomeSearch />);
    const blank = screen.getByRole('link', { name: 'Start Blank' });
    expect(blank.getAttribute('href')).toBe('/new?blank=1');
    fireEvent.click(blank);
    expect(track).toHaveBeenCalledWith('Home', 'Selected', 'Welcome.StartBlank');
  });
});
