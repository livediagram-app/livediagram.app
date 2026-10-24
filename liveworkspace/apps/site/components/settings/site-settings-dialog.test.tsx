// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settingsStore, type AppId } from '@/lib/app-settings';
import SiteSettingsDialog from './SiteSettingsDialog';

// The Settings panel on liveworkspace.app (liveworkspace/docs/site.md "Settings"): the shared panel
// (@liveworkspace/settings-ui) over the site, filtered to an app or showing All, each change saved a key at a time
// to its scope, put back when a save fails; opened on what it is asked for, the API tokens drawn in place.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const sent = (n: number): unknown => JSON.parse(fetchMock.mock.calls[n]![1]?.body as string);

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
  it("is a modal dialog with the app's switch, reading only that app", async () => {
    fetchMock.mockReturnValue(json(200, { all: {}, app: {}, updatedAt: null }));
    await open('liveplanner.app');
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Settings');
    expect(scopeButton('liveplanner').getAttribute('aria-pressed')).toBe('true');
    expect(dialog.textContent).toContain('More in liveplanner Settings');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/account/settings/liveplanner.app');
  });

  it('saves a change as a patch of just that key, in that app’s scope, and puts it back if refused', async () => {
    fetchMock.mockReturnValueOnce(json(200, { all: {}, app: {} }));
    await open('livediagram.app');
    act(() => railButton('Notifications')!.click());
    expect(switchFor('notifyDocumentJoin').getAttribute('aria-checked')).toBe('true');
    fetchMock.mockReturnValueOnce(json(200, { all: {}, app: { notifyDocumentJoin: false } }));
    act(() => switchFor('notifyDocumentJoin').click());
    await settle();
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe('/api/account/settings/livediagram.app');
    expect(init?.method).toBe('PATCH');
    expect(sent(1)).toEqual({ app: { notifyDocumentJoin: false } });

    fetchMock.mockReturnValueOnce(json(500, { error: 'failed' }));
    act(() => switchFor('notifyDocumentJoin').click());
    expect(switchFor('notifyDocumentJoin').getAttribute('aria-checked')).toBe('true');
    await settle();
    expect(switchFor('notifyDocumentJoin').getAttribute('aria-checked')).toBe('false');
    expect(document.querySelector('[role="alert"]')?.textContent).toMatch(/went wrong/);
  });

  it('saves a common setting to the `all` scope, as the app held it until then', async () => {
    // Off in livediagram's own scope, from before the setting was shared.
    fetchMock.mockReturnValueOnce(json(200, { all: {}, app: { alignmentGuides: false } }));
    await open('livediagram.app');
    act(() => railButton('Editor')!.click());
    expect(switchFor('alignmentGuides').getAttribute('aria-checked')).toBe('false');
    expect(document.querySelector('#alignmentGuides-description')?.textContent).toContain(
      'All apps',
    );
    fetchMock.mockReturnValueOnce(json(200, { all: { alignmentGuides: true } }));
    act(() => switchFor('alignmentGuides').click());
    await settle();
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe('/api/account/settings');
    expect(init?.method).toBe('PATCH');
    expect(sent(1)).toEqual({ all: { alignmentGuides: true } });
    expect(switchFor('alignmentGuides').getAttribute('aria-checked')).toBe('true');
  });

  it('closes on Escape, and reopens from the page’s copy', async () => {
    fetchMock.mockReturnValue(json(200, { all: {}, app: {} }));
    const onClose = await open('liveplanner.app');
    const dialog = document.querySelector('[role="dialog"]')!;
    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => root.render(<div />));
    await open('liveplanner.app');
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
    expect(headings).toEqual([
      'Account',
      'Common',
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
    ]);
    // The four apps' scopes, then the profile (the first category, shown).
    const paths = fetchMock.mock.calls.map(([url]) => url);
    expect(paths).toContain('/api/account/profile');
    expect(paths.filter((p) => p.startsWith('/api/account/settings/'))).toHaveLength(4);
    expect(document.querySelector('[data-settings-pane]')?.textContent).toContain(
      'Presence colour',
    );
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
    expect(railButton('Profile')).toBeUndefined();
    act(() => railButton('Editor')!.click());
    expect(switchFor('alignmentGuides').getAttribute('aria-checked')).toBe('false');
    const footer = document.querySelector('[role="dialog"] footer')!;
    expect(footer.textContent).toContain('Saved in this browser');
    expect(footer.textContent).not.toContain('More in livediagram Settings');
    expect(footer.querySelector('[data-settings-sign-in]')?.getAttribute('href')).toBe(
      '/api/auth/sign-in?return_to=%2Fexplorer',
    );
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
});
