import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import {
  appIcons,
  INSTALLED_START_URL,
  installManifest,
  PUSH_WORKER_PATH,
  pushWorkerResponse,
  pushWorkerSource,
} from './install';

describe('installManifest', () => {
  it('installs standalone at the Explorer, keyed by the root, every icon for any purpose', () => {
    const manifest = installManifest({
      name: 'liveplanner',
      description: 'Plans',
      themeColor: '#8B5CF6',
      icons: appIcons('liveplanner'),
    });
    expect(manifest).toMatchObject({
      id: '/',
      start_url: '/explorer',
      scope: '/',
      display: 'standalone',
      theme_color: '#8B5CF6',
      short_name: 'liveplanner',
    });
    expect(INSTALLED_START_URL).toBe('/explorer');
    expect(manifest.icons.map((i) => [i.src, i.purpose])).toEqual([
      ['/icon.svg', 'any'],
      ['/liveplanner-icon-256.png', 'any'],
      ['/liveplanner-icon-512.png', 'any'],
    ]);
  });
});

type Listener = (event: Record<string, unknown>) => void;

// Runs the worker's source against a stand-in `self`, as a browser would, and hands back its listeners.
function bootWorker(windows: { url: string; focus: () => Promise<unknown> }[] = []) {
  const listeners: Record<string, Listener> = {};
  const self = {
    addEventListener: (type: string, fn: Listener) => (listeners[type] = fn),
    skipWaiting: vi.fn(),
    clients: {
      claim: vi.fn(() => Promise.resolve()),
      matchAll: vi.fn(() => Promise.resolve(windows)),
      openWindow: vi.fn((url: string) => Promise.resolve(url)),
    },
    registration: { showNotification: vi.fn(() => Promise.resolve()) },
  };
  runInNewContext(pushWorkerSource('/liveplanner-icon-256.png'), { self, URL });
  return { listeners, self };
}

const waited = () => {
  const promises: Promise<unknown>[] = [];
  return { waitUntil: (p: Promise<unknown>) => promises.push(p), all: () => Promise.all(promises) };
};

describe('the push-only service worker', () => {
  it('has no fetch handler, so it never answers or caches a request', () => {
    const { listeners } = bootWorker();
    expect(Object.keys(listeners).sort()).toEqual([
      'activate',
      'install',
      'notificationclick',
      'push',
    ]);
    expect(pushWorkerSource('/i.png')).not.toMatch(/['"]fetch['"]|caches\./);
    expect(PUSH_WORKER_PATH).toBe('/push-worker.js');
  });

  it('takes over at once on install and activate', async () => {
    const { listeners, self } = bootWorker();
    listeners.install!({});
    expect(self.skipWaiting).toHaveBeenCalled();
    const w = waited();
    listeners.activate!(w);
    await w.all();
    expect(self.clients.claim).toHaveBeenCalled();
  });

  it('shows a push as a notification with the site icon, its tag and only an http(s) link', async () => {
    const { listeners, self } = bootWorker();
    const push = async (data: unknown) => {
      const w = waited();
      listeners.push!({ ...w, data });
      await w.all();
    };
    await push({
      json: () => ({
        title: 'Ada mentioned you',
        body: 'liveplanner',
        url: 'https://www.liveplanner.app/project/p1#item=c1',
        tag: 'p1:t1',
      }),
    });
    expect(self.registration.showNotification).toHaveBeenLastCalledWith('Ada mentioned you', {
      body: 'liveplanner',
      icon: '/liveplanner-icon-256.png',
      badge: '/liveplanner-icon-256.png',
      data: { url: 'https://www.liveplanner.app/project/p1#item=c1' },
      tag: 'p1:t1',
      renotify: true,
    });
    await push({ json: () => ({ title: 'x', url: 'javascript:alert(1)' }) });
    expect(self.registration.showNotification).toHaveBeenLastCalledWith('x', {
      body: '',
      icon: '/liveplanner-icon-256.png',
      badge: '/liveplanner-icon-256.png',
      data: { url: null },
    });
    await push({
      json: () => {
        throw new Error('not json');
      },
    });
    expect(self.registration.showNotification).toHaveBeenLastCalledWith(
      'liveworkspace',
      expect.objectContaining({ data: { url: null } }),
    );
    await push(null);
    await push({ json: () => ({ url: 'not a url' }) });
    expect(self.registration.showNotification).toHaveBeenCalledTimes(5);
  });

  it('on a tap focuses a window already at the link, else opens it, and does nothing without one', async () => {
    const url = 'https://www.livediagram.app/document/d1#t=a&el=b&open=comments';
    const focus = vi.fn(() => Promise.resolve());
    const { listeners, self } = bootWorker([
      { url: 'https://www.livediagram.app/explorer', focus: vi.fn() },
      { url, focus },
    ]);
    const tap = async (data: unknown) => {
      const close = vi.fn();
      const w = waited();
      listeners.notificationclick!({ ...w, notification: { close, data } });
      await w.all();
      expect(close).toHaveBeenCalled();
    };
    await tap({ url });
    expect(focus).toHaveBeenCalled();
    expect(self.clients.openWindow).not.toHaveBeenCalled();
    await tap({ url: 'https://www.liveplanner.app/project/p1' });
    expect(self.clients.openWindow).toHaveBeenCalledWith('https://www.liveplanner.app/project/p1');
    await tap(null);
    expect(self.clients.openWindow).toHaveBeenCalledTimes(1);
  });

  it('is served as JavaScript', async () => {
    const response = pushWorkerResponse('/i.png');
    expect(response.headers.get('content-type')).toContain('text/javascript');
    expect(await response.text()).toContain('"/i.png"');
  });
});
