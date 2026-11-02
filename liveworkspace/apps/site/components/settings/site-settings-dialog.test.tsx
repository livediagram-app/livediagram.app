// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settingsStore, type AppId } from '@/lib/app-settings';
import SiteSettingsDialog from './SiteSettingsDialog';

// The Settings panel on liveworkspace.app (liveworkspace/docs/specs/010-site/site.md "Settings"): the shared panel
// (@liveworkspace/settings-ui) over the site, filtered to an app or showing All, each change saved a key at a time
// to its scope, put back when a save fails; opened on what it is asked for, the API tokens drawn in place.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Who is signed in, as the page's header already asked (lib/session.ts): the Profile's header card reads it.
const signOut = vi.fn(async () => true);
vi.mock('@/lib/session', () => ({
  useSession: () => ({
    state: 'in',
    name: 'Ada',
    fullName: 'Ada Lovelace',
    colour: '#8b5cf6',
    email: 'ada@example.com',
    joined: '2026-10-23T15:13:54.270Z',
  }),
  setSessionColour: () => {},
  signOut: () => signOut(),
}));

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
  vi.stubGlobal('fetch', fetchMock);
  settingsStore.forget();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
  localStorage.clear();
});

async function settle() {
  for (let i = 0; i < 8; i++) await act(async () => await new Promise((r) => setTimeout(r, 0)));
}

// The panel's catalogue view (and the tokens panel) load lazily, and a cold import under a busy machine takes more
// than a few ticks: wait until what a test reads is on the page, not for a fixed number of ticks.
async function until(present: () => unknown) {
  await vi.waitFor(
    async () => {
      await act(async () => await new Promise((r) => setTimeout(r, 0)));
      if (!present()) throw new Error('not yet');
    },
    { timeout: 5000, interval: 10 },
  );
  await settle();
}

const switchFor = (rowKey: string) =>
  document.querySelector<HTMLButtonElement>(`[role="switch"][aria-labelledby="${rowKey}-label"]`)!;

const railButton = (label: string, within: ParentNode = document) =>
  [
    ...within.querySelectorAll<HTMLButtonElement>(
      'nav[aria-label="Settings categories"] button, [role="group"] button',
    ),
  ].find((b) => b.textContent?.trim() === label);

const scopeButton = (name: string) =>
  [
    ...document.querySelectorAll<HTMLButtonElement>(
      '[role="group"][aria-label="Show settings for"] button',
    ),
  ].find((b) => b.textContent?.trim() === name)!;

async function open(
  app: AppId | null,
  extra: { initialCategoryId?: string; initialScope?: 'app' | 'all' } = {},
) {
  const onClose = vi.fn();
  act(() => root.render(<SiteSettingsDialog app={app} onClose={onClose} {...extra} />));
  await until(() => document.querySelector('nav[aria-label="Settings categories"]'));
  return onClose;
}

