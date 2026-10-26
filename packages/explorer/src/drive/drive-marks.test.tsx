import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveworkspace/index-client';
import type {
  DriveConfigAnswer,
  DriveConnectionAnswer,
  DriveMarksAnswer,
} from '@liveworkspace/drive';
import { DriveReconnectBanner, withDriveMarks } from './DriveMarks';
import { DRIVE_MARKS_MIN_GAP_MS, useDriveMarks, type DriveMarksClient } from './useDriveMarks';

const CONFIG: DriveConfigAnswer = {
  enabled: true,
  connected: true,
  clientId: 'c',
  pickerKey: null,
  appId: null,
};
const CONNECTION: DriveConnectionAnswer = {
  connected: true,
  status: 'ok',
  rootFolderName: 'liveworkspace',
  connectedAt: 0,
  lastSyncedAt: 0,
  syncing: false,
  progress: null,
  items: 2,
  notices: [],
  pendingSwitchUntil: null,
};
const MARKS: DriveMarksAnswer = {
  marks: [
    { id: 'a', kind: 'item', state: 'synced', notice: null },
    { id: 'b', kind: 'item', state: 'syncing', notice: null },
    { id: 'c', kind: 'item', state: 'waiting', notice: 'unseen_folder' },
  ],
};

function fake(
  config: Partial<DriveConfigAnswer> = {},
  connection: DriveConnectionAnswer = CONNECTION,
) {
  return {
    config: vi.fn(async () => ({ ok: true as const, data: { ...CONFIG, ...config } })),
    marks: vi.fn(async () => ({ ok: true as const, data: MARKS })),
    connection: vi.fn(async () => ({ ok: true as const, data: connection })),
  } satisfies DriveMarksClient;
}

const host = (client: DriveMarksClient) => ({ client, workspaceOrigin: 'https://lw.test' });

afterEach(() => sessionStorage.clear());

describe('useDriveMarks', () => {
  it('asks for marks only once the config says the person is connected', async () => {
    const off = fake({ connected: false });
    renderHook(() => useDriveMarks(host(off)));
    await waitFor(() => expect(off.config).toHaveBeenCalledOnce());
    expect(off.marks).not.toHaveBeenCalled();
    expect(off.connection).not.toHaveBeenCalled();

    const disabled = fake({ enabled: false, connected: true });
    renderHook(() => useDriveMarks(host(disabled)));
    await waitFor(() => expect(disabled.config).toHaveBeenCalledOnce());
    expect(disabled.marks).not.toHaveBeenCalled();
  });

  it('asks nothing without a host (a guest)', () => {
    const { result } = renderHook(() => useDriveMarks(null));
    expect(result.current.byId.size).toBe(0);
  });

  it('reads the marks once per mount, and again on focus at most every 30 s', async () => {
    const client = fake();
    let now = 1_000_000;
    const { result } = renderHook(() => useDriveMarks(host(client), () => now));
    await waitFor(() => expect(result.current.byId.size).toBe(3));
    expect(client.marks).toHaveBeenCalledTimes(1);
    expect(client.config).toHaveBeenCalledTimes(1);

    now += DRIVE_MARKS_MIN_GAP_MS - 1;
    await act(async () => void window.dispatchEvent(new Event('focus')));
    expect(client.marks).toHaveBeenCalledTimes(1);

    now += 1;
    await act(async () => void window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(client.marks).toHaveBeenCalledTimes(2));
    // The config isn't asked again.
    expect(client.config).toHaveBeenCalledTimes(1);
  });

  it('says when the connection needs reconnecting', async () => {
    const client = fake({}, { ...CONNECTION, status: 'needs_reconnect' });
    const { result } = renderHook(() => useDriveMarks(host(client)));
    await waitFor(() => expect(result.current.needsReconnect).toBe(true));
  });
});

describe('withDriveMarks', () => {
  const item = (id: string) => ({ id }) as Item;

  it('draws the cloud beside the time, and the unseen-folder mark beside the name instead', async () => {
    const client = fake();
    const { result } = renderHook(() => useDriveMarks(host(client)));
    await waitFor(() => expect(result.current.byId.size).toBe(3));
    const render2 = withDriveMarks(undefined, result.current)!;
    render(
      <div>
        <span data-testid="a-time">{render2(item('a'), 'time')}</span>
        <span data-testid="a-title">{render2(item('a'), 'title')}</span>
        <span data-testid="c-time">{render2(item('c'), 'time')}</span>
        <span data-testid="c-title">{render2(item('c'), 'title')}</span>
        <span data-testid="z-time">{render2(item('z'), 'time')}</span>
      </div>,
    );
    expect(screen.getByTestId('a-time').querySelector('[data-drive-mark="synced"]')).not.toBeNull();
    expect(screen.getByTestId('a-title').textContent).toBe('');
    expect(screen.getByTestId('c-time').querySelector('[data-drive-mark]')).toBeNull();
    expect(screen.getByTestId('c-title').querySelector('[data-drive-notice]')).not.toBeNull();
    // An item the service doesn't mirror: nothing.
    expect(screen.getByTestId('z-time').innerHTML).toBe('');
  });

  it('leaves the host’s own marks as they are when there are no Drive marks', () => {
    const own = () => 'mine';
    expect(withDriveMarks(own, { byId: new Map(), needsReconnect: false })).toBe(own);
  });
});

describe('DriveReconnectBanner', () => {
  it('offers Reconnect and closes for the session', async () => {
    render(<DriveReconnectBanner workspaceOrigin="https://lw.test" />);
    expect(await screen.findByText('Google Drive sync is paused.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Reconnect' })).toBeTruthy();
    act(() => screen.getByRole('button', { name: 'Dismiss' }).click());
    expect(screen.queryByText('Google Drive sync is paused.')).toBeNull();
    expect(sessionStorage.getItem('liveworkspace:drive-reconnect-banner-dismissed')).toBe('1');
  });
});
