// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DriveClient, DriveResult } from '@liveworkspace/drive/client';
import type { DriveConfigAnswer, DriveConnectionAnswer } from '@liveworkspace/drive';
import { accountCategories } from '../account-model';
import { renderWithKit } from '../test/kit';
import { useCloudSync, type CloudSync, type CloudSyncHost } from './cloud-sync-host';
import { GoogleDriveRow } from './GoogleDriveRow';

const ok = <T,>(data: T): DriveResult<T> => ({ ok: true, data });

function fakeClient(
  config: Partial<DriveConfigAnswer>,
  connection: DriveConnectionAnswer = { connected: false },
) {
  const calls: string[] = [];
  const client = {
    config: vi.fn(async () => {
      calls.push('config');
      return ok({ enabled: true, connected: false, clientId: 'c', pickerKey: null, appId: null, ...config });
    }),
    connection: vi.fn(async () => {
      calls.push('connection');
      return ok(connection);
    }),
    check: vi.fn(async () => {
      calls.push('check');
      return ok(undefined);
    }),
    disconnect: vi.fn(async () => {
      calls.push('disconnect');
      return ok(undefined);
    }),
  } as unknown as DriveClient;
  return { client, calls };
}

const cloudSyncOf = (client: DriveClient, config: Partial<DriveConfigAnswer> = {}): CloudSync => ({
  client,
  workspaceOrigin: 'https://lw.test',
  settingsParam: 'account:account',
  config: { enabled: true, connected: false, clientId: 'c', pickerKey: null, appId: null, ...config },
});

const CONNECTED: DriveConnectionAnswer = {
  connected: true,
  status: 'ok',
  rootFolderName: 'liveworkspace',
  connectedAt: Date.now() - 86_400_000,
  lastSyncedAt: Date.now() - 3 * 60_000,
  syncing: false,
  progress: null,
  items: 4,
  notices: [],
  pendingSwitchUntil: null,
};

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('GoogleDriveRow', () => {
  it('Connect leaves for liveworkspace’s /drive/connect, coming back with Cloud Sync open', async () => {
    window.history.replaceState(null, '', '/project/p1?tab=2');
    const assign = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign } as Location);
    const { client, calls } = fakeClient({});
    renderWithKit(<GoogleDriveRow cloudSync={cloudSyncOf(client)} />);
    // Not connected: nothing asked of the service.
    expect(calls).toEqual([]);
    expect(screen.getByText('Not connected')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    const back = 'http://localhost:3000/project/p1?tab=2&settings=account%3Aaccount&section=cloud-sync';
    expect(assign).toHaveBeenCalledWith(`https://lw.test/drive/connect?return=${encodeURIComponent(back)}`);
    // The page's own entry names Cloud Sync, so Back from Google reopens it.
    vi.restoreAllMocks();
    expect(window.location.search).toBe('?tab=2&settings=account%3Aaccount&section=cloud-sync');
  });

  it('opening it for someone connected asks for a pass and shows the connection', async () => {
    const { client, calls } = fakeClient({ connected: true }, CONNECTED);
    renderWithKit(<GoogleDriveRow cloudSync={cloudSyncOf(client, { connected: true })} />);
    await waitFor(() => expect(screen.getByText('Last synced 3 mins ago')).toBeTruthy());
    expect(calls).toContain('check');
    expect(screen.getByText('Your work is synced to “liveworkspace” in Google Drive.')).toBeTruthy();
  });

  it('Disconnect asks first, neutrally, then shows Not connected', async () => {
    const { client } = fakeClient({ connected: true }, CONNECTED);
    renderWithKit(<GoogleDriveRow cloudSync={cloudSyncOf(client, { connected: true })} />);
    await waitFor(() => screen.getByText('Last synced 3 mins ago'));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(screen.getByText('Disconnect Google Drive?')).toBeTruthy();
    expect(client.disconnect).not.toHaveBeenCalled();
    const buttons = screen.getAllByRole('button', { name: 'Disconnect' });
    await act(async () => {
      fireEvent.click(buttons[buttons.length - 1]!);
    });
    expect(client.disconnect).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByText('Not connected')).toBeTruthy());
  });

  it('reads a cancel at Google once, calmly, and takes it out of the address', async () => {
    window.history.replaceState(null, '', '/explorer?settings=profile&section=cloud-sync&drive=cancelled');
    const { client } = fakeClient({});
    renderWithKit(<GoogleDriveRow cloudSync={cloudSyncOf(client)} />);
    expect(screen.getByText('Connection cancelled. Connect whenever you’re ready.')).toBeTruthy();
    await waitFor(() => expect(window.location.search).toBe('?settings=profile&section=cloud-sync'));
  });
});

describe('the Cloud Sync section', () => {
  function Probe({ host }: { host: CloudSyncHost | null }) {
    const cloudSync = useCloudSync(host);
    const profile = accountCategories({
      all: {},
      set: () => {},
      identity: { name: 'Ada', email: 'ada@example.com' },
      cloudSync,
    }).find((c) => c.id === 'account');
    return <p>{profile?.rows.map((r) => r.section ?? '-').join(',')}</p>;
  }

  it('shows only once the service says the deployment offers Drive', async () => {
    const on = fakeClient({ enabled: true });
    const host = { client: on.client, workspaceOrigin: 'https://lw.test', settingsParam: 'profile' };
    renderWithKit(<Probe host={host} />);
    await waitFor(() => expect(screen.getByText(/Cloud Sync/)).toBeTruthy());

    const off = fakeClient({ enabled: false });
    const offHost = { client: off.client, workspaceOrigin: 'https://lw.test', settingsParam: 'profile' };
    const { container } = renderWithKit(<Probe host={offHost} />);
    await waitFor(() => expect(off.client.config).toHaveBeenCalled());
    expect(container.textContent).not.toContain('Cloud Sync');
  });

  it('asks nothing for a guest (no host)', () => {
    renderWithKit(<Probe host={null} />);
    expect(screen.queryByText(/Cloud Sync/)).toBeNull();
  });
});
