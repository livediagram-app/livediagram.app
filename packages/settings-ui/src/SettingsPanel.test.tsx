// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { SettingsBlob } from '@liveworkspace/settings';
import { groupCategories } from './groups';
import type { SettingsCategory, SettingsRow } from './model';
import { useSettingsScope, type SettingsScope } from './scope';
import { createSettingsStore, type SettingsRequest } from './store';
import { SettingsPanel } from './SettingsPanel';
import { fixtureCategories } from './test/fixture';
import { renderWithKit } from './test/kit';

// The one Settings panel (each app's docs/specs/007-editor/user-preferences.md "This app or All"): this app's
// settings with nothing fetched, or All, with the account's categories and one set of categories merged across Common
// (the settings two or more apps have, once) and every app, under the rail's Account, Apps and Developers labels, each
// row marked with the logos of the apps it applies to; signed in, the app's side is the same, kept to the rows that
// apply to it, with no logos.

type Call = { path: string; method: string; body: unknown };

function fakeRequest(answers: (call: Call) => unknown = () => ({ all: {}, app: {} })) {
  const calls: Call[] = [];
  const request = (async (path: string, method = 'GET', body?: unknown) => {
    const call = { path, method, body };
    calls.push(call);
    return { ok: true, data: answers(call) };
  }) as SettingsRequest;
  return { calls, request };
}

const pane = () => document.querySelector<HTMLElement>('[data-settings-pane]')!;
// The apps a row says it applies to: its logos' name.
const marksOf = (control: HTMLElement) =>
  control
    .closest('[data-settings-cell]')
    ?.querySelector('[data-settings-app-marks]')
    ?.getAttribute('aria-label') ?? null;
const rail = () => screen.getByRole('navigation', { name: 'Settings categories' });
// The rail's label headings, in order.
const headings = () => [...rail().querySelectorAll('h3')].map((h) => h.textContent);

function Host({
  own,
  request,
  initial = null,
  shared,
  allowAll = true,
}: {
  own?: SettingsCategory[];
  request: SettingsRequest;
  initial?: SettingsScope | null;
  shared?: { all: SettingsBlob; set: (key: string, value: boolean) => void };
  allowAll?: boolean;
}) {
  const [store] = useState(() => createSettingsStore(request));
  const [scope, setScope] = useSettingsScope(initial);
  return (
    <SettingsPanel
      app={{ id: 'liveplanner.app', name: 'liveplanner' }}
      {...(own ? { own } : {})}
      allowAll={allowAll}
      scope={scope}
      onScopeChange={setScope}
      store={store}
      account={{ ...(shared ? { shared } : {}), renderTokens: () => null }}
      renderLogo={(id) => <svg data-logo={id} />}
      isMobile={false}
      onClose={() => {}}
      memoryKey="test:settings-view"
    />
  );
}

