// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { avatarColour } from '@liveworkspace/account-menu/initials';
import { announceProfileSaved } from '@liveworkspace/settings-ui/profile-events';
import { configureWorkbench, resetWorkbenchForTests, WORKBENCH_DEFAULTS } from '../../bindings';
import {
  DEFERRED_AUTH_DEFAULT,
  DeferredAuthContext,
  type DeferredAuthState,
} from '../providers/deferred-auth';
import { AuthControls, PILL_NAME_MAX, SignInIcon } from './AuthControls';
import { HEADER_ICON_SLOT_PX } from './header-action';

// The header's account control, one copy for every editor (docs/specs/007-editor/editor-app.md "Header actions"):
// each editor's door test renders it inside its own header; these hold every branch.

type DeferredAuthUser = NonNullable<DeferredAuthState['user']>;

const PICTURE = 'https://lh3.googleusercontent.com/a/own-picture';

afterEach(() => resetWorkbenchForTests());

function renderControls(
  auth: Partial<DeferredAuthState>,
  props: Parameters<typeof AuthControls>[0] = {},
) {
  const state: DeferredAuthState = { ...DEFERRED_AUTH_DEFAULT, authLoaded: true, ...auth };
  return render(
    <DeferredAuthContext.Provider value={state}>
      <AuthControls {...props} />
    </DeferredAuthContext.Provider>,
  );
}

const signedIn = (user: Partial<DeferredAuthUser>, extra: Partial<DeferredAuthState> = {}) => ({
  isSignedIn: true,
  userId: 'user_1',
  user: user as DeferredAuthUser,
  ...extra,
});

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));

