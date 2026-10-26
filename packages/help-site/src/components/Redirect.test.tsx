// @vitest-environment jsdom
// A moved help page sends the reader on, keeping an old deep link's #section.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Redirect } from './Redirect';

function stubLocation(hash: string) {
  const replace = vi.fn();
  vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, hash, replace });
  return replace;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Redirect', () => {
  it('carries the old address’s #section to the new page', () => {
    const replace = stubLocation('#folders');
    render(<Redirect href="/help/explorer/the-explorer/" label="Explorer guide" />);
    expect(replace).toHaveBeenCalledWith('/help/explorer/the-explorer/#folders');
  });

  it('keeps a new address’s own #section, and adds nothing without one', () => {
    let replace = stubLocation('#old');
    render(<Redirect href="/help/canvas/#zoom" label="Canvas guide" />);
    expect(replace).toHaveBeenCalledWith('/help/canvas/#zoom');
    vi.restoreAllMocks();
    replace = stubLocation('');
    render(<Redirect href="/help/canvas/" label="Canvas guide" />);
    expect(replace).toHaveBeenCalledWith('/help/canvas/');
  });
});
