// Asking accounts to send phone notifications (liveworkspace/docs/specs/003-accounts/push.md "Sending"), beside
// notificationRecipients (./notify.ts): the app decides who hears of what and words the title; accounts keeps the
// devices, the switches and the VAPID key, and sends after it has answered. The contract is
// @liveworkspace/settings/push.
import { MAX_PUSH_NOTIFICATIONS, type PushNotification } from '@liveworkspace/settings/push';
import { call } from './account';
import type { ClientCredentials } from './oauth';

function batchesOf(notifications: readonly PushNotification[], size: number) {
  const batches: PushNotification[][] = [];
  for (let at = 0; at < notifications.length; at += size)
    batches.push(notifications.slice(at, at + size));
  return batches;
}

/**
 * Hands these notifications to accounts (`POST /api/account/internal/push`), MAX_PUSH_NOTIFICATIONS a request, all
 * requests at once: a save's notifications are one request. Answers how many accounts took; throws when a request
 * is refused, so a caller logs it.
 */
export async function sendPush(
  credentials: ClientCredentials,
  notifications: readonly PushNotification[],
  fetcher: typeof fetch = fetch,
): Promise<number> {
  const post = async (batch: PushNotification[]): Promise<number> => {
    const response = await call(
      credentials,
      '/push',
      { method: 'POST', body: { notifications: batch } },
      fetcher,
    );
    if (response.ok) return ((await response.json()) as { accepted: number }).accepted;
    throw new Error(`push failed: ${response.status}`);
  };
  const taken = await Promise.all(batchesOf(notifications, MAX_PUSH_NOTIFICATIONS).map(post));
  return taken.reduce((n, t) => n + t, 0);
}
