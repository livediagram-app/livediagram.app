// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteHeader } from './SiteHeader';

// docs/specs/019-marketing/marketing-site.md "Header": signed in, the marketing header ends with liveworkspace.app's
// account menu, read from the api's readable cookies; a visitor's ends with the same control as Guest, and asks
// nothing.
const clear = () => {
  for (const name of ['lp_signed_in', 'lp_account']) {
    document.cookie = `${name}=; max-age=0; path=/`;
  }
};
afterEach(() => {
  clear();
  vi.unstubAllGlobals();
});

describe('the site header account menu', () => {
  it('shows a visitor the Guest button, with no request and none of the menu until approached', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<SiteHeader ctaSurface="Home" account />);
    const guest = screen.getByRole('button', { name: 'Guest, account menu' });
    expect(guest.getAttribute('aria-expanded')).toBe('false');
    expect(fetchMock).not.toHaveBeenCalled();
    // Pressed before the menu's code is here: it opens once it arrives, on the app's own Sign in.
    fireEvent.click(guest);
    const signIn = await screen.findByRole('menuitem', { name: 'Sign in' }, { timeout: 10_000 });
    expect(signIn.getAttribute('href')).toBe('/api/auth/sign-in?return_to=%2F');
    expect(screen.getByRole('menuitem', { name: /Create account/ }).getAttribute('href')).toBe(
      '/api/auth/sign-in?return_to=%2F&screen=sign-up',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the signed-in person's menu from the cookies, with no request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    document.cookie = 'lp_signed_in=1; path=/';
    document.cookie = 'lp_account=Ada%20Lovelace; path=/';
    render(<SiteHeader ctaSurface="Home" account />);
    expect(
      await screen.findByRole(
        'button',
        { name: 'Ada Lovelace, account menu' },
        { timeout: 10_000 },
      ),
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is left out where the surface does not ask for it (help, the dashboard)', () => {
    document.cookie = 'lp_signed_in=1; path=/';
    document.cookie = 'lp_account=Ada; path=/';
    const { container } = render(<SiteHeader ctaSurface="Home" />);
    expect(container.querySelector('[aria-label$="account menu"]')).toBeNull();
  });

  it('keeps the marketing bar for someone signed in: the three links, then the menu at the far right', async () => {
    document.cookie = 'lp_signed_in=1; path=/';
    document.cookie = 'lp_account=Ada; path=/';
    const { container } = render(<SiteHeader ctaSurface="Home" buildWithAi="link" account />);
    const menu = await screen.findByRole(
      'button',
      { name: 'Ada, account menu' },
      { timeout: 10_000 },
    );
    const bar = container.querySelector('header > div > div:last-child')!;
    expect([...bar.querySelectorAll('a')].map((a) => a.getAttribute('aria-label'))).toEqual([
      'Build with AI',
      'Choose Template',
      'Explorer',
    ]);
    expect(screen.getByRole('link', { name: 'Choose Template' }).getAttribute('href')).toBe(
      '/new?via=Home.Header',
    );
    const links = [...bar.querySelectorAll('a')];
    expect(
      links.every((a) => a.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
  });
});
