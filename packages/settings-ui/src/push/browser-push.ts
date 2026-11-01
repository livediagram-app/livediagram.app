// This browser's side of phone notifications (liveworkspace/docs/specs/003-accounts/push.md "Settings"): whether it
// can take them, and subscribing and unsubscribing through the site's push-only service worker. Nothing here runs on
// page load: the worker is registered only when someone turns phone notifications on, and read back only while the
// Settings panel shows them.
import { PUSH_WORKER_PATH } from '@liveworkspace/settings/push';
import { deviceName } from '../profile/SecurityRows';

/** What this browser can do: take them now, needs the app on the Home Screen first (an iPhone or iPad in Safari),
 *  has blocked them for this site, or has no Web Push at all. */
export type PhoneSupport = 'ready' | 'needs-install' | 'blocked' | 'unsupported';

/** The parts of `window` this reads, so a test can hand in its own. */
export type PushWindow = {
  navigator: Navigator & { standalone?: boolean };
  matchMedia?: (query: string) => { matches: boolean };
  Notification?: {
    permission: NotificationPermission;
    requestPermission(): Promise<NotificationPermission>;
  };
  PushManager?: unknown;
  localStorage?: Storage;
};

const browserWindow = (): PushWindow | null =>
  typeof window === 'undefined' ? null : (window as unknown as PushWindow);

/** An iPhone or iPad, including an iPad that says it is a Mac. */
export function isAppleMobile(w: PushWindow): boolean {
  const { userAgent, maxTouchPoints } = w.navigator;
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** Opened from the Home Screen (or as an installed app). */
export function isInstalled(w: PushWindow): boolean {
  return (
    w.navigator.standalone === true || w.matchMedia?.('(display-mode: standalone)').matches === true
  );
}

export function phoneSupport(w: PushWindow | null = browserWindow()): PhoneSupport {
  if (!w) return 'unsupported';
  const capable =
    'serviceWorker' in w.navigator && w.PushManager !== undefined && w.Notification !== undefined;
  // iOS and iPadOS give a page Web Push only once it is on the Home Screen and opened from there.
  if (isAppleMobile(w) && !isInstalled(w)) return 'needs-install';
  if (!capable) return 'unsupported';
  return w.Notification!.permission === 'denied' ? 'blocked' : 'ready';
}

/** The device list's name for this browser: its browser and system (the app it was turned on in is shown by its
 *  logo beside it). */
export function pushDeviceLabel(userAgent: string): string {
  return deviceName(userAgent);
}

/** The VAPID public key (base64url) as the bytes `applicationServerKey` takes. */
export function keyBytes(publicKey: string): Uint8Array<ArrayBuffer> {
  const plain = publicKey.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(plain + '='.repeat((4 - (plain.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** This site's push subscription, if it has one (never registers the worker). */
export async function currentSubscription(
  w: PushWindow | null = browserWindow(),
): Promise<PushSubscription | null> {
  if (!w || !('serviceWorker' in w.navigator)) return null;
  try {
    const registration = await w.navigator.serviceWorker.getRegistration('/');
    return (await registration?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

export type SubscribeResult =
  | { ok: true; subscription: PushSubscription }
  | { ok: false; reason: 'blocked' | 'dismissed' | 'failed' };

// How long subscribing may take before Turn On says it couldn't.
export const SUBSCRIBE_TIMEOUT_MS = 20_000;

/** Asks permission, registers the push-only worker and subscribes with the deployment's key. */
export async function subscribeThisBrowser(
  publicKey: string,
  w: PushWindow | null = browserWindow(),
): Promise<SubscribeResult> {
  if (!w?.Notification || !('serviceWorker' in w.navigator)) return { ok: false, reason: 'failed' };
  const permission = await w.Notification.requestPermission();
  if (permission === 'denied') return { ok: false, reason: 'blocked' };
  if (permission !== 'granted') return { ok: false, reason: 'dismissed' };
  try {
    await w.navigator.serviceWorker.register(PUSH_WORKER_PATH, { scope: '/' });
    const registration = await w.navigator.serviceWorker.ready;
    // A browser that can't reach its push service can leave this pending for good; the row must not stay busy.
    const subscription = await Promise.race([
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('push_subscribe_timeout')), SUBSCRIBE_TIMEOUT_MS),
      ),
    ]);
    return { ok: true, subscription };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

// Which of the listed devices is this browser: its id and endpoint, kept per site so the list can mark This Device.
const THIS_DEVICE_KEY = 'liveworkspace:push-device:v1';

export type ThisDevice = { id: string; endpoint: string };

export function readThisDevice(w: PushWindow | null = browserWindow()): ThisDevice | null {
  try {
    const raw = w?.localStorage?.getItem(THIS_DEVICE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<ThisDevice>) : null;
    return typeof parsed?.id === 'string' && typeof parsed.endpoint === 'string'
      ? { id: parsed.id, endpoint: parsed.endpoint }
      : null;
  } catch {
    return null;
  }
}

export function writeThisDevice(
  device: ThisDevice | null,
  w: PushWindow | null = browserWindow(),
): void {
  try {
    if (device) w?.localStorage?.setItem(THIS_DEVICE_KEY, JSON.stringify(device));
    else w?.localStorage?.removeItem(THIS_DEVICE_KEY);
  } catch {
    // Private mode or storage off: the list just can't mark This Device.
  }
}
