// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppCatalogue } from '@liveworkspace/settings/catalogue';
import { CATALOGUE as LIVEDIAGRAM } from '@liveworkspace/settings/catalogues/livediagram';
import { CATALOGUE as LIVEPLANNER } from '@liveworkspace/settings/catalogues/liveplanner';
import { CATALOGUE as LIVEDOCUMENTS } from '@liveworkspace/settings/catalogues/livedocuments';
import { CATALOGUE as LIVEDESIGN } from '@liveworkspace/settings/catalogues/livedesign';
import { __forgetAppScopes, visibleRows, type AppId, type AppScopes } from '@/lib/app-settings';
import { listedApps, type ListedApp } from '@/lib/apps';
import AppSettingsDialog, { AppSettingsBody } from './AppSettingsDialog';
import { SettingsPanel } from './SettingsPanel';

// The app settings dialog (liveworkspace/docs/site.md "Your account"): each app's own settings, saved
// a key at a time to that app's scope, put back when a save fails, and usable from the keyboard.
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

const switchNamed = (label: string) => {
  const labelEl = [...container.querySelectorAll('p')].find((p) => p.textContent === label)!;
  return container.querySelector<HTMLButtonElement>(`[aria-labelledby="${labelEl.id}"]`)!;
};

describe('AppSettingsBody', () => {
  it.each(Object.keys(CATALOGUES) as AppId[])(
    "shows %s's own categories and rows, in its order",
    (app) => {
      renderBody(app);
      const catalogue = CATALOGUES[app];
      const headings = [...container.querySelectorAll('h3')].map((h) => h.textContent);
      const shown = catalogue.categories.filter(
        (c) => visibleRows(c, { all: {}, app: {} }).length > 0,
      );
      expect(headings).toEqual(shown.map((c) => c.label));
      const text = container.textContent ?? '';
      for (const category of shown) {
        for (const row of visibleRows(category, { all: {}, app: {} })) {
          expect(text).toContain(row.label);
          expect(text).toContain(row.description);
        }
      }
    },
  );

  it('hides a nested row while its switch is off, as the app does', () => {
    renderBody('livediagram.app', { all: {}, app: { showMinimap: false } });
    expect(container.textContent).toContain('Enable Map');
    expect(container.textContent).not.toContain('Map Size');
  });

  it('saves a change as a patch of just that key, in that app’s scope', async () => {
    fetchMock.mockReturnValue(json(200, { all: {}, app: { alignmentGuides: false } }));
    renderLiveBody('livediagram.app');
    const guides = switchNamed('Alignment Guides');
    expect(guides.getAttribute('aria-checked')).toBe('true');
    act(() => guides.click());
    expect(guides.getAttribute('aria-checked')).toBe('false');
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/account/settings/livediagram.app');
    expect(init?.method).toBe('PATCH');
    expect(sent(0)).toEqual({ app: { alignmentGuides: false } });
  });

  it("writes one field of an object setting, keeping the object's others", async () => {
    fetchMock.mockReturnValue(json(200, { all: {}, app: {} }));
    renderLiveBody('livediagram.app', { all: {}, app: { presentation: { speed: 'slow' } } });
    act(() => switchNamed('Loop the Deck').click());
    await settle();
    expect(sent(0)).toEqual({
      app: { presentation: { speed: 'slow', loop: true } },
    });
  });

  it('puts a switch back, and says so, when the save fails', async () => {
    fetchMock.mockReturnValue(json(500, { error: 'failed' }));
    renderLiveBody('livediagram.app');
    const guides = switchNamed('Alignment Guides');
    act(() => guides.click());
    expect(guides.getAttribute('aria-checked')).toBe('false');
    await settle();
    expect(switchNamed('Alignment Guides').getAttribute('aria-checked')).toBe('true');
    expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/went wrong/);
  });

  it('moves a choice with the arrow keys, saving each step', async () => {
    fetchMock.mockReturnValue(json(200, { all: {}, app: {} }));
    renderLiveBody('livediagram.app');
    const group = [...container.querySelectorAll('[role="radiogroup"]')].find((g) =>
      g.textContent?.includes('Footer'),
    )!;
    const radios = [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    act(() => radios[0]!.focus());
    act(() => {
      radios[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(radios[1]!.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(radios[1]);
    await settle();
    expect(sent(0)).toEqual({
      app: { elementIndicatorStyle: 'footer' },
    });
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
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const title = document.getElementById(dialog.getAttribute('aria-labelledby')!)!;
    expect(title.textContent).toBe('liveplanner Settings');
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
    const dialog = container.querySelector('[role="dialog"]')!;
    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps Tab inside', async () => {
    open();
    await settle();
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    const focusable = [
      ...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]'),
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
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('livedesign Settings');
    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(window.location.search).toBe('');
    const card = document.activeElement as HTMLElement;
    expect(card.getAttribute('aria-haspopup')).toBe('dialog');
    expect(card.textContent).toContain('livedesign Settings');

    act(() => card.click());
    await settle();
    expect(window.location.search).toBe('?app=livedesign');
  });
});
