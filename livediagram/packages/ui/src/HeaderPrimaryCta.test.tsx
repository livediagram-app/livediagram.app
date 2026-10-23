// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HeaderPrimaryCta } from './HeaderPrimaryCta';

// docs/specs/019-marketing/marketing-site.md "Header": Choose Template for a visitor, Open Explorer for
// someone signed in, as the sign-in provider's readable cookie says.
afterEach(() => {
  document.cookie = 'ld_signed_in=; max-age=0; path=/';
});

describe('the header primary', () => {
  it('is Choose Template, into the wizard, for a visitor', () => {
    const { container } = render(<HeaderPrimaryCta ctaSurface="Home" />);
    const a = container.querySelector('a')!;
    expect(a.getAttribute('aria-label')).toBe('Choose Template');
    expect(a.getAttribute('href')).toBe('/new?via=Home.Header');
  });

  it('is Open Explorer for someone signed in, and stays Choose Template when signed out', () => {
    document.cookie = 'ld_signed_in=1; path=/';
    const signedIn = render(<HeaderPrimaryCta ctaSurface="Home" />).container.querySelector('a')!;
    expect(signedIn.getAttribute('aria-label')).toBe('Open Explorer');
    expect(signedIn.getAttribute('href')).toBe('/explorer/home');
    document.cookie = 'ld_signed_in=0; path=/';
    const signedOut = render(<HeaderPrimaryCta />).container.querySelector('a')!;
    expect(signedOut.getAttribute('href')).toBe('/new');
  });
});
