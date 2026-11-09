// @vitest-environment jsdom

// Desktop Notifications in Settings (docs/specs/012-collaboration/nudge.md "Desktop Notifications"): on only while
// wanted AND granted; turning it on asks from the press; blocked and unsupported say why. Every role has it.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY, type UserPreferences } from '@/lib/user-preferences';
import {
  NOTIFICATIONS_BLOCKED,
  NOTIFICATIONS_UNSUPPORTED,
  SettingsDesktopNotificationsRow,
} from './SettingsDesktopNotificationsRow';
import {
  SETTINGS_CATEGORIES,
  type SettingsDesktopNotificationsRowSpec,
} from './settings-catalogue';

const tracked = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track: tracked }));

class FakeNotification {
  static permission: NotificationPermission = 'default';
  static answer: NotificationPermission = 'granted';
  static requestPermission = vi.fn(() => Promise.resolve(FakeNotification.answer));
}
const win = window as unknown as { Notification?: unknown };

const row = SETTINGS_CATEGORIES.flatMap((c) => c.rows).find(
  (r) => r.key === 'desktopNotifications',
) as SettingsDesktopNotificationsRowSpec;

function draw(settings: UserPreferences = {}) {
  const onChange = vi.fn();
  render(<SettingsDesktopNotificationsRow row={row} settings={settings} onChange={onChange} />);
  return { onChange, toggle: () => screen.getByRole('switch', { name: /Desktop Notifications/ }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  FakeNotification.permission = 'default';
  FakeNotification.answer = 'granted';
  win.Notification = FakeNotification;
});
afterEach(() => {
  cleanup();
  delete win.Notification;
});

describe('SettingsDesktopNotificationsRow', () => {
  it('sits beside Join and Leave Sounds in Notifications, In the Editor', () => {
    const rows = SETTINGS_CATEGORIES.find((c) => c.id === 'notifications')!.rows;
    const keys = rows.map((r) => r.key);
    expect(keys.indexOf('desktopNotifications')).toBe(keys.indexOf('joinLeaveSounds') + 1);
    expect(row.section).toBe('In the Editor');
    expect(row.label).toBe('Desktop Notifications');
  });

  it('reads off until the browser grants, and asks from the press', async () => {
    const { onChange, toggle } = draw();
    expect(toggle().getAttribute('aria-checked')).toBe('false');
    await act(async () => {
      fireEvent.click(toggle());
      await Promise.resolve();
    });
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      desktopNotifications: true,
      desktopNotificationsOffered: true,
    });
    expect(tracked).toHaveBeenCalledWith('UI', 'Toggled', 'DesktopNotificationsOn');
  });

  it('stays off when the prompt is refused, and then says it is blocked', async () => {
    FakeNotification.answer = 'denied';
    const { onChange, toggle } = draw();
    await act(async () => {
      fireEvent.click(toggle());
      await Promise.resolve();
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(NOTIFICATIONS_BLOCKED)).toBeTruthy();
  });

  it('reads on while wanted and granted, and turns off without asking', () => {
    FakeNotification.permission = 'granted';
    const { onChange, toggle } = draw();
    expect(toggle().getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle());
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith({
      desktopNotifications: false,
      desktopNotificationsOffered: true,
    });
  });

  it('turns on at once when already granted', () => {
    FakeNotification.permission = 'granted';
    const { onChange, toggle } = draw({ desktopNotifications: false });
    expect(toggle().getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle());
    expect(onChange).toHaveBeenCalledWith({
      desktopNotifications: true,
      desktopNotificationsOffered: true,
    });
  });

  it('is greyed with a reason when blocked or unsupported', () => {
    FakeNotification.permission = 'denied';
    draw();
    expect(screen.getByText(NOTIFICATIONS_BLOCKED)).toBeTruthy();
    cleanup();
    delete win.Notification;
    draw();
    expect(screen.getByText(NOTIFICATIONS_UNSUPPORTED)).toBeTruthy();
  });

  it('keeps a setting changed while the browser prompt was open', async () => {
    let answer!: (p: NotificationPermission) => void;
    FakeNotification.requestPermission.mockImplementationOnce(
      () => new Promise<NotificationPermission>((r) => (answer = r)),
    );
    const before: UserPreferences = { joinLeaveSounds: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(before));
    const onChange = vi.fn();
    const view = render(
      <SettingsDesktopNotificationsRow row={row} settings={before} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('switch', { name: /Desktop Notifications/ }));
    // While the prompt is up, Join and Leave Sounds goes off.
    const during: UserPreferences = { joinLeaveSounds: false };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(during));
    view.rerender(
      <SettingsDesktopNotificationsRow row={row} settings={during} onChange={onChange} />,
    );
    await act(async () => {
      answer('granted');
      await Promise.resolve();
    });
    expect(onChange).toHaveBeenCalledWith({
      joinLeaveSounds: false,
      desktopNotifications: true,
      desktopNotificationsOffered: true,
    });
    localStorage.clear();
  });
});
