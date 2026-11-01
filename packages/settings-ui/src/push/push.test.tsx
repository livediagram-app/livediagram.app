// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountCategories } from '../account-model';
import type { SettingsApiResult, SettingsRequest } from '../request';
import { renderWithKit } from '../test/kit';
import {
  currentSubscription,
  isAppleMobile,
  keyBytes,
  phoneSupport,
  pushDeviceLabel,
  readThisDevice,
  subscribeThisBrowser,
  writeThisDevice,
  type PushWindow,
} from './browser-push';
import { DeviceAppLogo } from './DeviceAppLogo';
import { phoneCopy, type PhoneState } from './phone-copy';
import type { PhoneHost, PushDeviceView } from './phone-host';
import { PHONE_SECTION } from './phone-rows';
import { PhoneNotificationsRow } from './PhoneNotificationsRow';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';

function fakeWindow(over: {
  userAgent?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
  serviceWorker?: unknown;
  permission?: NotificationPermission;
  ask?: NotificationPermission;
  push?: boolean;
  storage?: Storage;
}): PushWindow {
  const navigator = {
    userAgent: over.userAgent ?? CHROME_MAC,
    maxTouchPoints: over.maxTouchPoints ?? 0,
    standalone: over.standalone,
    ...(over.serviceWorker ? { serviceWorker: over.serviceWorker } : {}),
  } as unknown as PushWindow['navigator'];
  return {
    navigator,
    matchMedia: () => ({ matches: false }),
    ...(over.permission
      ? {
          Notification: {
            permission: over.permission,
            requestPermission: () => Promise.resolve(over.ask ?? 'granted'),
          },
        }
      : {}),
    ...(over.push === false ? {} : { PushManager: {} }),
    ...(over.storage ? { localStorage: over.storage } : {}),
  };
}

function fakeServiceWorker(subscription: Partial<PushSubscription> | null, fail = false) {
  const pushManager = {
    subscribe: vi.fn(() =>
      fail ? Promise.reject(new Error('no')) : Promise.resolve(subscription),
    ),
    getSubscription: vi.fn(() => Promise.resolve(subscription)),
  };
  return {
    register: vi.fn(() => Promise.resolve({})),
    ready: Promise.resolve({ pushManager }),
    getRegistration: vi.fn(() => Promise.resolve({ pushManager })),
    pushManager,
  };
}

