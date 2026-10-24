import { act, fireEvent, render, screen } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountMenu, type AccountMenuKit } from './AccountMenu';
import { AppAccountMenu } from './AppAccountMenu';
import { appAccountOf, appSignOut, resetAppAccount } from './app-account';
import { avatarColour } from './initials';
import { AccountMenuPlaceholder, DeferredAccountMenu, type DeferredMenuProps } from './placeholder';

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
    expect(appAccountOf('lp_signed_in=1; lp_account=Zo%C3%AB', HINT)).toEqual({
      name: 'Zoë',
      fullName: null,
      colour: null,
    });
    expect(
      appAccountOf('lp_signed_in=1; lp_account=Ada; lp_account_full=Ada%20Lovelace', HINT),
    ).toEqual({ name: 'Ada', fullName: 'Ada Lovelace', colour: null });
    expect(appAccountOf('lp_signed_in=1', HINT)).toBe('pending');
    expect(appAccountOf('lp_signed_in=1', HINT, true)).toBe('out');
  });

  it('reads the colour beside the name, and only one that is safe to paint', () => {
    expect(
      appAccountOf('lp_signed_in=1; lp_account=Ada; lp_account_colour=%230ea5e9', HINT),
    ).toEqual({ name: 'Ada', fullName: null, colour: '#0ea5e9' });
    for (const bad of ['url(x)', 'red%3Bcolor%3Ablue', '%22x%22', `%23${'0'.repeat(80)}`]) {
      expect(
        appAccountOf(`lp_signed_in=1; lp_account=Ada; lp_account_colour=${bad}`, HINT),
      ).toEqual({ name: 'Ada', fullName: null, colour: null });
    }
  });

  it("never reads another app's cookies", () => {
    expect(appAccountOf('ld_signed_in=1; ld_account=Ada', HINT)).toBe('out');
    expect(appAccountOf('lp_signed_in=1; ld_account=Ada', HINT)).toBe('pending');
  });
});

