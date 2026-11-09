'use client';

import { useState } from 'react';
import { SettingsToggleRowView } from '@liveworkspace/settings-ui';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import {
  askNotificationPermission,
  notificationPermission,
  type NotifyPermission,
} from '@/lib/nudge/desktop-notify';
import { track } from '@/lib/telemetry';
import { rebaseUserPreferences, type UserPreferences } from '@/lib/user-preferences';
import type { SettingsDesktopNotificationsRowSpec } from './settings-catalogue';

// Desktop Notifications (docs/specs/012-collaboration/nudge.md "Desktop Notifications"): on only while the preference
// is on AND the browser has granted permission. Turning it on asks the browser, from this press; refused, it stays
// off. Blocked or unsupported, it is greyed and says why; the nudge's sound and toast work either way.

export const NOTIFICATIONS_BLOCKED =
  "Your browser blocks notifications from this site. Allow them in your browser's site settings to turn this on.";
export const NOTIFICATIONS_UNSUPPORTED = "This browser can't show desktop notifications.";

export function SettingsDesktopNotificationsRow({
  row,
  settings,
  onChange,
}: {
  row: SettingsDesktopNotificationsRowSpec;
  settings: UserPreferences;
  onChange: (next: UserPreferences) => void;
}) {
  const [permission, setPermission] = useState<NotifyPermission>(notificationPermission);
  // The browser's prompt can stay open while other settings change: the write lands on the freshest preferences
  // (this render's, rebased onto what storage holds now), never on the ones the press saw.
  const latest = useLatest(settings);
  const wanted = settings.desktopNotifications !== false;
  const blocked = permission === 'denied' || permission === 'unsupported';
  const write = (next: boolean) => {
    // Fired before the write, as every Settings flip is (docs/specs/017-telemetry/telemetry.md).
    track('UI', 'Toggled', next ? 'DesktopNotificationsOn' : 'DesktopNotificationsOff');
    const now = latest.current;
    onChange(
      rebaseUserPreferences(now, {
        ...now,
        desktopNotifications: next,
        desktopNotificationsOffered: true,
      }),
    );
  };
  const flip = (next: boolean) => {
    if (!next) return write(false);
    if (permission === 'granted') return write(true);
    void askNotificationPermission().then((answer) => {
      setPermission(answer);
      if (answer === 'granted') write(true);
    });
  };
  return (
    <SettingsToggleRowView
      row={row}
      checked={wanted && permission === 'granted'}
      onChange={flip}
      disabled={blocked}
      notice={
        permission === 'denied'
          ? NOTIFICATIONS_BLOCKED
          : permission === 'unsupported'
            ? NOTIFICATIONS_UNSUPPORTED
            : undefined
      }
    />
  );
}
