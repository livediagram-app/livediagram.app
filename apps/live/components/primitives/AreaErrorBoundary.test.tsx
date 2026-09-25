// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const track = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...a: unknown[]) => track(...a) }));

import { AreaErrorBoundary } from './AreaErrorBoundary';

let shouldThrow = true;
function Flaky() {
  if (shouldThrow) throw new TypeError('x is undefined');
  return <p>Canvas content</p>;
}

let quiet: ReturnType<typeof vi.spyOn>;
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
});
