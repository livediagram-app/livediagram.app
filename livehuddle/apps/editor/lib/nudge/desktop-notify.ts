// Desktop notifications for a nudge (docs/specs/012-collaboration/nudge.md "Desktop Notifications"): the browser's
// Notification API behind three small doors, so nothing else touches it. The permission prompt is only ever opened
// from a press (the Settings switch, the one-time offer's Turn On), never on load.

import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

export type NotifyPermission = 'granted' | 'denied' | 'default' | 'unsupported';

type NotificationCtor = typeof Notification;

function api(): NotificationCtor | null {
  if (typeof window === 'undefined') return null;
  const ctor = (window as unknown as { Notification?: NotificationCtor }).Notification;
  return typeof ctor === 'function' ? ctor : null;
}

/** What the browser says now; 'unsupported' where there is no Notification API. */
export function notificationPermission(): NotifyPermission {
  const ctor = api();
  if (!ctor) return 'unsupported';
  const p = ctor.permission;
  return p === 'granted' || p === 'denied' ? p : 'default';
}

/** Ask the browser, from a press. Resolves to what it answered; never throws. */
export async function askNotificationPermission(): Promise<NotifyPermission> {
  const ctor = api();
  if (!ctor) return 'unsupported';
  try {
    const answer = await ctor.requestPermission();
    return answer === 'granted' || answer === 'denied' ? answer : 'default';
  } catch {
    return notificationPermission();
  }
}

/**
 * Show one nudge's notification; clicking it focuses the tab and runs `onClick`. Returns whether one was shown. A
 * browser whose constructor throws (some phones allow notifications only from a service worker) shows nothing.
 */
export function showNudgeNotification(input: {
  title: string;
  body: string;
  tag: string;
  onClick: () => void;
}): boolean {
  const ctor = api();
  if (!ctor || ctor.permission !== 'granted') return false;
  try {
    const shown = new ctor(input.title, { body: input.body, tag: input.tag });
    shown.onclick = () => {
      window.focus();
      input.onClick();
      shown.close();
    };
    return true;
  } catch {
    debugLog('[nudge] notification failed');
    return false;
  }
}