describe('the Settings panel, filtered to an app', () => {
  // Every read answered by its path; `apps` sets an app's own scope, `patch` answers a write.
  function answers(
    apps: Partial<Record<AppId, Record<string, unknown>>> = {},
    patch: (url: string, init?: RequestInit) => Promise<Response> | null = () => null,
  ) {
    return (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') return patch(url, init) ?? json(200, { all: {}, app: {} });
      if (url.endsWith('/profile')) return json(200, { profile: null });
      const app = url.split('/settings/')[1] as AppId | undefined;
      return json(200, { all: {}, app: (app && apps[app]) ?? {}, updatedAt: null });
    };
  }
  const headings = () =>
    [...document.querySelectorAll('nav[aria-label="Settings categories"] [role="group"] > p')].map(
      (p) => p.textContent,
    );
  const reads = () => fetchMock.mock.calls.filter(([, init]) => init?.method !== 'PATCH').length;

  it("is a modal dialog with the app's switch: the Account section, Common and that app, no other app", async () => {
    fetchMock.mockImplementation(answers());
    await open('liveplanner.app');
    await until(() => headings().includes('liveplanner'));
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Settings');
    expect(scopeButton('liveplanner').getAttribute('aria-pressed')).toBe('true');
    // The footer only says how settings save: it has no link into the app's own Settings.
    expect(dialog.textContent).not.toContain('More in liveplanner Settings');
    // Account and Common shape this app too; the other apps' own groups stay under All.
    expect(headings()).toEqual(['Account', 'Common', 'liveplanner']);
    const paths = fetchMock.mock.calls.map(([url]) => url);
    expect(paths).toContain('/api/account/settings/liveplanner.app');
  });

  it('saves a change as a patch of just that key, in that app’s scope, and puts it back if refused', async () => {
    let refuse = false;
    fetchMock.mockImplementation(
      answers({}, () =>
        refuse
          ? json(500, { error: 'failed' })
          : json(200, { all: {}, app: { notifyDocumentJoin: false } }),
      ),
    );
    await open('livediagram.app', { initialCategoryId: 'account:notifications' });
    // The app's own email switch, filed under the Account section's Notifications with the app's name.
    const key = 'livediagram.app:notifyDocumentJoin';
    await until(() => switchFor(key));
    expect(switchFor(key).getAttribute('aria-checked')).toBe('true');
    act(() => switchFor(key).click());
    await settle();
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe('/api/account/settings/livediagram.app');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(init?.body as string)).toEqual({ app: { notifyDocumentJoin: false } });

    refuse = true;
    act(() => switchFor(key).click());
    expect(switchFor(key).getAttribute('aria-checked')).toBe('true');
    await settle();
    expect(switchFor(key).getAttribute('aria-checked')).toBe('false');
    expect(document.querySelector('[role="alert"]')?.textContent).toMatch(/went wrong/);
  });

  it('saves a common setting to the `all` scope, as the app held it until then', async () => {
    // Off in livediagram's own scope, from before the setting was shared.
    fetchMock.mockImplementation(
      answers({ 'livediagram.app': { alignmentGuides: false } }, () =>
        json(200, { all: { alignmentGuides: true } }),
      ),
    );
    await open('livediagram.app');
    await until(() => headings().includes('Common'));
    await until(() => {
      const button = railButton('Editor');
      if (button) act(() => button.click());
      return switchFor('common:alignmentGuides');
    });
    expect(switchFor('common:alignmentGuides').getAttribute('aria-checked')).toBe('false');
    act(() => switchFor('common:alignmentGuides').click());
    await settle();
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe('/api/account/settings');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(init?.body as string)).toEqual({ all: { alignmentGuides: true } });
    expect(switchFor('common:alignmentGuides').getAttribute('aria-checked')).toBe('true');
  });

  it('closes on Escape, and reopens from the page’s copy', async () => {
    fetchMock.mockImplementation(answers());
    const onClose = await open('liveplanner.app');
    await until(() => headings().includes('liveplanner'));
    const first = reads();
    const dialog = document.querySelector('[role="dialog"]')!;
    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => root.render(<div />));
    await open('liveplanner.app');
    await until(() => headings().includes('liveplanner'));
    // The settings come from the page's copy; the Profile (who, how they sign in, where) is drawn fresh.
    const again = fetchMock.mock.calls
      .slice(first)
      .filter(([u, init]) => init?.method !== 'PATCH' && u.startsWith('/api/account/settings'));
    expect(again).toHaveLength(0);
  });
});

