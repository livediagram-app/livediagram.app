import { describe, expect, it } from 'vitest';
import type { PushNotification } from '@liveworkspace/settings/push';
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
  it('posts the notifications to accounts in batches of fifty, with the client credentials', async () => {
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
    const taken = await sendPush(
      CREDENTIALS,
      Array.from({ length: 120 }, (_, i) => note(i)),
      fetcher,
    );
    expect(taken).toBe(120);
    expect(calls.map((c) => c.count)).toEqual([50, 50, 20]);
    expect(calls[0]!.url).toBe('https://www.liveworkspace.app/api/account/internal/push');
    expect(calls[0]!.auth).toMatch(/^Basic /);
  });

  it('throws when accounts refuses, and sends nothing for nothing', async () => {
    const refuse = (async () =>
      Response.json({ error: 'invalid_url' }, { status: 400 })) as unknown as typeof fetch;
    await expect(sendPush(CREDENTIALS, [note(1)], refuse)).rejects.toThrow('push failed: 400');
    expect(await sendPush(CREDENTIALS, [], refuse)).toBe(0);
  });
});
