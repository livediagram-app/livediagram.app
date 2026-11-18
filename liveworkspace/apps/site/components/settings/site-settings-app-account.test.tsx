// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { preloadAccountPanels } from '@liveworkspace/settings-ui';
import { settingsStore } from '@/lib/app-settings';
import SiteSettingsDialog from './SiteSettingsDialog';
import { deleteAppAccount, endAppSession, sendAppDeletionCode } from './AppDeleteAccountDialog';

// The Explorer's Settings on an app's own address (liveworkspace/docs/specs/010-site/site.md "Settings", "Your
// Account"; Work Tracker 1228): signed in with the app's token, Your Account signs out of the app as its editor's
// Sign Out does and opens the app's own Delete Account dialog, its confirmation unchanged. Signed out, neither shows.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const app = vi.hoisted(() => ({
  signOut: vi.fn(async (_go?: (to: string) => void) => true),
  account: {
    token: 'app-token',
    expiresAt: Date.now() + 600_000,
    sub: 'user_ada',
    name: 'Ada',
    fullName: 'Ada Lovelace',
    colour: null,
    picture: null,
    email: 'ada@example.com',
  } as Record<string, unknown> | null,
}));

vi.mock('@/lib/explorer/page-app', async (original) => ({
  ...(await original<typeof import('@/lib/explorer/page-app')>()),
  pageApp: () => 'livediagram',
}));
vi.mock('@/lib/explorer/app-session', async (original) => ({
  ...(await original<typeof import('@/lib/explorer/app-session')>()),
  appAccount: async () => app.account,
  appSignOut: (go?: (to: string) => void) => app.signOut(go),
  onAppAccountChange: () => () => {},
}));
// The account API through the app's router, with the app's token: answered by the fetch below.
vi.mock('@/lib/explorer/token', () => ({
  accountFetch: (url: string, init?: RequestInit) => fetch(url, init),
}));
// liveworkspace.app's own session, which the page on an app's address never signs out of here.
const siteSignOut = vi.hoisted(() => vi.fn(async () => true));
vi.mock('@/lib/session', () => ({
  useSession: () => ({ state: 'out' }),
  setSessionColour: () => {},
  signOut: () => siteSignOut(),
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/explorer/telemetry', async (original) => ({
  ...(await original<typeof import('@/lib/explorer/telemetry')>()),
  trackAppEvent: track,
}));

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;
const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

function answer(url: string, init?: RequestInit) {
  if (url.endsWith('/account/deletion-code')) return json(200, { sent: true });
  if (url.endsWith('/api/account') && init?.method === 'DELETE')
    return json(200, { deleted: true });
  if (url.split('?')[0]!.endsWith('/profile')) return json(200, { profile: null });
  return json(200, { all: {}, app: {}, updatedAt: null });
}

beforeAll(async () => {
  await preloadAccountPanels();
}, 60_000);

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(answer);
  vi.stubGlobal('fetch', fetchMock);
  settingsStore.forget();
  app.signOut.mockClear();
  track.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function until(present: () => unknown) {
  await vi.waitFor(
    async () => {
      await act(async () => await new Promise((r) => setTimeout(r, 0)));
      if (!present()) throw new Error('not yet');
    },
    { timeout: 15_000, interval: 10 },
  );
}

