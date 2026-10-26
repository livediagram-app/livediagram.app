// @vitest-environment jsdom
// A retired legal page sends the reader on, keeping an old deep link's #section.
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LegalRedirect } from './LegalRedirect';

afterEach(() => vi.restoreAllMocks());

describe('LegalRedirect', () => {
  it('carries the old address’s #section to the new page', () => {
    const replace = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      hash: '#cookies',
      replace,
    });
    render(
      <LegalRedirect
        href="https://liveworkspace.app/privacy/"
        heading="Privacy has moved"
        linkText="read it here"
      />,
    );
    expect(replace).toHaveBeenCalledWith('https://liveworkspace.app/privacy/#cookies');
  });
});
