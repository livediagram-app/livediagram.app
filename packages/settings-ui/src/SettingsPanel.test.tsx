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
// settings with nothing fetched, or All, with the Account section, Common (the settings two or more apps have, once)
// and every app's own settings under its name.

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
const rail = () => screen.getByRole('navigation', { name: 'Settings categories' });

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
  const [scope, setScope] = useSettingsScope('test:settings-scope', initial);
  return (
    <SettingsPanel
      app={{ id: 'liveplanner.app', name: 'liveplanner' }}
      {...(own ? { own } : {})}
      allowAll={allowAll}
      scope={scope}
      onScopeChange={setScope}
      store={store}
      account={{ ...(shared ? { shared } : {}), tokensHref: '/account/tokens' }}
      renderLogo={(id) => <svg data-logo={id} />}
      isMobile={false}
      onClose={() => {}}
      memoryKey="test:settings-view"
    />
  );
}

describe('SettingsPanel', () => {
  it("shows an editor's own settings at once, with nothing fetched, and the switch in the header", () => {
    const { calls, request } = fakeRequest();
    renderWithKit(<Host own={fixtureCategories()} request={request} />);
    expect(within(pane()).getByRole('switch', { name: 'Alignment Guides' })).toBeTruthy();
    const header = document.querySelector('header')!;
    const switcher = within(header).getByRole('group', { name: 'Show settings for' });
    expect(
      within(switcher)
        .getByRole('button', { name: /liveplanner/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(switcher.querySelector('[data-logo="liveplanner.app"]')).not.toBeNull();
    expect(switcher.querySelector('[data-logo="all"]')).not.toBeNull();
    expect(calls).toEqual([]);
  });

  it('offers no switch when All is not allowed (a guest)', () => {
    const { request } = fakeRequest();
    renderWithKit(
      <Host own={fixtureCategories()} request={request} allowAll={false} initial="all" />,
    );
    expect(screen.queryByRole('group', { name: 'Show settings for' })).toBeNull();
    expect(within(pane()).getByRole('switch', { name: 'Alignment Guides' })).toBeTruthy();
  });

  it('shows All: the Account section, Common, then every app under its name, the editor’s own without the shared rows', async () => {
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
    // Every other app is read once; the editor's own app is not.
    expect(calls.map((c) => c.path).sort()).toEqual([
      '/settings/livedesign.app',
      '/settings/livediagram.app',
      '/settings/livedocuments.app',
    ]);
    const headings = [...rail().querySelectorAll('[role="group"] > p')].map((p) => p.textContent);
    expect(headings).toEqual([
      'Account',
      'Common',
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
    ]);
    // The editor's own Privacy held only a shared switch, which the Account section has.
    const planner = within(rail()).getByRole('group', { name: 'liveplanner' });
    expect(within(planner).queryByRole('button', { name: /^Privacy/ })).toBeNull();
    expect(within(planner).getByRole('button', { name: /^Editor/ })).toBeTruthy();
    // Its common settings are under Common, as its own rows (changed through the editor), and not in its group.
    expect(within(planner).queryByRole('button', { name: /^Map/ })).toBeNull();
    fireEvent.click(within(planner).getByRole('button', { name: /^Editor/ }));
    expect(within(pane()).queryByRole('switch', { name: 'Alignment Guides' })).toBeNull();
    expect(within(pane()).getByRole('switch', { name: 'Auto-Attach Arrows' })).toBeTruthy();
    const common = within(rail()).getByRole('group', { name: 'Common' });
    fireEvent.click(within(common).getByRole('button', { name: /^Editor/ }));
    const guides = within(pane()).getByRole('switch', { name: 'Alignment Guides' });
    fireEvent.click(guides);
    const ownGuides = own[0]!.rows[0] as Extract<SettingsRow, { kind: 'toggle' }>;
    expect(ownGuides.onChange).toHaveBeenCalledWith(true);
    // Only the other apps' common settings come from their catalogues (Pages' Contents, say).
    expect(within(common).getByRole('button', { name: /^Pages/ })).toBeTruthy();
    expect(calls.filter((c) => c.method === 'PATCH')).toEqual([]);
    // An Account switch reads and writes through the host's shared preferences.
    const account = within(rail()).getByRole('group', { name: 'Account' });
    fireEvent.click(within(account).getByRole('button', { name: /^Notifications/ }));
    const tips = within(pane()).getByRole('switch', { name: 'Tips and Check-Ins' });
    expect(tips.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(tips);
    expect(set).toHaveBeenCalledWith('notifyTips', true);
    // The choice is kept for the next open.
    expect(localStorage.getItem('test:settings-scope')).toBe('all');
  });

  it("writes an Account switch to the `all` scope, and another app's row to its own", async () => {
    const { calls, request } = fakeRequest((call) =>
      call.method === 'PATCH' && call.path === '/settings'
        ? { all: { notifyTips: false } }
        : { all: {}, app: {} },
    );
    renderWithKit(<Host request={request} initial="all" />);
    await waitFor(() => expect(screen.getByRole('group', { name: 'Account' })).toBeTruthy());
    // No editor here: all four apps are read.
    expect(calls.filter((c) => c.method === 'GET')).toHaveLength(4);
    const account = within(rail()).getByRole('group', { name: 'Account' });
    fireEvent.click(within(account).getByRole('button', { name: /^Notifications/ }));
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
    // A common setting, under Common, to `all`.
    const common = within(rail()).getByRole('group', { name: 'Common' });
    fireEvent.click(within(common).getByRole('button', { name: /^Editor/ }));
    await act(async () => {
      fireEvent.click(within(pane()).getByRole('switch', { name: 'Alignment Guides' }));
    });
    expect(calls.at(-1)).toEqual({
      path: '/settings',
      method: 'PATCH',
      body: { all: { alignmentGuides: false } },
    });
    // An app's own row, to its own scope.
    const planner = within(rail()).getByRole('group', { name: 'liveplanner' });
    expect(within(planner).queryByRole('button', { name: /^Plans/ })).toBeNull();
    fireEvent.click(within(planner).getByRole('button', { name: /^Notifications/ }));
    await act(async () => {
      fireEvent.click(within(pane()).getByRole('switch', { name: 'Someone Joins My Plan' }));
    });
    expect(calls.at(-1)).toEqual({
      path: '/settings/liveplanner.app',
      method: 'PATCH',
      body: { app: { notifyProjectJoin: false } },
    });
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
    await waitFor(() => expect(screen.getByRole('group', { name: 'Common' })).toBeTruthy());
    const common = within(rail()).getByRole('group', { name: 'Common' });
    // Show Home Banner sits under the platform's Explorer, off as livediagram kept it.
    fireEvent.click(within(common).getByRole('button', { name: /^Explorer/ }));
    expect(
      within(pane()).getByRole('switch', { name: 'Show Home Banner' }).getAttribute('aria-checked'),
    ).toBe('false');
    // Presenting (under Editor): livediagram's copy (the first app with one), and a change keeps its other fields.
    fireEvent.click(within(common).getByRole('button', { name: /^Editor/ }));
    fireEvent.click(within(common).getByRole('button', { name: /^Presenting/ }));
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

  it("shows every setting on an app's own side, the common ones marked All apps", async () => {
    const { calls, request } = fakeRequest((call) =>
      call.method === 'PATCH'
        ? { all: (call.body as { all: SettingsBlob }).all }
        : { all: {}, app: { homeBanner: false } },
    );
    renderWithKit(<Host request={request} initial="app" />);
    await waitFor(() =>
      expect(within(rail()).getByRole('button', { name: /^Plans/ })).toBeTruthy(),
    );
    fireEvent.click(within(rail()).getByRole('button', { name: /^Plans/ }));
    const banner = within(pane()).getByRole('switch', { name: 'Show Home Banner' });
    expect(banner.getAttribute('aria-checked')).toBe('false');
    expect(within(pane()).getByText('All apps')).toBeTruthy();
    await act(async () => {
      fireEvent.click(banner);
    });
    expect(calls.at(-1)).toEqual({
      path: '/settings',
      method: 'PATCH',
      body: { all: { homeBanner: true } },
    });
  });

  it('opens on the side this device chose last', () => {
    localStorage.setItem('test:settings-scope', 'all');
    const { request } = fakeRequest();
    renderWithKit(<Host own={fixtureCategories()} request={request} />);
    expect(screen.getByRole('button', { name: /^All/ }).getAttribute('aria-pressed')).toBe('true');
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
        {
          id: 'go',
          label: 'Go',
          rows: [
            { kind: 'link', key: 'to', label: '', description: '', target: 'map', cta: 'Open' },
          ],
        },
      ],
      { omit: (r) => r.allApps === true },
    );
    expect(grouped.map((c) => c.id)).toEqual(['app:map', 'app:go']);
    expect(grouped[0]).not.toHaveProperty('parent');
    expect(grouped[0]!.group).toBe('app');
    expect(grouped[0]!.rows.map((r) => [r.key, r.parent])).toEqual([
      ['app:show', undefined],
      ['app:size', 'app:show'],
    ]);
    expect(grouped[1]!.rows[0]).toMatchObject({ target: 'app:map' });
  });

  it("points a readout line at the heading its row is drawn under (a common setting's, Common)", () => {
    const line = (rowKey: string) => ({
      setting: rowKey,
      rowKey,
      categoryId: 'editor',
      categoryLabel: 'Editor',
      label: rowKey,
      value: 'On',
      restorable: true,
      changed: false,
      reachable: true,
    });
    const [editor] = groupCategories(
      'app',
      [
        {
          id: 'editor',
          label: 'Editor',
          rows: [
            {
              kind: 'presetSummary',
              key: 'preset',
              label: '',
              description: '',
              lines: [line('alignmentGuides'), line('tourSeen')],
            },
          ],
        },
      ],
      { groupOf: (rowKey) => (rowKey === 'alignmentGuides' ? 'common' : 'app') },
    );
    const lines = (editor!.rows[0] as Extract<SettingsRow, { kind: 'presetSummary' }>).lines;
    expect(lines.map((l) => [l.rowKey, l.categoryId])).toEqual([
      ['common:alignmentGuides', 'common:editor'],
      ['app:tourSeen', 'app:editor'],
    ]);
  });
});