const cell = (key: string) => document.querySelector(`[data-settings-cell="${key}"]`);
const buttonIn = (el: Element | null, name: string) =>
  [...(el?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.trim() === name);

async function openSignedIn() {
  act(() =>
    root.render(
      <SiteSettingsDialog
        app="livediagram.app"
        initialCategoryId="account:account"
        onClose={() => {}}
      />,
    ),
  );
  await until(() => cell('deleteAccount'));
}

describe('the Explorer’s Settings on an app’s address, signed in', () => {
  it('offers Sign Out, which signs out of the app as the editor’s does', async () => {
    await openSignedIn();
    // The app's rows, not liveworkspace.app's pointer to where closing lives.
    expect(cell('closeAccount')).toBeNull();
    act(() => buttonIn(cell('signOut'), 'Sign Out')!.click());
    await until(() => app.signOut.mock.calls.length > 0);
    expect(app.signOut).toHaveBeenCalledTimes(1);
  });

  it('offers Delete Account, which opens the app’s own dialog: the typed email, then the emailed code', async () => {
    await openSignedIn();
    // Nothing is asked of the app until the person goes through the dialog.
    const before = fetchMock.mock.calls.length;
    act(() => buttonIn(cell('deleteAccount'), 'Delete Account')!.click());
    const dialog = () =>
      document.querySelector('[role="dialog"][aria-labelledby="delete-account-title"]');
    await until(dialog);
    expect(dialog()!.textContent).toContain('everything you own in every liveworkspace app');
    expect(dialog()!.textContent).toContain('not just livediagram');
    expect(dialog()!.textContent).toContain('Canvases in This Browser stay on this device');
    expect(fetchMock.mock.calls.length).toBe(before);
    // The confirmation is unchanged: the code waits for the account's own address, typed.
    const send = buttonIn(dialog(), 'Email Me a Code')!;
    expect(send.disabled).toBe(true);
    const email = dialog()!.querySelector<HTMLInputElement>('#delete-confirm-email')!;
    act(() => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(email, 'ada@example.com');
      email.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(buttonIn(dialog(), 'Email Me a Code')!.disabled).toBe(false);
    act(() => buttonIn(dialog(), 'Email Me a Code')!.click());
    await until(() => dialog()?.textContent?.includes('We emailed a 6-digit code'));
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe('/api/account/deletion-code');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer app-token');
    // Cancel closes it, deleting nothing.
    act(() => buttonIn(dialog(), 'Cancel')!.click());
    await until(() => !dialog());
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(false);
  });
});

describe('the Explorer’s Settings on an app’s address, as a guest', () => {
  it('shows neither Sign Out nor Delete Account', async () => {
    act(() =>
      root.render(
        <SiteSettingsDialog
          app="livediagram.app"
          guest={{ ownerId: 'guest_abc', signInHref: '/api/auth/sign-in?return_to=%2Fexplorer' }}
          onClose={() => {}}
        />,
      ),
    );
    await until(() => document.querySelector('[data-settings-pane]'));
    expect(cell('signOut')).toBeNull();
    expect(cell('deleteAccount')).toBeNull();
    expect(buttonIn(document.body, 'Delete Account')).toBeUndefined();
  });
});

describe('the app’s own deletion requests', () => {
  it('ask the app’s api on this address with the app’s token, and read its answers', async () => {
    expect(await sendAppDeletionCode()).toBe('sent');
    expect(await deleteAppAccount('123456')).toBe('deleted');
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe('/api/account');
    expect(init?.method).toBe('DELETE');
    expect(init?.body).toBe(JSON.stringify({ code: '123456' }));
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer app-token');
    fetchMock.mockImplementation(() => json(403, { error: 'invalid_code' }));
    expect(await deleteAppAccount('000000')).toBe('invalid_code');
  });

  it('send nothing without the app’s session', async () => {
    const held = app.account;
    app.account = null;
    try {
      expect(await sendAppDeletionCode()).toBe('failed');
      expect(await deleteAppAccount('123456')).toBe('failed');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      app.account = held;
    }
  });

  it('end the app’s session in place once the data is gone, and say so when the app refuses', async () => {
    await endAppSession();
    // No navigation of its own: the dialog's onDeleted goes to the landing page.
    const go = app.signOut.mock.calls[0]![0]!;
    expect(go('/elsewhere')).toBeUndefined();
    app.signOut.mockResolvedValueOnce(false);
    await expect(endAppSession()).rejects.toThrow('did not sign out');
  });
});