describe('AuthControls', () => {
  it('renders nothing until auth has settled', () => {
    const { container } = renderControls({ authLoaded: false });
    expect(container.innerHTML).toBe('');
  });

  it('offers Sign in when signed out, returning to this page', () => {
    window.history.replaceState(null, '', '/document/d1');
    renderControls({ isSignedIn: false });
    const link = screen.getByRole('link', { name: /Sign in/ });
    expect(link.getAttribute('href')).toBe('/sign-in?redirect_url=%2Fdocument%2Fd1');
    expect(link.querySelector('svg')).not.toBeNull();
  });

  it('shows the first name on the pill, the full name and email in the menu', () => {
    renderControls(
      signedIn({ firstName: 'Webber', fullName: 'Webber Takken', email: 'w@example.com' }),
    );
    const trigger = screen.getByRole('button', { name: 'Account menu' });
    expect(trigger.textContent).toContain('Webber');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    openMenu();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Webber Takken')).toBeTruthy();
    expect(screen.getByText('w@example.com')).toBeTruthy();
  });

  it('cuts a long first name, never inside an emoji', () => {
    const long = `${'a'.repeat(PILL_NAME_MAX - 2)}😀xyz`;
    renderControls(signedIn({ firstName: long }));
    const label = screen
      .getByRole('button', { name: 'Account menu' })
      .querySelector('span.truncate');
    expect(label?.textContent).toBe(`${'a'.repeat(PILL_NAME_MAX - 2)}…`);
  });

  it('falls back to the username, then to Account, and skips the name block without a name', () => {
    const { unmount } = renderControls(signedIn({ username: 'webber' }));
    expect(screen.getByRole('button', { name: 'Account menu' }).textContent).toContain('webber');
    unmount();
    renderControls(signedIn({}));
    const trigger = screen.getByRole('button', { name: 'Account menu' });
    expect(trigger.textContent).toContain('Account');
    openMenu();
    expect(document.querySelector('[data-menu-label]')).toBeNull();
  });

  it('leaves the email line out when it is the name shown', () => {
    renderControls(signedIn({ email: 'w@example.com' }));
    openMenu();
    expect(screen.getAllByText('w@example.com')).toHaveLength(1);
  });

  it('opens Settings on Account in place when the host can', () => {
    const onOpenAccount = vi.fn();
    renderControls(signedIn({ firstName: 'Webber' }), { onOpenAccount });
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Account' }));
    expect(onOpenAccount).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it("links to the Explorer's Account settings otherwise", () => {
    renderControls(signedIn({ firstName: 'Webber' }));
    openMenu();
    const item = screen.getByRole('menuitem', { name: 'Account' });
    expect(item.getAttribute('href')).toBe('/explorer?settings=account');
    fireEvent.click(item);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('signs out to the landing page, tracked through the workbench binding', () => {
    const track = vi.fn();
    configureWorkbench({ ...WORKBENCH_DEFAULTS, track });
    const signOut = vi.fn(async () => {});
    renderControls(signedIn({ firstName: 'Webber' }, { signOut }));
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign Out' }));
    expect(track).toHaveBeenCalledWith('Session', 'SignedOut', undefined);
    expect(signOut).toHaveBeenCalledWith({ redirectUrl: '/' });
  });

  it('shows two initials, from the first and last names, as liveworkspace.app does', () => {
    const { unmount } = renderControls(
      signedIn({ firstName: 'Ada', lastName: 'Quinn', fullName: 'Ada Quinn' }),
    );
    const disc = () =>
      screen.getByRole('button', { name: 'Account menu' }).querySelector('[aria-hidden]');
    expect(disc()?.textContent).toBe('AQ');
    unmount();
    renderControls(signedIn({ firstName: 'Webber' }));
    expect(disc()?.textContent).toBe('WE');
  });

  it("draws the session's picture in the header slot", () => {
    renderControls(signedIn({ firstName: 'Webber', picture: PICTURE }));
    const img = screen.getByRole('button', { name: 'Account menu' }).querySelector('img');
    expect(img?.getAttribute('src')).toContain('lh3.googleusercontent.com');
    expect(img?.getAttribute('width')).toBe(String(HEADER_ICON_SLOT_PX));
  });

  it("prefers the editor's own picture, even none", () => {
    const { unmount } = renderControls(signedIn({ firstName: 'Webber' }), { picture: PICTURE });
    expect(
      screen.getByRole('button', { name: 'Account menu' }).querySelector('img'),
    ).not.toBeNull();
    unmount();
    renderControls(signedIn({ firstName: 'Webber', picture: PICTURE }), { picture: null });
    expect(screen.getByRole('button', { name: 'Account menu' }).querySelector('img')).toBeNull();
  });

  it("paints the disc in the account's colour, or Automatic's from the name (Work Tracker 1031)", () => {
    const disc = () =>
      screen
        .getByRole('button', { name: 'Account menu' })
        .querySelector<HTMLElement>('[aria-hidden]');
    const { unmount } = renderControls(
      signedIn({ firstName: 'Ada', fullName: 'Ada Quinn', colour: '#8b5cf6' }),
    );
    // Violet's deep shade, never the brand blue it used to be.
    expect(disc()?.style.backgroundColor).toBe('rgb(109, 40, 217)');
    expect(disc()?.className).not.toContain('bg-brand-700');
    expect(disc()?.className).toContain('text-white');
    unmount();
    renderControls(signedIn({ firstName: 'Ada', fullName: 'Ada Quinn', colour: null }));
    const automatic = document.createElement('div');
    automatic.style.backgroundColor = avatarColour('Ada Quinn').deep;
    expect(disc()?.style.backgroundColor).toBe(automatic.style.backgroundColor);
  });

  it('repaints the disc at once when Settings › Profile saves a colour on this page', () => {
    renderControls(signedIn({ firstName: 'Ada', fullName: 'Ada Quinn', colour: '#8b5cf6' }));
    const disc = () =>
      screen
        .getByRole('button', { name: 'Account menu' })
        .querySelector<HTMLElement>('[aria-hidden]');
    act(() =>
      announceProfileSaved({ patch: { color: '#ef4444' }, name: 'Ada Quinn', color: '#ef4444' }),
    );
    expect(disc()?.style.backgroundColor).toBe('rgb(185, 28, 28)');
  });

  it('closes the menu on a click outside', () => {
    renderControls(signedIn({ firstName: 'Webber' }));
    openMenu();
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('SignInIcon', () => {
  it('draws at 13px unless told otherwise', () => {
    const { container, rerender } = render(<SignInIcon />);
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('13');
    rerender(<SignInIcon size={16} />);
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('16');
  });
});