describe('SettingsPanel', () => {
  it("shows an editor's own settings at once, before anything is read, and the switch in the header", () => {
    const { calls, request } = fakeRequest();
    renderWithKit(<Host own={fixtureCategories()} request={request} />);
    expect(within(pane()).getByRole('switch', { name: 'Alignment Guides' })).toBeTruthy();
    const header = document.querySelector<HTMLElement>('[data-dialog-hero="settings"]')!;
    const switcher = within(header).getByRole('group', { name: 'Show settings for' });
    expect(
      within(switcher)
        .getByRole('button', { name: /liveplanner/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(switcher.querySelector('[data-logo="liveplanner.app"]')).not.toBeNull();
    expect(switcher.querySelector('[data-logo="all"]')).not.toBeNull();
    // Only reads: the Account section and Common are fetched beside the editor's own, nothing written.
    expect(calls.every((call) => call.method === 'GET')).toBe(true);
  });

  it('adds no banner or contentinfo landmark to the page it opens over', () => {
    const { request } = fakeRequest();
    renderWithKit(<Host own={fixtureCategories()} request={request} />);
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('contentinfo')).toBeNull();
  });

  it("keeps the account's categories and the common settings on an app's own side, signed in, in one set", async () => {
    const { request } = fakeRequest();
    renderWithKit(<Host own={fixtureCategories()} request={request} initial="app" />);
    await waitFor(() => expect(screen.getByRole('group', { name: 'Account' })).toBeTruthy());
    // Plain labels, not an accordion: nothing to open.
    expect(headings()).toEqual(['Account', 'Apps', 'Developers']);
    expect(within(rail()).queryByRole('button', { name: 'Account' })).toBeNull();
    const rows = within(rail())
      .getAllByRole('button')
      .map((b) => b.textContent);
    // No Common group and no group named for an app.
    for (const group of ['Common', 'liveplanner', 'livediagram', 'livedocuments', 'livedesign'])
      expect(rows).not.toContain(group);
    // Only All draws the apps' logos: every row here is liveplanner's, so none, and no column for them.
    const apps = within(rail()).getByRole('group', { name: 'Apps' });
    fireEvent.click(within(apps).getByRole('button', { name: /^Editor/ }));
    expect(marksOf(within(pane()).getByRole('switch', { name: 'Auto-Attach Arrows' }))).toBeNull();
    expect(pane().querySelector('[data-settings-app-marks]')).toBeNull();
    expect(pane().querySelector('[data-settings-app-marks-spacer]')).toBeNull();
  });

  it("keeps an editor's own settings when the account's can't be read, with Try again for the rest", async () => {
    let fail = true;
    const calls: string[] = [];
    const request = (async (path: string) => {
      calls.push(path);
      return fail ? { ok: false, error: 'offline' } : { ok: true, data: { all: {}, app: {} } };
    }) as SettingsRequest;
    renderWithKit(<Host own={fixtureCategories()} request={request} initial="app" />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Couldn’t reach your account/);
    // The editor's own rows stay; only the Account section and Common are missing.
    expect(within(pane()).getByRole('switch', { name: 'Alignment Guides' })).toBeTruthy();
    expect(within(rail()).queryByRole('group', { name: 'Account' })).toBeNull();

    fail = false;
    const asked = calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(within(rail()).getByRole('group', { name: 'Account' })).toBeTruthy(),
    );
    expect(calls.length).toBeGreaterThan(asked);
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('offers no switch when All is not allowed (a guest)', () => {
    const { request } = fakeRequest();
    renderWithKit(
      <Host own={fixtureCategories()} request={request} allowAll={false} initial="all" />,
    );
    expect(screen.queryByRole('group', { name: 'Show settings for' })).toBeNull();
    expect(within(pane()).getByRole('switch', { name: 'Alignment Guides' })).toBeTruthy();
  });

  it('shows All: the account’s categories and one set merged across Common and every app, under labels', async () => {
    const { calls, request } = fakeRequest();
    const own = fixtureCategories({
      privacy: [
        {
          kind: 'toggle',
          key: 'telemetryEnabled',
          label: 'Usage Data',
          description: '',
          allApps: true,
          value: true,
          onChange: vi.fn(),
        },
      ],
    });
    const set = vi.fn();
    renderWithKit(
      <Host own={own} request={request} shared={{ all: { notifyTips: false }, set }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^All/ }));
    await waitFor(() => expect(screen.getByRole('group', { name: 'Account' })).toBeTruthy());
    // Every other app is read once; the editor's own app is not. (The Phone section, on show in Notifications, reads
    // the account's devices.)
    expect(
      calls
        .map((c) => c.path)
        .filter((path) => path !== '/push/devices')
        .sort(),
    ).toEqual([
      '/settings/livedesign.app',
      '/settings/livediagram.app',
      '/settings/livedocuments.app',
      '/settings/livehuddle.app',
    ]);
    // Account, Apps and Developers; no app has a group of its own.
    expect(headings()).toEqual(['Account', 'Apps', 'Developers']);
    expect(
      within(within(rail()).getByRole('group', { name: 'Developers' }))
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['API Tokens']);
    const apps = within(rail()).getByRole('group', { name: 'Apps' });
    const top = [...apps.lastElementChild!.children].map(
      (child) => child.querySelector('button')?.textContent ?? child.textContent,
    );
    // One Editor and one Panels for every app; the editor's Privacy held only a shared switch, which Account has.
    expect(top.filter((label) => label === 'Editor')).toHaveLength(1);
    expect(top).toContain('Panels');
    expect(top).not.toContain('Privacy');
    expect(top).not.toContain('Common');
    // Editor: the common settings as the editor's own rows (changed through it), marked with every app that has
    // them (all five here, so liveworkspace's one mark); liveplanner's own row beside them with its logo, never under
    // an app's heading.
    fireEvent.click(within(apps).getByRole('button', { name: /^Editor/ }));
    expect(pane().querySelector('[data-settings-app-heading]')).toBeNull();
    const guides = within(pane()).getByRole('switch', { name: 'Alignment Guides' });
    expect(marksOf(guides)).toBe('Every App');
    fireEvent.click(guides);
    const ownGuides = own[0]!.rows[0] as Extract<SettingsRow, { kind: 'toggle' }>;
    expect(ownGuides.onChange).toHaveBeenCalledWith(true);
    // liveplanner's own Auto-Attach row (its fixture key, not the other apps' common autoRebindArrows of that name).
    const attach = within(
      pane().querySelector<HTMLElement>('[data-settings-cell$="autoAttach"]')!,
    ).getByRole('switch', { name: 'Auto-Attach Arrows' });
    expect(marksOf(attach)).toBe('liveplanner');
    expect(
      attach.closest('[data-settings-cell]')?.querySelector('[data-logo="liveplanner.app"]'),
    ).not.toBeNull();
    // Common's Map settings are a section of the one Panels, never a category of their own.
    fireEvent.click(within(apps).getByRole('button', { name: /^Panels/ }));
    expect(within(apps).queryByRole('button', { name: /^Map/ })).toBeNull();
    expect(within(pane()).getByRole('heading', { name: 'Map' })).toBeTruthy();
    // The other apps' common settings (Pages' Contents) sit in the one Editor, in its Pages section.
    expect(within(apps).queryByRole('button', { name: /^Pages/ })).toBeNull();
    fireEvent.click(within(apps).getByRole('button', { name: /^Editor/ }));
    expect(within(pane()).getAllByText('Contents', { exact: true }).length).toBeGreaterThan(0);
    expect(calls.filter((c) => c.method === 'PATCH')).toEqual([]);
    // An Account switch reads and writes through the host's shared preferences.
    const account = within(rail()).getByRole('group', { name: 'Account' });
    fireEvent.click(within(account).getByRole('button', { name: /^Notifications/ }));
    const tips = within(pane()).getByRole('switch', { name: 'Tips and Check-Ins' });
    expect(tips.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(tips);
    expect(set).toHaveBeenCalledWith('notifyTips', true);
  });

  it("writes an Account switch to the `all` scope, a common row to `all`, and an app's own row to its own", async () => {
    const { calls, request } = fakeRequest((call) =>
      call.method === 'PATCH' && call.path === '/settings'
        ? { all: { notifyTips: false } }
        : { all: {}, app: {} },
    );
    renderWithKit(<Host request={request} initial="all" />);
    await waitFor(() => expect(screen.getByRole('group', { name: 'Account' })).toBeTruthy());
    // No editor here: all five apps are read.
    expect(calls.filter((c) => c.method === 'GET' && c.path !== '/push/devices')).toHaveLength(5);
    const account = () => within(rail()).getByRole('group', { name: 'Account' });
    fireEvent.click(within(account()).getByRole('button', { name: /^Notifications/ }));
    await act(async () => {
      fireEvent.click(within(pane()).getByRole('switch', { name: 'Tips and Check-Ins' }));
    });
    expect(calls.at(-1)).toEqual({
      path: '/settings',
      method: 'PATCH',
      body: { all: { notifyTips: false } },
    });
    expect(
      within(pane())
        .getByRole('switch', { name: 'Tips and Check-Ins' })
        .getAttribute('aria-checked'),
    ).toBe('false');
    // The account's own switch is every app's: liveworkspace's mark.
    expect(marksOf(within(pane()).getByRole('switch', { name: 'Tips and Check-Ins' }))).toBe(
      'Every App',
    );
    // An app's own email switch, folded into the account's Notifications with its logo, to its own scope.
    const joins = within(pane()).getByRole('switch', { name: 'Someone Joins My Plan' });
    expect(marksOf(joins)).toBe('liveplanner');
    await act(async () => {
      fireEvent.click(joins);
    });
    expect(calls.at(-1)).toEqual({
      path: '/settings/liveplanner.app',
      method: 'PATCH',
      body: { app: { notifyProjectJoin: false } },
    });
    // A common setting, once in the merged Editor, to `all`.
    const apps = within(rail()).getByRole('group', { name: 'Apps' });
    fireEvent.click(within(apps).getByRole('button', { name: /^Editor/ }));
    expect(within(pane()).getAllByRole('switch', { name: 'Alignment Guides' })).toHaveLength(1);
    await act(async () => {
      fireEvent.click(within(pane()).getByRole('switch', { name: 'Alignment Guides' }));
    });
    expect(calls.at(-1)).toEqual({
      path: '/settings',
      method: 'PATCH',
      body: { all: { alignmentGuides: false } },
    });
    // Getting Started: every app's own in one category, each section once, each row with its own app's logo.
    fireEvent.click(within(apps).getByRole('button', { name: /^Getting Started/ }));
    const marks = [...pane().querySelectorAll('[data-settings-app-marks]')].map((el) =>
      el.getAttribute('aria-label'),
    );
    expect(marks).toEqual(expect.arrayContaining(['liveplanner']));
    // livehuddle's Receptionist's Welcome is its own row. livediagram has none here since its Avatar Tour went to
    // livehuddle (livediagram's Work Tracker #650).
    expect(marks).toEqual(expect.arrayContaining(['livehuddle']));
    expect(marks).not.toContain('livediagram');
    const sections = [...pane().querySelectorAll('h3')].map((h) => h.textContent);
    expect(new Set(sections).size).toBe(sections.length);
  });

  it('shows a common setting as an app kept it before it was shared, and writes it to `all` with the rest kept', async () => {
    const { calls, request } = fakeRequest((call) => {
      if (call.method === 'PATCH') return { all: (call.body as { all: SettingsBlob }).all };
      if (call.path === '/settings/livediagram.app') {
        return {
          all: {},
          app: { presentation: { speed: 'slow', loop: false }, homeBanner: false },
        };
      }
      if (call.path === '/settings/livedocuments.app') {
        return { all: {}, app: { presentation: { loop: true } } };
      }
      return { all: {}, app: {} };
    });
    renderWithKit(<Host request={request} initial="all" />);
    await waitFor(() => expect(screen.getByRole('group', { name: 'Apps' })).toBeTruthy());
    const apps = within(rail()).getByRole('group', { name: 'Apps' });
    // Show Home Banner sits under the platform's Explorer, off as livediagram kept it.
    fireEvent.click(within(apps).getByRole('button', { name: /^Explorer/ }));
    expect(
      within(pane()).getByRole('switch', { name: 'Show Home Banner' }).getAttribute('aria-checked'),
    ).toBe('false');
    // Presenting (a category of its own): livediagram's copy (the first app with one), and a change keeps its other
    // fields.
    fireEvent.click(within(apps).getByRole('button', { name: /^Presenting/ }));
    const loop = within(pane()).getByRole('switch', { name: 'Loop the Deck' });
    expect(loop.getAttribute('aria-checked')).toBe('false');
    await act(async () => {
      fireEvent.click(loop);
    });
    expect(calls.at(-1)).toEqual({
      path: '/settings',
      method: 'PATCH',
      body: { all: { presentation: { speed: 'slow', loop: true } } },
    });
    expect(
      within(pane()).getByRole('switch', { name: 'Loop the Deck' }).getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('lands a category remembered from the old per-app layout on its merged category', async () => {
    localStorage.setItem(
      'test:settings-view:all',
      JSON.stringify({ categoryId: 'liveplanner.app:tours', anchor: null }),
    );
    const { request } = fakeRequest();
    renderWithKit(<Host request={request} initial="all" />);
    await waitFor(() => expect(screen.getByRole('group', { name: 'Apps' })).toBeTruthy());
    expect(
      within(rail())
        .getByRole('button', { name: /^Getting Started/ })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(pane().querySelector('[aria-label="liveplanner"]')).not.toBeNull();
  });

  it("shows the app's own side's settings, a common one among them, written to the shared scope", async () => {
    const { calls, request } = fakeRequest((call) =>
      call.method === 'PATCH'
        ? { all: (call.body as { all: SettingsBlob }).all }
        : { all: {}, app: { homeBanner: false } },
    );
    renderWithKit(<Host request={request} initial="app" />);
    await waitFor(() =>
      expect(within(rail()).getByRole('button', { name: /^Explorer/ })).toBeTruthy(),
    );
    // The account's own, then one set of categories: no Common, no group per app.
    const rows = within(rail())
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(headings()).toContain('Account');
    expect(rows).toContain('Notifications');
    for (const group of ['Common', 'liveplanner', 'livediagram']) expect(rows).not.toContain(group);
    fireEvent.click(within(rail()).getByRole('button', { name: /^Explorer/ }));
    const banner = within(pane()).getByRole('switch', { name: 'Show Home Banner' });
    expect(banner.getAttribute('aria-checked')).toBe('false');
    await act(async () => {
      fireEvent.click(banner);
    });
    expect(calls.at(-1)).toEqual({
      path: '/settings',
      method: 'PATCH',
      body: { all: { homeBanner: true } },
    });
  });

  it('always opens on this app, whatever was chosen at the last open', () => {
    const { request } = fakeRequest();
    const first = renderWithKit(<Host own={fixtureCategories()} request={request} />);
    fireEvent.click(screen.getByRole('button', { name: /^All/ }));
    first.unmount();
    renderWithKit(<Host own={fixtureCategories()} request={request} />);
    expect(screen.getByRole('button', { name: /^liveplanner/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});

describe('groupCategories', () => {
  it('prefixes every id and reference with the group, and drops what is left empty', () => {
    const row = (key: string, extra: Partial<SettingsRow> = {}) =>
      ({
        kind: 'toggle',
        key,
        label: key,
        description: '',
        value: false,
        onChange: () => {},
        ...extra,
      }) as SettingsRow;
    const grouped = groupCategories(
      'app',
      [
        { id: 'panels', label: 'Panels', rows: [row('gone', { allApps: true })] },
        {
          id: 'map',
          label: 'Map',
          parent: 'panels',
          rows: [row('show'), row('size', { parent: 'show' })],
        },
      ],
      { omit: (r) => r.allApps === true },
    );
    expect(grouped.map((c) => c.id)).toEqual(['app:map']);
    expect(grouped[0]).not.toHaveProperty('parent');
    expect(grouped[0]!.group).toBe('app');
    expect(grouped[0]!.rows.map((r) => [r.key, r.parent])).toEqual([
      ['app:show', undefined],
      ['app:size', 'app:show'],
    ]);
  });
});