describe('AppAccountMenu', () => {
  it('shows a visitor the Guest menu, asking nothing, its links the app’s own back to this page', () => {
    window.history.replaceState(null, '', '/pricing?x=1');
    render(<AppAccountMenu hint={HINT} kit={kit} />);
    const trigger = screen.getByRole('button', { name: 'Guest, account menu' });
    expect(trigger.textContent).toContain('Guest');
    expect(trigger.querySelector('[data-guest-avatar]')).not.toBeNull();
    fireEvent.click(trigger);
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual([
      'Sign in',
      'Create accountFree, and one account for every app',
    ]);
    expect(items[0]!.getAttribute('href')).toBe('/api/auth/sign-in?return_to=%2Fpricing%3Fx%3D1');
    expect(items[1]!.getAttribute('href')).toBe(
      '/api/auth/sign-in?return_to=%2Fpricing%3Fx%3D1&screen=sign-up',
    );
    expect(fetchMock).not.toHaveBeenCalled();
    window.history.replaceState(null, '', '/');
  });

  it('holds the avatar’s place in the static HTML, signed in or not, so hydration matches', () => {
    const placeholder = renderToString(<AccountMenuPlaceholder />);
    expect(renderToString(<AppAccountMenu hint={HINT} kit={kit} />)).toBe(placeholder);
    setCookies('lp_signed_in=1', 'lp_account=Ada');
    expect(renderToString(<AppAccountMenu hint={HINT} kit={kit} />)).toBe(placeholder);
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

  it('paints the avatar in the colour cookie, and in the name-picked colour without one, with no request', () => {
    setCookies('lp_signed_in=1', 'lp_account=Ada', 'lp_account_colour=%23ef4444');
    const { container, unmount } = render(<AppAccountMenu hint={HINT} kit={kit} />);
    const avatar = () =>
      (container.querySelector('button > span[aria-hidden]') as HTMLElement).style.getPropertyValue(
        '--avatar',
      );
    expect(avatar()).toBe('#b91c1c'); // Red's deep shade
    unmount();
    resetAppAccount();
    setCookies('lp_signed_in=1', 'lp_account=Ada');
    const again = render(<AppAccountMenu hint={HINT} kit={kit} />);
    expect(
      (
        again.container.querySelector('button > span[aria-hidden]') as HTMLElement
      ).style.getPropertyValue('--avatar'),
    ).toBe(avatarColour('Ada').deep);
    expect(fetchMock).not.toHaveBeenCalled();
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

  it('turns to Guest when the token says the session is gone', async () => {
    setCookies('lp_signed_in=1');
    fetchMock.mockImplementation(async () => {
      document.cookie = 'lp_signed_in=0; path=/';
      return new Response('{"signedIn":false}', { status: 401 });
    });
    render(<AppAccountMenu hint={HINT} kit={kit} />);
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Guest, account menu' })).toBeTruthy();
  });

  it('turns to Guest, rather than hold a placeholder forever, when the token request fails', async () => {
    setCookies('lp_signed_in=1');
    fetchMock.mockRejectedValue(new TypeError('offline'));
    render(<AppAccountMenu hint={HINT} kit={kit} />);
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Guest, account menu' })).toBeTruthy();
  });

  it('opens at once, and takes focus, when it arrives in place of the stand-in after a press', () => {
    render(<AppAccountMenu hint={HINT} kit={kit} openOnMount />);
    const trigger = screen.getByRole('button', { name: 'Guest, account menu' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(trigger);
  });
});

describe('AccountMenu as Guest', () => {
  it('offers Settings where the surface has them: preparing on approach, and opening it as the menu closes', () => {
    const onOpenSettings = vi.fn();
    const onPrepareSettings = vi.fn();
    render(
      <AccountMenu
        kit={kit}
        guest={{
          signInHref: '/sign-in',
          signUpHref: '/sign-up',
          onOpenSettings,
          onPrepareSettings,
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Guest, account menu' }));
    const settings = screen.getAllByRole('menuitem')[2]!;
    expect(settings.textContent).toBe('SettingsKept in this browser');
    fireEvent.pointerEnter(settings);
    expect(onPrepareSettings).toHaveBeenCalled();
    fireEvent.click(settings);
    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
  });

  it('draws no person’s colour or initials', () => {
    render(<AccountMenu kit={kit} guest={{ signInHref: '/a', signUpHref: '/b' }} />);
    const trigger = screen.getByRole('button', { name: 'Guest, account menu' });
    expect(trigger.querySelector('[style]')).toBeNull();
    expect(trigger.textContent).toBe('Guest');
  });
});

describe('DeferredAccountMenu (a marketing page’s Guest button)', () => {
  function Menu({ openOnMount, focusOnMount }: DeferredMenuProps) {
    return (
      <AccountMenu
        kit={kit}
        guest={{ signInHref: '/a', signUpHref: '/b' }}
        openOnMount={openOnMount}
        focusOnMount={focusOnMount}
      />
    );
  }

  it('costs nothing until approached: no request, and the menu’s code only on pointer or focus', async () => {
    const load = vi.fn(() => Promise.resolve({ default: Menu }));
    render(<DeferredAccountMenu load={load} />);
    const standIn = screen.getByRole('button', { name: 'Guest, account menu' });
    expect(load).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.pointerEnter(standIn);
    });
    expect(load).toHaveBeenCalledOnce();
    // The menu takes the stand-in's place, closed.
    const trigger = screen.getByRole('button', { name: 'Guest, account menu' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('opens the menu once it arrives after a press made before', async () => {
    let arrive!: () => void;
    const load = vi.fn(
      () =>
        new Promise<{ default: typeof Menu }>((resolve) => {
          arrive = () => resolve({ default: Menu });
        }),
    );
    render(<DeferredAccountMenu load={load} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guest, account menu' }));
    await act(async () => arrive());
    expect(load).toHaveBeenCalledOnce();
    expect(screen.getAllByRole('menuitem')[0]!.textContent).toBe('Sign in');
  });

  it('asks again on the next approach when the code could not be fetched', async () => {
    const load = vi
      .fn<() => Promise<{ default: typeof Menu }>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ default: Menu });
    render(<DeferredAccountMenu load={load} />);
    const standIn = screen.getByRole('button', { name: 'Guest, account menu' });
    await act(async () => {
      fireEvent.pointerEnter(standIn);
    });
    await act(async () => {
      fireEvent.pointerEnter(standIn);
    });
    expect(load).toHaveBeenCalledTimes(2);
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
