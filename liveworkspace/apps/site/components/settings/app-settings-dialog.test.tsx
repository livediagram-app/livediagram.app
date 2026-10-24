// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppCatalogue } from '@liveworkspace/settings/catalogue';
import { CATALOGUE as LIVEDIAGRAM } from '@liveworkspace/settings/catalogues/livediagram';
import { CATALOGUE as LIVEPLANNER } from '@liveworkspace/settings/catalogues/liveplanner';
import { CATALOGUE as LIVEDOCUMENTS } from '@liveworkspace/settings/catalogues/livedocuments';
import { CATALOGUE as LIVEDESIGN } from '@liveworkspace/settings/catalogues/livedesign';
import { __forgetAppScopes, type AppId, type AppScopes } from '@/lib/app-settings';
import { appSettingsModel } from '@/lib/app-settings-model';
import { listedApps, type ListedApp } from '@/lib/apps';
import AppSettingsDialog, { AppSettingsBody } from './AppSettingsDialog';
import { SettingsPanel } from './SettingsPanel';

// The app settings dialog (liveworkspace/docs/site.md "Your account"): each app's own settings, in
// the same Settings view the app shows (@liveworkspace/settings-ui), saved a key at a time to that
// app's scope, put back when a save fails, and usable from the keyboard.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CATALOGUES: Record<AppId, AppCatalogue> = {
  'livediagram.app': LIVEDIAGRAM,
  'liveplanner.app': LIVEPLANNER,
  'livedocuments.app': LIVEDOCUMENTS,
  'livedesign.app': LIVEDESIGN,
};

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
  __forgetAppScopes();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
  localStorage.clear();
});

// The body of the nth request, as sent.
const sent = (n: number): unknown => JSON.parse(fetchMock.mock.calls[n]![1]?.body as string);

async function settle() {
  for (let i = 0; i < 5; i++) await act(async () => await new Promise((r) => setTimeout(r, 0)));
}

function renderBody(app: AppId, value: AppScopes = { all: {}, app: {} }) {
  const onValue = vi.fn();
  function Host() {
    return (
      <AppSettingsBody app={app} catalogue={CATALOGUES[app]} value={value} onValue={onValue} />
    );
  }
  act(() => root.render(<Host />));
  return onValue;
}

// A body that holds its own value, as the dialog does.
function renderLiveBody(app: AppId, initial: AppScopes = { all: {}, app: {} }) {
  let value = initial;
  const draw = () =>
    act(() =>
      root.render(
        <AppSettingsBody
          app={app}
          catalogue={CATALOGUES[app]}
          value={value}
          onValue={(next) => {
            value = next;
            draw();
          }}
        />,
      ),
    );
  draw();
}

// A row's switch, by the app's row key (the shared view names it by the row's label element).
const switchFor = (rowKey: string) =>
  document.querySelector<HTMLButtonElement>(`[role="switch"][aria-labelledby="${rowKey}-label"]`)!;

// The rail's button for a category, by its label.
const railButton = (label: string) =>
  [
    ...document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Settings categories"] button'),
  ].find((b) => b.textContent?.trim() === label);

// Opens a category in the rail, its parent's first when it is a sub-category.
function openCategory(app: AppId, id: string, value: AppScopes = { all: {}, app: {} }) {
  const categories = appSettingsModel(CATALOGUES[app], value, () => {});
  const category = categories.find((c) => c.id === id)!;
  const parent = categories.find((c) => c.id === category.parent);
  if (parent && !railButton(category.label)) act(() => railButton(parent.label)!.click());
  act(() => railButton(category.label)!.click());
}

