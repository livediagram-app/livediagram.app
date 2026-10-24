// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteHeader } from './SiteHeader';

// docs/specs/019-marketing/marketing-site.md "Header": signed in, the marketing header ends with liveworkspace.app's
// account menu, read from the api's readable cookies; a visitor's header is unchanged and asks nothing.
const clear = () => {
  for (const name of ['ld_signed_in', 'ld_account']) {
    document.cookie = `${name}=; max-age=0; path=/`;
  }
};
afterEach(() => {
  clear();
  vi.unstubAllGlobals();
});

describe('the site header account menu', () => {
  it('is not there for a visitor, and nothing is fetched', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<SiteHeader ctaSurface="Home" account />);
    expect(screen.queryByRole('button', { name: /account menu/ })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the signed-in person's menu from the cookies, with no request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    document.cookie = 'ld_signed_in=1; path=/';
    document.cookie = 'ld_account=Ada%20Lovelace; path=/';
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
    document.cookie = 'ld_signed_in=1; path=/';
    document.cookie = 'ld_account=Ada; path=/';
    const { container } = render(<SiteHeader ctaSurface="Home" />);
    expect(container.querySelector('[aria-label$="account menu"]')).toBeNull();
  });

  it('keeps the marketing bar for someone signed in: the three links, then the menu at the far right', async () => {
    document.cookie = 'ld_signed_in=1; path=/';
    document.cookie = 'ld_account=Ada; path=/';
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
