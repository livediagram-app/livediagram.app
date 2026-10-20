// @vitest-environment jsdom

// The guest-only notice (docs/specs/014-identity/auth-and-guest-access.md): on a deployment without sign-in,
// "Continue as guest" goes back to the page that sent the visitor (Share's "Sign in to Share" names its document),
// never the site's front page.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => ({ value: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/sign-in/',
  useSearchParams: () => new URLSearchParams(query.value),
}));

import { AuthDisabledNotice } from './auth-shared';

afterEach(cleanup);

const href = () => screen.getByRole('link', { name: 'Continue as guest' }).getAttribute('href');

describe('AuthDisabledNotice', () => {
  it('sends a guest back to the document they came from', () => {
    query.value = 'redirect_url=%2Fdocument%2Fabc';
    render(<AuthDisabledNotice />);
    expect(href()).toBe('/document/abc');
  });

  it('sends a guest to the welcome flow when nothing safe came with them', () => {
    query.value = 'redirect_url=%2F%2Fevil.example';
    render(<AuthDisabledNotice />);
    expect(href()).toBe('/new');
  });
});
