// Phone notifications' contract (liveworkspace/docs/specs/003-accounts/push.md), plain data that every side reads: the
// apps' servers when they ask accounts to send (@liveworkspace/auth-client sendPush), the accounts Worker that checks
// and sends, the Settings panel's Phone rows (@liveworkspace/settings-ui) and the push-only service worker each site
// serves. Worker-safe and DOM-free.

// What a phone notification can be about. Each has its own switch in the `all` scope (PUSH_SETTING_KEYS), on unless
// turned off: turning phone notifications on for a device is the opt-in.
export const PUSH_KINDS = ['comment', 'mention', 'action', 'threadReply'] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

export function isPushKind(value: unknown): value is PushKind {
  return typeof value === 'string' && (PUSH_KINDS as readonly string[]).includes(value);
}

// The switch each kind is sent under, mirroring the email switches (notifyComments, notifyMentions,
// notifyActionAssigned), plus replies in a thread the person has commented in, which has no email.
export const PUSH_SETTING_KEYS = {
  comment: 'pushComments',
  mention: 'pushMentions',
  action: 'pushActionAssigned',
  threadReply: 'pushThreadReplies',
} as const satisfies Record<PushKind, string>;

export type PushSettingKey = (typeof PUSH_SETTING_KEYS)[PushKind];

// One notification an app asks accounts to send: who, what about, a short title and the link a tap opens. Never a
// comment's words or anything of the item beyond its name, which the recipient can already read.
export interface PushNotification {
  userId: string;
  kind: PushKind;
  title: string;
  url: string;
  // Notifications with the same tag replace each other on the device (a burst of replies in one thread is one).
  tag?: string;
}

// What the service worker receives, decrypted: the title, the app it came from (shown as the body) and the link.
export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

// The most notifications one request to accounts carries; a caller with more sends more requests.
export const MAX_PUSH_NOTIFICATIONS = 50;
// A notification's title, in UTF-16 units: one line on a lock screen.
export const PUSH_TITLE_MAX = 120;
export const PUSH_TAG_MAX = 64;
// The most devices one account keeps: registering another drops the oldest.
export const MAX_PUSH_DEVICES = 10;
// A device's label in the list.
export const PUSH_LABEL_MAX = 80;

// Where a device was turned on: liveworkspace.app or an app. Only what the device list shows beside it (each with
// its logo); a device still hears from every app.
export const PUSH_DEVICE_APPS = [
  'liveworkspace',
  'livediagram',
  'liveplanner',
  'livedocuments',
  'livedesign',
  'livehuddle',
] as const;
export type PushDeviceApp = (typeof PUSH_DEVICE_APPS)[number];

export function isPushDeviceApp(value: unknown): value is PushDeviceApp {
  return typeof value === 'string' && (PUSH_DEVICE_APPS as readonly string[]).includes(value);
}

// The account API's paths for the person's own devices, under /api/account (the session on liveworkspace.app, the
// app's bearer through `/api/workspace/account` on an app's address): GET lists them with the deployment's VAPID
// public key, POST registers this browser, DELETE `<id>` removes one.
export const PUSH_DEVICES_PATH = '/push/devices';

// The push-only service worker each site serves at its root (no fetch handler: load-recovery.md keeps no offline
// copy), and the scope it registers under.
export const PUSH_WORKER_PATH = '/push-worker.js';