describe('browser-push', () => {
  it('tells what this browser can do', () => {
    expect(phoneSupport(null)).toBe('unsupported');
    expect(
      phoneSupport(fakeWindow({ userAgent: IPHONE, permission: 'default', serviceWorker: {} })),
    ).toBe('needs-install');
    expect(
      phoneSupport(
        fakeWindow({
          userAgent: IPHONE,
          standalone: true,
          permission: 'default',
          serviceWorker: {},
        }),
      ),
    ).toBe('ready');
    expect(phoneSupport(fakeWindow({ permission: 'default', serviceWorker: {} }))).toBe('ready');
    expect(phoneSupport(fakeWindow({ permission: 'denied', serviceWorker: {} }))).toBe('blocked');
    expect(phoneSupport(fakeWindow({ permission: 'default' }))).toBe('unsupported');
    expect(
      phoneSupport(fakeWindow({ permission: 'default', serviceWorker: {}, push: false })),
    ).toBe('unsupported');
    // An iPad that says it is a Mac.
    expect(
      isAppleMobile(fakeWindow({ userAgent: 'Mozilla/5.0 (Macintosh)', maxTouchPoints: 5 })),
    ).toBe(true);
  });

  it('names the device by its browser and system alone', () => {
    expect(pushDeviceLabel(IPHONE)).toBe('Safari on iOS');
    expect(pushDeviceLabel(CHROME_MAC)).not.toMatch(/live/);
  });

  it('turns the VAPID key into bytes', () => {
    expect([...keyBytes('AQID')]).toEqual([1, 2, 3]);
    expect([...keyBytes('-_8')]).toEqual([251, 255]);
  });

  it('asks permission, registers the worker at /push-worker.js and subscribes', async () => {
    const subscription = { endpoint: 'https://fcm.googleapis.com/x' };
    const worker = fakeServiceWorker(subscription);
    const w = fakeWindow({ permission: 'default', serviceWorker: worker });
    expect(await subscribeThisBrowser('AQID', w)).toEqual({ ok: true, subscription });
    expect(worker.register).toHaveBeenCalledWith('/push-worker.js', { scope: '/' });
    expect(worker.pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3]),
    });
    expect(await currentSubscription(w)).toBe(subscription);
  });

  it('says why it could not subscribe', async () => {
    const worker = fakeServiceWorker(null, true);
    expect(await subscribeThisBrowser('AQID', null)).toEqual({ ok: false, reason: 'failed' });
    expect(
      await subscribeThisBrowser(
        'AQID',
        fakeWindow({ permission: 'default', ask: 'denied', serviceWorker: worker }),
      ),
    ).toEqual({ ok: false, reason: 'blocked' });
    expect(
      await subscribeThisBrowser(
        'AQID',
        fakeWindow({ permission: 'default', ask: 'default', serviceWorker: worker }),
      ),
    ).toEqual({ ok: false, reason: 'dismissed' });
    expect(
      await subscribeThisBrowser(
        'AQID',
        fakeWindow({ permission: 'default', serviceWorker: worker }),
      ),
    ).toEqual({ ok: false, reason: 'failed' });
    expect(await currentSubscription(fakeWindow({}))).toBeNull();
    const broken = { getRegistration: () => Promise.reject(new Error('no')) };
    expect(await currentSubscription(fakeWindow({ serviceWorker: broken }))).toBeNull();
  });

  it('remembers which listed device is this browser, and survives storage that throws', () => {
    const w = fakeWindow({ storage: window.localStorage });
    expect(readThisDevice(w)).toBeNull();
    writeThisDevice({ id: 'pd_1', endpoint: 'https://e' }, w);
    expect(readThisDevice(w)).toEqual({ id: 'pd_1', endpoint: 'https://e' });
    writeThisDevice(null, w);
    expect(readThisDevice(w)).toBeNull();
    window.localStorage.setItem('liveworkspace:push-device:v1', '{"id":1}');
    expect(readThisDevice(w)).toBeNull();
    const throwing = {
      getItem: () => {
        throw new Error('off');
      },
      setItem: () => {
        throw new Error('off');
      },
    } as unknown as Storage;
    const off = fakeWindow({ storage: throwing });
    expect(readThisDevice(off)).toBeNull();
    expect(() => writeThisDevice({ id: 'pd_1', endpoint: 'e' }, off)).not.toThrow();
    window.localStorage.clear();
  });
});

describe('phoneCopy', () => {
  it('has words for every state, and never names a product in plain text', () => {
    const states: PhoneState[] = [
      'loading',
      'ready',
      'on',
      'needs-install',
      'blocked',
      'unsupported',
      'off-here',
      'unreachable',
    ];
    for (const state of states) {
      const copy = phoneCopy.state(state);
      expect(copy.description.length).toBeGreaterThan(10);
      expect(copy.description).not.toMatch(/live(diagram|planner|documents|design|workspace)/);
    }
    expect(phoneCopy.state('needs-install').description).toContain('Add to Home Screen');
    expect(phoneCopy.subscribeFailed('dismissed')).toContain('Turn On');
    expect(phoneCopy.subscribeFailed('failed')).toContain('Try again');
    expect(phoneCopy.removeMessage('Pixel', true)).toContain('turn them on again here');
    expect(phoneCopy.removeMessage('Pixel', false)).toContain('from that device');
  });
});

describe('DeviceAppLogo', () => {
  it('draws each app’s prism and wordmark, and liveworkspace’s', () => {
    const { container } = renderWithKit(
      <>
        <DeviceAppLogo app="liveplanner" />
        <DeviceAppLogo app="liveworkspace" />
      </>,
    );
    expect(container.querySelectorAll('svg')).toHaveLength(2);
    expect(container.textContent).toBe('liveplannerliveworkspace');
  });
});

const NOW = 1_800_000_000_000;
const ok = <T,>(data: T): SettingsApiResult<T> => ({ ok: true, data });

