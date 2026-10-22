// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const recoverInBrowser = vi.fn(() => Promise.resolve('reloading'));
vi.mock('@/lib/stale-build-navigation', () => ({
  browserNavigationDeps: () => ({}),
  recoverInBrowser: (...a: unknown[]) => recoverInBrowser(...(a as [])),
}));
vi.mock('./globals.css', () => ({}));

const { default: GlobalError } = await import('./global-error');

// docs/specs/016-platform/stale-builds.md "The safety net": the root error boundary is the app's.
afterEach(() => {
  recoverInBrowser.mockClear();
  vi.restoreAllMocks();
});

describe('GlobalError', () => {
  it('tries the stale chunk recovery, and shows a calm page with a reload', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = Object.assign(new Error('Loading chunk 1 failed.'), { name: 'ChunkLoadError' });
    render(<GlobalError error={error} reset={() => {}} />, { container: document.documentElement });
    expect(recoverInBrowser).toHaveBeenCalledWith(error, {});
    expect(screen.getByRole('heading').textContent).toBe("This page couldn't load");
    expect(screen.getByText('Reload to try again.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
  });
});
