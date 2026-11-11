import { describe, expect, it } from 'vitest';
import { MAX_PUSH_NOTIFICATIONS, type PushNotification } from '@liveworkspace/settings/push';
import { sendPush } from './push';

const CREDENTIALS = {
  accountsUrl: 'https://www.liveworkspace.app/',
  clientId: 'liveplanner',
  clientSecret: 's',
};

const note = (i: number): PushNotification => ({
  userId: `user_${i}`,
  kind: 'mention',
  title: 'Ada mentioned you in Roadmap',
  url: 'https://www.liveplanner.app/project/p1',
});

describe('sendPush', () => {
  const recording = () => {
    const calls: { url: string; auth: string; count: number }[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      const { notifications } = JSON.parse(String(init.body)) as { notifications: unknown[] };
      calls.push({
        url,
        auth: (init.headers as Record<string, string>).authorization!,
        count: notifications.length,
      });
      return Response.json({ accepted: notifications.length }, { status: 202 });
    }) as unknown as typeof fetch;
    return { calls, fetcher };
  };
  const notes = (n: number) => Array.from({ length: n }, (_, i) => note(i));

  it('posts a save’s notifications to accounts in one request, with the client credentials', async () => {
    const { calls, fetcher } = recording();
    expect(await sendPush(CREDENTIALS, notes(MAX_PUSH_NOTIFICATIONS), fetcher)).toBe(
      MAX_PUSH_NOTIFICATIONS,
    );
    expect(calls.map((c) => c.count)).toEqual([MAX_PUSH_NOTIFICATIONS]);
    expect(calls[0]!.url).toBe('https://www.liveworkspace.app/api/account/internal/push');
    expect(calls[0]!.auth).toMatch(/^Basic /);
    // More than one request holds is split, all at once.
    calls.length = 0;
    expect(await sendPush(CREDENTIALS, notes(MAX_PUSH_NOTIFICATIONS + 20), fetcher)).toBe(
      MAX_PUSH_NOTIFICATIONS + 20,
    );
    expect(calls.map((c) => c.count)).toEqual([MAX_PUSH_NOTIFICATIONS, 20]);
  });

  it('throws on any refusal of a large request, too_many_notifications included', async () => {
    const tooMany = (async () =>
      Response.json(
        { error: 'too_many_notifications' },
        { status: 400 },
      )) as unknown as typeof fetch;
    await expect(sendPush(CREDENTIALS, notes(60), tooMany)).rejects.toThrow('push failed: 400');
    const refuse = (async () =>
      Response.json({ error: 'invalid_url' }, { status: 400 })) as unknown as typeof fetch;
    await expect(sendPush(CREDENTIALS, notes(60), refuse)).rejects.toThrow('push failed: 400');
    const garbled = (async () => new Response('nope', { status: 400 })) as unknown as typeof fetch;
    await expect(sendPush(CREDENTIALS, notes(60), garbled)).rejects.toThrow('push failed: 400');
    const down = (async () => new Response(null, { status: 503 })) as unknown as typeof fetch;
    await expect(sendPush(CREDENTIALS, notes(60), down)).rejects.toThrow('push failed: 503');
  });

  it('throws when accounts refuses, and sends nothing for nothing', async () => {
    const refuse = (async () =>
      Response.json({ error: 'invalid_url' }, { status: 400 })) as unknown as typeof fetch;
    await expect(sendPush(CREDENTIALS, [note(1)], refuse)).rejects.toThrow('push failed: 400');
    expect(await sendPush(CREDENTIALS, [], refuse)).toBe(0);
  });
});
