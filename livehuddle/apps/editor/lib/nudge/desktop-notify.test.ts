// @vitest-environment jsdom

// The Notification API's three doors (docs/specs/012-collaboration/nudge.md "Desktop Notifications").
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  askNotificationPermission,
  notificationPermission,
  showNudgeNotification,
} from './desktop-notify';

const win = window as unknown as { Notification?: unknown };
afterEach(() => {
  delete win.Notification;
});

describe('desktop-notify', () => {
  it('is unsupported without the API', async () => {
    expect(notificationPermission()).toBe('unsupported');
    expect(await askNotificationPermission()).toBe('unsupported');
    expect(showNudgeNotification({ title: 't', body: 'b', tag: 'x', onClick: vi.fn() })).toBe(
      false,
    );
  });

  it('reads the permission, an unknown value reading as not asked', () => {
    win.Notification = Object.assign(function N() {}, { permission: 'granted' });
    expect(notificationPermission()).toBe('granted');
    win.Notification = Object.assign(function N() {}, { permission: 'weird' });
    expect(notificationPermission()).toBe('default');
  });

  it('asks, and survives a browser whose request throws', async () => {
    win.Notification = Object.assign(function N() {}, {
      permission: 'default',
      requestPermission: () => Promise.resolve('default'),
    });
    expect(await askNotificationPermission()).toBe('default');
    win.Notification = Object.assign(function N() {}, {
      permission: 'denied',
      requestPermission: () => Promise.reject(new Error('no')),
    });
    expect(await askNotificationPermission()).toBe('denied');
  });

  it('shows nothing unless granted, and nothing when the constructor throws', () => {
    win.Notification = Object.assign(
      function N() {
        throw new Error('service worker only');
      },
      { permission: 'granted' },
    );
    expect(showNudgeNotification({ title: 't', body: 'b', tag: 'x', onClick: vi.fn() })).toBe(
      false,
    );
    win.Notification = Object.assign(function N() {}, { permission: 'default' });
    expect(showNudgeNotification({ title: 't', body: 'b', tag: 'x', onClick: vi.fn() })).toBe(
      false,
    );
  });
});
