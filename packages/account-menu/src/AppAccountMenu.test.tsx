import { act, fireEvent, render, screen } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountMenuKit } from './AccountMenu';
import { AppAccountMenu } from './AppAccountMenu';
import { appAccountOf, appSignOut, resetAppAccount } from './app-account';

// A stand-in for a UI package's menu hooks: open and close only. The real ones (useMenu, useMenuButton) have their
// own suites in each UI package.
const Icon = () => <svg data-testid="icon" />;
const kit: AccountMenuKit = {
  useMenuButton() {
    const [open, setOpen] = useState(false);
    const [trigger, setTrigger] = useState<HTMLElement | null>(null);
    return {
      open,
      close: useCallback(() => setOpen(false), []),
      toggle: useCallback(() => setOpen((o) => !o), []),
      trigger,
      setTrigger,
      initialFocus: 'checked',
      onTriggerKeyDown: () => {},
    };
  },
  useMenu: () => ({ attach: () => {}, surfaceProps: { role: 'menu' } }),
  useClickOutside: () => {},
  icons: { chevron: Icon, tokens: Icon, settings: Icon },
};

const HINT = 'lp_signed_in';

function setCookies(...cookies: string[]) {
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; max-age=0; path=/`;
  }
  for (const cookie of cookies) document.cookie = `${cookie}; path=/`;
}

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  resetAppAccount();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  setCookies();
});
afterEach(() => vi.unstubAllGlobals());

describe('appAccountOf', () => {
  it('reads the hint and the name beside it', () => {
    expect(appAccountOf('', HINT)).toBe('out');
    expect(appAccountOf('lp_signed_in=0; lp_account=Ada', HINT)).toBe('out');
    expect(appAccountOf('lp_signed_in=1; lp_account=Zo%C3%AB', HINT)).toEqual({ name: 'Zoë' });
    expect(appAccountOf('lp_signed_in=1', HINT)).toBe('pending');
    expect(appAccountOf('lp_signed_in=1', HINT, true)).toBe('out');
  });

  it("never reads another app's cookies", () => {
    expect(appAccountOf('ld_signed_in=1; ld_account=Ada', HINT)).toBe('out');
    expect(appAccountOf('lp_signed_in=1; ld_account=Ada', HINT)).toBe('pending');
  });
});

describe('AppAccountMenu', () => {
  it('renders nothing, and asks nothing, for a visitor', () => {
    const { container } = render(<AppAccountMenu hint={HINT} kit={kit} />);
    expect(container.innerHTML).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders nothing in the static HTML, even signed in, so hydration matches', () => {
    setCookies('lp_signed_in=1', 'lp_account=Ada');
    expect(renderToString(<AppAccountMenu hint={HINT} kit={kit} />)).toBe('');
  });

  it("shows the signed-in person's menu from the cookies, with no request", () => {
    setCookies('lp_signed_in=1', 'lp_account=Ada%20Lovelace');
    render(<AppAccountMenu hint={HINT} kit={kit} />);
    const trigger = screen.getByRole('button', { name: 'Ada Lovelace, account menu' });
    expect(trigger.textContent).toContain('AL');
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(trigger);
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual([
      'API tokensConnect tools and AI',
      'SettingsProfile, emails and privacy',
      'Sign out',
    ]);
    // The account pages are liveworkspace.app's, in full.
    expect(items[0]!.getAttribute('href')).toMatch(/\/account\/tokens$/);
    expect(items[0]!.getAttribute('href')).toMatch(/^https?:\/\//);
  });

  it('asks the token once for a session from before the name cookie, then shows the name it set', async () => {
    setCookies('lp_signed_in=1');
    let answer!: () => void;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          answer = () => {
            document.cookie = 'lp_account=Ada; path=/';
            resolve(new Response('{}', { status: 200 }));
          };
        }),
    );
    const { container } = render(
      <>
        <AppAccountMenu hint={HINT} kit={kit} />
        <AppAccountMenu hint={HINT} kit={kit} />
      </>,
    );
    // Holding the avatar's place meanwhile.
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/auth/token');

    await act(async () => answer());
    expect(screen.getAllByRole('button', { name: 'Ada, account menu' })).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('steps aside when the token says the session is gone', async () => {
    setCookies('lp_signed_in=1');
    fetchMock.mockImplementation(async () => {
      document.cookie = 'lp_signed_in=0; path=/';
      return new Response('{"signedIn":false}', { status: 401 });
    });
    const { container } = render(<AppAccountMenu hint={HINT} kit={kit} />);
    await act(async () => {});
    expect(container.innerHTML).toBe('');
  });

  it('steps aside, rather than hold a placeholder forever, when the token request fails', async () => {
    setCookies('lp_signed_in=1');
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const { container } = render(<AppAccountMenu hint={HINT} kit={kit} />);
    await act(async () => {});
    expect(container.innerHTML).toBe('');
  });
});

describe('appSignOut', () => {
  it('signs out of the app and reloads as a visitor', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const reload = vi.fn();
    expect(await appSignOut(reload)).toBe(true);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/auth/sign-out');
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'POST' });
    expect(reload).toHaveBeenCalledOnce();
  });

  it('leaves everything as it was when the API refuses or is unreachable', async () => {
    const reload = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 }));
    expect(await appSignOut(reload)).toBe(false);
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    expect(await appSignOut(reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
