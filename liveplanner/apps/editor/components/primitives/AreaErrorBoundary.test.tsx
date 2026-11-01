// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

const track = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({ track: (...a: Parameters<typeof track>) => track(...a) }));

const recover = vi.fn();
vi.mock('@liveworkspace/workbench/lib/stale-build-navigation', () => ({
  browserNavigationDeps: () => ({}),
  recoverInBrowser: (...a: unknown[]) => recover(...a),
}));

import { act } from 'react';
import { AreaErrorBoundary } from './AreaErrorBoundary';

let shouldThrow = true;
function Flaky() {
  if (shouldThrow) throw new TypeError('x is undefined');
  return <p>Canvas content</p>;
}

let quiet: MockInstance<typeof console.error>;
beforeEach(() => {
  shouldThrow = true;
  track.mockClear();
  quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  quiet.mockRestore();
});

describe('AreaErrorBoundary', () => {
  it('reports which area broke and what was thrown, never the message', () => {
    render(
      <AreaErrorBoundary area="Canvas" fallback="panel">
        <Flaky />
      </AreaErrorBoundary>,
    );
    expect(track).toHaveBeenCalledWith('Error', 'Client', 'Render.Canvas.TypeError');
  });

  it('keeps the rest of the page and offers a retry that remounts the area', () => {
    render(
      <div>
        <p>Header</p>
        <AreaErrorBoundary area="Canvas" fallback="panel">
          <Flaky />
        </AreaErrorBoundary>
      </div>,
    );
    expect(screen.getByText('Header')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('the canvas');
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(screen.getByText('Canvas content')).toBeTruthy();
  });

  it('renders nothing for an overlay and lets the owner close it', () => {
    const onError = vi.fn();
    const { container } = render(
      <AreaErrorBoundary area="Modals" onError={onError}>
        <Flaky />
      </AreaErrorBoundary>,
    );
    expect(container.innerHTML).toBe('');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('clears the failure when the reset key changes', () => {
    const { rerender } = render(
      <AreaErrorBoundary area="ExplorerPane" fallback="panel" resetKey="/explorer/recent">
        <Flaky />
      </AreaErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    shouldThrow = false;
    rerender(
      <AreaErrorBoundary area="ExplorerPane" fallback="panel" resetKey="/explorer/all">
        <Flaky />
      </AreaErrorBoundary>,
    );
    expect(screen.getByText('Canvas content')).toBeTruthy();
  });

  // load-recovery.md "Offline": code that has not loaded cannot come while offline.
  describe('a chunk that cannot load while offline', () => {
    let online = false;
    let onLine: MockInstance<() => boolean>;
    function Unloaded() {
      if (shouldThrow) {
        const e = new Error('Failed to load chunk /live/_next/static/chunks/a.js from module 1');
        e.name = 'ChunkLoadError';
        throw e;
      }
      return <p>Canvas content</p>;
    }
    beforeEach(() => {
      online = false;
      onLine = vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
    });
    afterEach(() => onLine.mockRestore());
    function goOnline() {
      online = true;
      shouldThrow = false;
      act(() => {
        window.dispatchEvent(new Event('online'));
      });
    }

    it('says so, offers no Try Again, and comes back on its own once online', () => {
      render(
        <AreaErrorBoundary area="Canvas" fallback="panel">
          <Unloaded />
        </AreaErrorBoundary>,
      );
      expect(screen.getByRole('alert').textContent).toBe(
        "You're offline, so the canvas couldn't load. It comes back when you reconnect.",
      );
      expect(screen.queryByRole('button', { name: 'Try Again' })).toBeNull();
      goOnline();
      expect(screen.getByText('Canvas content')).toBeTruthy();
    });

    it('mounts an overlay again once online', () => {
      const { container } = render(
        <AreaErrorBoundary area="Modals">
          <Unloaded />
        </AreaErrorBoundary>,
      );
      expect(container.innerHTML).toBe('');
      goOnline();
      expect(screen.getByText('Canvas content')).toBeTruthy();
    });

    it('keeps Try Again for a chunk that failed while online', () => {
      online = true;
      render(
        <AreaErrorBoundary area="Canvas" fallback="panel">
          <Unloaded />
        </AreaErrorBoundary>,
      );
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeTruthy();
    });

    it('stops listening once it unmounts', () => {
      const off = vi.spyOn(window, 'removeEventListener');
      const { unmount } = render(
        <AreaErrorBoundary area="Canvas" fallback="panel">
          <Unloaded />
        </AreaErrorBoundary>,
      );
      unmount();
      expect(off).toHaveBeenCalledWith('online', expect.any(Function));
      off.mockRestore();
    });
  });
});
