// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SettingsAppId } from '@liveworkspace/settings-ui';
import { configureWorkbench, resetWorkbenchForTests, WORKBENCH_DEFAULTS } from '../../../bindings';
import { ACCOUNT_SETTINGS_PARAM, createSettingsPanelHost } from './settings-panel-host';

// The Settings panel's host, one copy for every editor (docs/specs/007-editor/user-preferences.md "This app or All"):
// each editor binds it with its app name.

afterEach(() => {
  resetWorkbenchForTests();
  vi.unstubAllGlobals();
});

function withBearer(bearer: string | null) {
  configureWorkbench({
    ...WORKBENCH_DEFAULTS,
    api: { ...WORKBENCH_DEFAULTS.api, currentBearer: () => Promise.resolve(bearer) },
  });
}

describe('createSettingsPanelHost', () => {
  it("names the panel's app from its site", () => {
    const { SETTINGS_APP } = createSettingsPanelHost('livedesign');
    expect(SETTINGS_APP.id).toBe('livedesign.app');
    expect(SETTINGS_APP.name).toBe('livedesign');
    expect(SETTINGS_APP.live?.light).toMatch(/^#/);
  });

  it("asks the account API through the app's router with the bearer bound when the request goes out", async () => {
    const host = createSettingsPanelHost('livediagram');
    const fetchMock = vi.fn(async () => new Response('{"ok":1}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    withBearer('tok-1');
    await expect(host.settingsRequest('/settings')).resolves.toEqual({ ok: true, data: { ok: 1 } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/workspace/account/settings');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok-1');
  });

  it('asks nothing signed out', async () => {
    const host = createSettingsPanelHost('liveplanner');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    withBearer(null);
    await expect(host.settingsRequest('/settings')).resolves.toMatchObject({
      ok: false,
      status: 401,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("makes Cloud Sync's host on liveworkspace, returning to Account > Profile", () => {
    const host = createSettingsPanelHost('livedocuments').cloudSyncHost();
    expect(host.settingsParam).toBe(ACCOUNT_SETTINGS_PARAM);
    expect(host.workspaceOrigin).toMatch(/^https?:\/\//);
    expect(host.helpHref?.startsWith(host.workspaceOrigin)).toBe(true);
  });

  it("carries the Account section's sign-in panel", () => {
    const { ACCOUNT_SETTINGS } = createSettingsPanelHost('livehuddle');
    expect(ACCOUNT_SETTINGS.security).toBeDefined();
  });

  it("draws this app's prism in its own colours and every other in its accent", () => {
    const { renderSettingsLogo, SETTINGS_APP } = createSettingsPanelHost('livediagram');
    for (const id of [SETTINGS_APP.id, 'all', 'liveplanner.app', 'retired.app'] as (
      SettingsAppId | 'all'
    )[]) {
      const { container, unmount } = render(<>{renderSettingsLogo(id)}</>);
      expect(container.querySelector('svg'), id).not.toBeNull();
      unmount();
    }
  });
});