describe('the Settings panel, on All', () => {
  function answer(url: string, init?: RequestInit) {
    if (url.endsWith('/profile')) return json(200, { profile: null });
    if (url.endsWith('/settings') && init?.method === 'PATCH') {
      return json(200, { all: { notifyTips: false }, updatedAt: null });
    }
    return json(200, { all: {}, app: {}, updatedAt: null });
  }

  it('shows the Account section and every app, from no app, with no switch', async () => {
    fetchMock.mockImplementation(answer);
    await open(null);
    expect(document.querySelector('[aria-label="Show settings for"]')).toBeNull();
    const headings = [
      ...document.querySelectorAll('nav[aria-label="Settings categories"] [role="group"] > p'),
    ].map((p) => p.textContent);
    // Account is the one heading: every other category is one set, merged across Common and the apps.
    expect(headings).toEqual(['Account']);
    const apps = document.querySelector<HTMLElement>(
      'nav[aria-label="Settings categories"] [role="group"][aria-label="Apps"]',
    )!;
    const top = [...apps.children].map((c) =>
      (c.matches('button') ? c : c.querySelector('button'))?.textContent?.trim(),
    );
    expect(top.filter((label) => label === 'Editor')).toHaveLength(1);
    expect(top, top.join(', ')).toContain('Tours');
    // The four apps' scopes, then the profile (the first category, shown).
    const paths = fetchMock.mock.calls.map(([url]) => url);
    expect(paths).toContain('/api/account/profile');
    expect(paths.filter((p) => p.startsWith('/api/account/settings/'))).toHaveLength(4);
    expect(document.querySelector('[data-settings-pane]')?.textContent).toContain(
      'Presence colour',
    );
  });

  it("opens a merged category, each app's own rows under its name, written to its own scope", async () => {
    fetchMock.mockImplementation(answer);
    await open(null);
    act(() => railButton('Tours')!.click());
    await settle();
    const pane = document.querySelector<HTMLElement>('[data-settings-pane]')!;
    const blocks = [...pane.querySelectorAll('[data-settings-app]')];
    expect(blocks.map((b) => b.getAttribute('data-settings-app'))).toEqual([
      'livediagram.app',
      'liveplanner.app',
    ]);
    expect(blocks[0]!.querySelector('[data-settings-app-heading]')?.textContent).toBe(
      'livediagram',
    );
    const row = blocks[1]!.querySelector<HTMLButtonElement>('[role="switch"]')!;
    act(() => row.click());
    await settle();
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')!;
    expect(patch[0]).toBe('/api/account/settings/liveplanner.app');
  });

  it('opens on an Account category, and writes its switch to the `all` scope', async () => {
    fetchMock.mockImplementation(answer);
    await open('livediagram.app', {
      initialCategoryId: 'account:notifications',
      initialScope: 'all',
    });
    expect(scopeButton('All').getAttribute('aria-pressed')).toBe('true');
    act(() => switchFor('account:notifyTips').click());
    await settle();
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')!;
    expect(patch[0]).toBe('/api/account/settings');
    expect(JSON.parse(patch[1]!.body as string)).toEqual({ all: { notifyTips: false } });
  });

  it('opens Profile on who is signed in, where they are signed in, and signs out of another browser', async () => {
    fetchMock.mockImplementation((url, init) => {
      if (url.endsWith('/list-sessions')) {
        return json(200, [
          {
            id: 's1',
            token: 't1',
            userAgent: 'Mozilla/5.0 (Macintosh) Chrome/156.0',
            createdAt: '2026-10-20T10:00:00Z',
            updatedAt: '2026-10-25T10:00:00Z',
          },
          {
            id: 's2',
            token: 't2',
            userAgent: 'Mozilla/5.0 (iPhone) Version/19.0 Mobile Safari/604.1',
            createdAt: '2026-10-20T10:00:00Z',
            updatedAt: '2026-10-24T10:00:00Z',
          },
        ]);
      }
      if (url.endsWith('/get-session')) return json(200, { session: { id: 's1' } });
      if (url.endsWith('/list-accounts')) return json(200, []);
      if (url.endsWith('/sign-in-options')) return json(200, { google: true });
      if (url.endsWith('/revoke-session')) return json(200, { status: true });
      return answer(url, init);
    });
    await open(null, { initialCategoryId: 'account:account' });
    const pane = () => document.querySelector('[data-settings-pane]')!;
    await until(() => pane().textContent?.includes('Safari on iOS'));
    expect(pane().querySelector('[data-profile-header] h3')?.textContent).toBe('Ada Lovelace');
    expect(pane().textContent).toContain('ada@example.com');
    expect(pane().textContent).toContain('Colour: Violet');
    expect(pane().textContent).toContain('Email Code');
    act(() =>
      pane()
        .querySelector<HTMLButtonElement>('button[aria-label="Sign out of Safari on iOS"]')!
        .click(),
    );
    await settle();
    const revoke = fetchMock.mock.calls.find(([url]) => url.endsWith('/revoke-session'))!;
    expect(JSON.parse(revoke[1]!.body as string)).toEqual({ token: 't2' });
    const signOutButton = [...pane().querySelectorAll('button')].find(
      (b) => b.textContent === 'Sign Out' && !b.getAttribute('aria-label'),
    )!;
    act(() => signOutButton.click());
    await settle();
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('the Settings panel, for a guest on an app’s address', () => {
  const KEY = 'livediagram:user-preferences:v1';
  const MARK = 'livediagram:user-preferences:unsynced';

  async function openAsGuest() {
    const onClose = vi.fn();
    act(() =>
      root.render(
        <SiteSettingsDialog
          app="livediagram.app"
          guest={{ ownerId: 'guest_abc', signInHref: '/api/auth/sign-in?return_to=%2Fexplorer' }}
          onClose={onClose}
        />,
      ),
    );
    await until(() => document.querySelector('nav[aria-label="Settings categories"]'));
  }

  it('shows the app’s settings alone, as the editor keeps them in this browser, asking nothing', async () => {
    localStorage.setItem(KEY, JSON.stringify({ alignmentGuides: false, telemetryEnabled: false }));
    await openAsGuest();
    expect(document.querySelector('[aria-label="Show settings for"]')).toBeNull();
    // The guest's Profile comes first: the guest card and the way in, not empty rows.
    expect(railButton('Profile')).toBeDefined();
    const pane = document.querySelector('[data-settings-pane]')!;
    expect(pane.textContent).toContain('Guest');
    expect(pane.querySelector('a[data-settings-sign-in]')?.getAttribute('href')).toBe(
      '/api/auth/sign-in?return_to=%2Fexplorer',
    );
    act(() => railButton('Editor')!.click());
    expect(switchFor('alignmentGuides').getAttribute('aria-checked')).toBe('false');
    const footer = document.querySelector('[role="dialog"] [data-settings-footer]')!;
    expect(footer.textContent).toContain('Saved in this browser');
    expect(footer.textContent).not.toContain('More in livediagram Settings');
    expect(footer.querySelector('[data-settings-sign-in]')?.getAttribute('href')).toBe(
      '/api/auth/sign-in?return_to=%2Fexplorer',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('has no API Tokens or Webhooks, even asked for them: they are signed in only', async () => {
    act(() =>
      root.render(
        <SiteSettingsDialog
          app="livediagram.app"
          guest={{ ownerId: 'guest_abc', signInHref: '/api/auth/sign-in?return_to=%2Fexplorer' }}
          initialCategoryId="account:webhooks"
          onClose={() => {}}
        />,
      ),
    );
    await until(() => document.querySelector('nav[aria-label="Settings categories"]'));
    expect(document.querySelector('[data-settings-cell="webhooks"]')).toBeNull();
    expect(document.querySelector('[data-settings-cell="tokens"]')).toBeNull();
    expect(railButton('Webhooks')).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('writes a change into the editor’s copy, keeping its other keys, and marks it for the editor to send', async () => {
    localStorage.setItem(KEY, JSON.stringify({ telemetryEnabled: false }));
    await openAsGuest();
    act(() => railButton('Editor')!.click());
    act(() => switchFor('alignmentGuides').click());
    await settle();
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({
      telemetryEnabled: false,
      alignmentGuides: false,
    });
    expect(localStorage.getItem(MARK)).toBe('guest_abc');
    expect(switchFor('alignmentGuides').getAttribute('aria-checked')).toBe('false');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('the Settings panel, opened on a section', () => {
  it('opens on the app it is asked for, its side of the switch chosen', async () => {
    fetchMock.mockReturnValue(json(200, { all: {}, app: {}, updatedAt: null }));
    await open('livedesign.app', { initialScope: 'app' });
    expect(scopeButton('livedesign').getAttribute('aria-pressed')).toBe('true');
  });

  it('draws the API tokens in place, their code and list fetched only when their category shows', async () => {
    fetchMock.mockImplementation((url: string) =>
      url === '/api/account/tokens'
        ? json(200, { tokens: [] })
        : json(200, { all: {}, app: {}, updatedAt: null }),
    );
    await open(null, { initialScope: 'all', initialCategoryId: 'account:tokens' });
    await until(() =>
      document
        .querySelector('[data-settings-cell="tokens"]')
        ?.textContent?.includes('No tokens yet'),
    );
    const cell = document.querySelector('[data-settings-cell="tokens"]')!;
    expect(cell.textContent).toContain('Make a token');
    expect(cell.textContent).toContain('No tokens yet');
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/account/tokens')).toHaveLength(1);
  });

  it('draws the webhooks in place for a signed-in person, their code and list fetched only when their category shows', async () => {
    fetchMock.mockImplementation((url: string) =>
      url === '/api/index/webhooks'
        ? json(200, { webhooks: [] })
        : url === '/api/account/teams'
          ? json(200, { teams: [] })
          : json(200, { all: {}, app: {}, updatedAt: null }),
    );
    await open(null, { initialScope: 'all' });
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/index/webhooks')).toBe(false);
    act(() => root.unmount());
    root = createRoot(container);
    await open(null, { initialScope: 'all', initialCategoryId: 'account:webhooks' });
    await until(() =>
      document
        .querySelector('[data-settings-cell="webhooks"]')
        ?.textContent?.includes('No Webhooks Yet'),
    );
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/index/webhooks')).toHaveLength(1);
  });
});