function fakeAccount(devices: PushDeviceView[], publicKey: string | null = 'AQID') {
  const list = [...devices];
  const calls: string[] = [];
  const request = vi.fn(async (path: string, method = 'GET', body?: unknown) => {
    calls.push(`${method} ${path}`);
    if (method === 'GET') return ok({ publicKey, devices: [...list] });
    if (method === 'POST') {
      const device: PushDeviceView = {
        id: 'pd_new',
        label: (body as { label: string }).label,
        app: (body as { app: PushDeviceView['app'] }).app,
        createdAt: NOW,
        lastSentAt: null,
      };
      list.unshift(device);
      return { ok: true, data: { device } };
    }
    const id = path.split('/').pop();
    const at = list.findIndex((d) => d.id === id);
    if (at < 0) return { ok: false, status: 404, error: 'not_found' };
    list.splice(at, 1);
    return ok({ id });
  }) as unknown as SettingsRequest & ReturnType<typeof vi.fn>;
  const host: PhoneHost = { request, app: 'liveplanner' };
  return { host, calls, request };
}

const PIXEL: PushDeviceView = {
  id: 'pd_pixel',
  label: 'Chrome on Android',
  app: 'livediagram',
  createdAt: NOW - 3 * 86_400_000,
  lastSentAt: NOW - 3_600_000,
};

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('PhoneNotificationsRow', () => {
  it('lists the account’s devices with where each was turned on, by its logo', async () => {
    const { host } = fakeAccount([
      PIXEL,
      {
        ...PIXEL,
        id: 'pd_ipad',
        label: 'Safari on iPadOS',
        lastSentAt: null,
        app: 'liveworkspace',
      },
    ]);
    renderWithKit(<PhoneNotificationsRow phone={host} support="ready" now={NOW} />);
    const list = await screen.findByRole('list', { name: 'Devices' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toContain('Chrome on Android');
    expect(items[0]!.textContent).toContain('Last notified');
    expect(items[0]!.textContent).toContain('Turned on in livediagram');
    expect(items[1]!.textContent).toContain('Added');
    expect(items[1]!.textContent).toContain('Turned on in liveworkspace');
    expect(screen.getByRole('button', { name: 'Turn On' })).toBeTruthy();
  });

  it('Turn On subscribes, registers the device with the app it opened in, and marks it This Device', async () => {
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/new',
      toJSON: () => ({
        endpoint: 'https://fcm.googleapis.com/new',
        keys: { p256dh: 'p', auth: 'a' },
      }),
      unsubscribe: vi.fn(() => Promise.resolve(true)),
    };
    const worker = fakeServiceWorker(subscription);
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: () => Promise.resolve('granted'),
    });
    Object.defineProperty(window.navigator, 'serviceWorker', { value: worker, configurable: true });
    const { host, request } = fakeAccount([]);
    const { container } = renderWithKit(
      <PhoneNotificationsRow phone={host} support="ready" now={NOW} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Turn On' }));
    await waitFor(() => expect(container.querySelector('[data-phone-state="on"]')).toBeTruthy());
    expect(request).toHaveBeenCalledWith('/push/devices', 'POST', {
      endpoint: 'https://fcm.googleapis.com/new',
      keys: { p256dh: 'p', auth: 'a' },
      label: expect.any(String),
      app: 'liveplanner',
    });
    expect(screen.getByText('This Device')).toBeTruthy();
    expect(screen.getByText('On')).toBeTruthy();

    // Removing this device asks first, then unsubscribes the browser too.
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByText('Remove This Device?')).toBeTruthy();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Devices' })).toBeNull());
    expect(readThisDevice(window as unknown as PushWindow)).toBeNull();
    // @ts-expect-error: cleaning up the stand-in.
    delete window.navigator.serviceWorker;
  });

  it('says so when the browser says no, or accounts does not keep the device', async () => {
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: () => Promise.resolve('default'),
    });
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: fakeServiceWorker({ endpoint: 'x' }),
      configurable: true,
    });
    const { host } = fakeAccount([]);
    renderWithKit(<PhoneNotificationsRow phone={host} support="ready" now={NOW} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Turn On' }));
    expect(await screen.findByText(phoneCopy.subscribeFailed('dismissed'))).toBeTruthy();

    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: () => Promise.resolve('denied'),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Turn On' }));
    expect(await screen.findByText('Blocked')).toBeTruthy();
    // @ts-expect-error: cleaning up the stand-in.
    delete window.navigator.serviceWorker;
  });

  it('leaves the browser unsubscribed when accounts refuses the device', async () => {
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/new',
      toJSON: () => ({
        endpoint: 'https://fcm.googleapis.com/new',
        keys: { p256dh: 'p', auth: 'a' },
      }),
      unsubscribe: vi.fn(() => Promise.resolve(true)),
    };
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: () => Promise.resolve('granted'),
    });
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: fakeServiceWorker(subscription),
      configurable: true,
    });
    const request = vi.fn(async (_path: string, method = 'GET') =>
      method === 'GET'
        ? ok({ publicKey: 'AQID', devices: [] })
        : { ok: false, status: 503, error: 'x' },
    ) as unknown as SettingsRequest;
    renderWithKit(
      <PhoneNotificationsRow phone={{ request, app: 'liveworkspace' }} support="ready" now={NOW} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Turn On' }));
    expect(await screen.findByText(phoneCopy.registerFailed)).toBeTruthy();
    expect(subscription.unsubscribe).toHaveBeenCalled();
    // @ts-expect-error: cleaning up the stand-in.
    delete window.navigator.serviceWorker;
  });

  it('shows each state’s words and control', async () => {
    const off = fakeAccount([], null);
    const { container, unmount } = renderWithKit(
      <PhoneNotificationsRow phone={off.host} support="ready" now={NOW} />,
    );
    await waitFor(() =>
      expect(container.querySelector('[data-phone-state="off-here"]')).toBeTruthy(),
    );
    unmount();

    const iphone = fakeAccount([]);
    const second = renderWithKit(
      <PhoneNotificationsRow phone={iphone.host} support="needs-install" now={NOW} />,
    );
    expect(await second.findByText('Add to Home Screen')).toBeTruthy();
    second.unmount();

    let fail = true;
    const request = vi.fn(async () =>
      fail ? { ok: false, status: 500, error: 'x' } : ok({ publicKey: 'AQID', devices: [] }),
    ) as unknown as SettingsRequest;
    renderWithKit(
      <PhoneNotificationsRow
        phone={{ request, app: 'liveworkspace' }}
        support="unsupported"
        now={NOW}
      />,
    );
    const retry = await screen.findByRole('button', { name: 'Try Again' });
    fail = false;
    await act(async () => fireEvent.click(retry));
    expect(await screen.findByText('Not Available')).toBeTruthy();
  });

  it('removes another device, and says so when it can’t', async () => {
    const { host, calls } = fakeAccount([PIXEL]);
    renderWithKit(<PhoneNotificationsRow phone={host} support="ready" now={NOW} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Devices' })).toBeNull());
    expect(calls).toContain('DELETE /push/devices/pd_pixel');

    const failing = vi.fn(async (_path: string, method = 'GET') =>
      method === 'GET'
        ? ok({ publicKey: 'AQID', devices: [PIXEL] })
        : { ok: false, status: 500, error: 'x' },
    ) as unknown as SettingsRequest;
    renderWithKit(
      <PhoneNotificationsRow
        phone={{ request: failing, app: 'liveworkspace' }}
        support="ready"
        now={NOW}
      />,
    );
    const buttons = await screen.findAllByRole('button', { name: 'Remove' });
    fireEvent.click(buttons.at(-1)!);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText(phoneCopy.removeFailed)).toBeTruthy();
  });
});

describe('the Phone section in Notifications', () => {
  const base = { all: {}, set: () => {} };
  it('follows Email with Turn On and the four switches, only when the panel has a phone host', () => {
    const notifications = (section: Parameters<typeof accountCategories>[0]) =>
      accountCategories(section).find((c) => c.id === 'notifications')!.rows;
    expect(notifications(base).some((r) => r.section === PHONE_SECTION)).toBe(false);
    const { host } = fakeAccount([]);
    const rows = notifications({ ...base, phone: host }).filter((r) => r.section === PHONE_SECTION);
    expect(rows.map((r) => r.key)).toEqual([
      'phoneNotifications',
      'pushComments',
      'pushMentions',
      'pushActionAssigned',
      'pushThreadReplies',
    ]);
    expect(rows.slice(1).every((r) => r.kind === 'toggle' && r.value === true)).toBe(true);
  });
});