describe('AppSettingsBody', () => {
  it.each(Object.keys(CATALOGUES) as AppId[])(
    "shows %s's own categories and rows, in its order, in the app's Settings view",
    (app) => {
      renderBody(app);
      const value = { all: {}, app: {} };
      const categories = appSettingsModel(CATALOGUES[app], value, () => {});
      expect(categories.length).toBeGreaterThan(0);
      // The rail lists the top-level categories, each with its tile.
      const top = categories.filter((c) => !c.parent);
      for (const category of top) expect(railButton(category.label)).toBeTruthy();
      expect(top.every((c) => Boolean(c.icon))).toBe(true);
      for (const category of categories) {
        openCategory(app, category.id, value);
        const pane = document.querySelector('[data-settings-pane]')!;
        for (const row of category.rows) {
          expect(pane.textContent).toContain(row.label);
          expect(pane.textContent).toContain(row.description);
        }
      }
    },
  );

  it('hides a nested row while its switch is off, as the app does', () => {
    const value = { all: {}, app: { showMinimap: false } };
    renderBody('livediagram.app', value);
    const map = appSettingsModel(CATALOGUES['livediagram.app'], value, () => {}).find((c) =>
      c.rows.some((r) => r.label === 'Enable Map'),
    )!;
    openCategory('livediagram.app', map.id, value);
    const pane = document.querySelector('[data-settings-pane]')!;
    expect(pane.textContent).toContain('Enable Map');
    expect(pane.textContent).not.toContain('Map Size');
  });

  it('saves a change as a patch of just that key, in that app’s scope', async () => {
    fetchMock.mockReturnValue(json(200, { all: {}, app: { alignmentGuides: false } }));
    renderLiveBody('livediagram.app');
    openCategory('livediagram.app', 'editor');
    const guides = switchFor('alignmentGuides');
    expect(guides.getAttribute('aria-checked')).toBe('true');
    act(() => guides.click());
    expect(switchFor('alignmentGuides').getAttribute('aria-checked')).toBe('false');
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/account/settings/livediagram.app');
    expect(init?.method).toBe('PATCH');
    expect(sent(0)).toEqual({ app: { alignmentGuides: false } });
  });

  it("writes one field of an object setting, keeping the object's others", async () => {
    fetchMock.mockReturnValue(json(200, { all: {}, app: {} }));
    const value = { all: {}, app: { presentation: { speed: 'slow' } } };
    renderLiveBody('livediagram.app', value);
    openCategory('livediagram.app', 'presenting', value);
    act(() => switchFor('presentation-loop').click());
    await settle();
    expect(sent(0)).toEqual({
      app: { presentation: { speed: 'slow', loop: true } },
    });
  });

  it('puts a switch back, and says so, when the save fails', async () => {
    fetchMock.mockReturnValue(json(500, { error: 'failed' }));
    renderLiveBody('livediagram.app');
    openCategory('livediagram.app', 'editor');
    act(() => switchFor('alignmentGuides').click());
    expect(switchFor('alignmentGuides').getAttribute('aria-checked')).toBe('false');
    await settle();
    expect(switchFor('alignmentGuides').getAttribute('aria-checked')).toBe('true');
    expect(document.querySelector('[role="alert"]')?.textContent).toMatch(/went wrong/);
  });

  it('saves the option picked in a choice', async () => {
    fetchMock.mockReturnValue(json(200, { all: {}, app: {} }));
    renderLiveBody('livediagram.app');
    openCategory('livediagram.app', 'editor');
    const group = [...document.querySelectorAll('[role="radiogroup"]')].find((g) =>
      g.textContent?.includes('Footer'),
    )!;
    const radios = [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    act(() => radios[1]!.click());
    await settle();
    expect(sent(0)).toEqual({
      app: { elementIndicatorStyle: 'footer' },
    });
  });

  it('finds a setting through the search, as in the app', () => {
    renderBody('livediagram.app');
    const search = document.querySelector<HTMLInputElement>('input[aria-label="Search settings"]')!;
    act(() => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(search, 'loop the deck');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const pane = document.querySelector('[data-settings-pane]')!;
    expect(pane.textContent).toContain('Loop the Deck');
    expect(pane.textContent).not.toContain('Alignment Guides');
  });
});

describe('AppSettingsDialog', () => {
  const app = listedApps().find((a) => a.id === 'liveplanner.app') as ListedApp & { id: AppId };

  function open(onClose = vi.fn()) {
    fetchMock.mockReturnValue(json(200, { all: {}, app: {}, updatedAt: null }));
    act(() =>
      root.render(
        <AppSettingsDialog app={app} settingsHref="https://example/x" onClose={onClose} />,
      ),
    );
    return onClose;
  }

  it("is a modal dialog titled with the app's name and logo, linking to the rest", async () => {
    open();
    await settle();
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('liveplanner Settings');
    expect(dialog.querySelector('header h2')?.textContent).toBe('liveplanner Settings');
    expect(dialog.querySelector('header svg')).not.toBeNull();
    expect(document.activeElement).toBe(dialog);
    expect(dialog.textContent).toContain('More in liveplanner Settings');
    expect(dialog.querySelector('a[href="https://example/x"]')).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/account/settings/liveplanner.app',
      expect.anything(),
    );
  });

  it('closes on Escape', async () => {
    const onClose = open();
    await settle();
    const dialog = document.querySelector('[role="dialog"]')!;
    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps Tab inside', async () => {
    // jsdom lays nothing out, so every element reads as hidden to the shared Dialog's focus trap.
    const offsetParent = vi
      .spyOn(HTMLElement.prototype, 'offsetParent', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return this.parentElement;
      });
    open();
    await settle();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    const focusable = [
      ...dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]',
      ),
    ].filter((el) => el.tabIndex >= 0);
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    act(() => last.focus());
    act(() => {
      last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });
    expect(document.activeElement).toBe(first);
    act(() => {
      first.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
      );
    });
    expect(document.activeElement).toBe(last);
    offsetParent.mockRestore();
  });

  it('reads once, and reopens from the page’s copy', async () => {
    open();
    await settle();
    act(() => root.render(<div />));
    open();
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('the Your apps cards', () => {
  function answer(url: string) {
    if (url.endsWith('/profile')) return json(200, { profile: null });
    if (url.endsWith('/settings')) return json(200, { all: {}, updatedAt: null });
    return json(200, { all: {}, app: {}, updatedAt: null });
  }

  it('open a dialog from ?app=, follow it in the address, and give focus back on close', async () => {
    fetchMock.mockImplementation(answer);
    window.history.replaceState(null, '', '/account/settings?app=livedesign');
    act(() => root.render(<SettingsPanel />));
    await settle();
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('livedesign Settings');
    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(window.location.search).toBe('');
    const card = document.activeElement as HTMLElement;
    expect(card.getAttribute('aria-haspopup')).toBe('dialog');
    expect(card.textContent).toContain('livedesign Settings');

    act(() => card.click());
    await settle();
    expect(window.location.search).toBe('?app=livedesign');
  });
});
