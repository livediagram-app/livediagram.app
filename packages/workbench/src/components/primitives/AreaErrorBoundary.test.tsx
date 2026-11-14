// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

const track = vi.fn<(category: 'Error', action: 'Client', type: string) => void>();

const recover = vi.fn<(...a: unknown[]) => void>();
vi.mock('../../lib/stale-build-navigation', () => ({
  browserNavigationDeps: () => ({}),
  recoverInBrowser: (...a: unknown[]) => recover(...a),
}));

import { act, useLayoutEffect } from 'react';
import { createAreaErrorBoundary } from './AreaErrorBoundary';

// Bound as an editor binds it (its components/primitives/AreaErrorBoundary.tsx).
const { AreaErrorBoundary, MenuErrorBoundary } = createAreaErrorBoundary({
  track: (...a) => track(...a),
  labels: { Canvas: 'the canvas', Modals: 'a dialog', ExplorerPane: 'this page', Menu: 'the menu' },
});

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
    // Told what was thrown, so the owner can say why.
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
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

    it('mounts again at once when the connection came back before it began to wait', () => {
      // Back online in the commit, after the render that failed offline and before the boundary waits.
      function GoOnline() {
        useLayoutEffect(() => {
          online = true;
          shouldThrow = false;
        }, []);
        return null;
      }
      render(
        <>
          <GoOnline />
          <AreaErrorBoundary area="Canvas" fallback="panel">
            <Unloaded />
          </AreaErrorBoundary>
        </>,
      );
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

function Boom(): never {
  throw new Error('menu render failed');
}

describe('MenuErrorBoundary', () => {
  it('renders the menu normally', () => {
    render(
      <MenuErrorBoundary onError={vi.fn()}>
        <p>Menu</p>
      </MenuErrorBoundary>,
    );
    expect(screen.getByText('Menu')).toBeTruthy();
  });

  it('closes the menu instead of taking the page down when it throws', () => {
    const onError = vi.fn();
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <div>
        <p>Editor</p>
        <MenuErrorBoundary onError={onError}>
          <Boom />
        </MenuErrorBoundary>
      </div>,
    );
    // The page around the menu survives; the menu asks to be closed.
    expect(screen.getByText('Editor')).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);
    quiet.mockRestore();
  });
});
