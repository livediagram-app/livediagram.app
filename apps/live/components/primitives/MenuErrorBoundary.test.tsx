// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MenuErrorBoundary } from './MenuErrorBoundary';

function Boom(): never {
  throw new Error('menu render failed');
}

afterEach(cleanup);

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
