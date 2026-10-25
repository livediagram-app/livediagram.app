import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { createTokenStandIn } from './e2e-token-stand-in';

describe('the e2e stacks’ accounts token and profile stand-in', () => {
  it('verifies a seeded token with its teams, reports it live, and forgets it once revoked', () => {
    const standIn = createTokenStandIn('/e2e/accounts', (userId) =>
      userId === 'user_a' ? [{ id: 't1', name: 'Team', role: 'admin' }] : [],
    );
    const seeded = standIn.seed({ userId: 'user_a', name: 'agent' });
    expect(seeded.secret).toMatch(/^lwt_/);
    expect(standIn.answer('/tokens/verify', { token: seeded.secret })).toEqual({
      status: 200,
      body: {
        tokenId: seeded.id,
        userId: 'user_a',
        name: 'agent',
        email: null,
        readOnly: false,
        expiresAt: seeded.expiresAt,
        teams: [{ id: 't1', name: 'Team', role: 'admin' }],
      },
    });
    expect(standIn.answer('/tokens/live', { ids: [seeded.id, 'other'] })).toEqual({
      status: 200,
      body: { live: [seeded.id] },
    });
    expect(standIn.answer('/tokens/revoke', { token: seeded.secret })).toEqual({ status: 204 });
    expect(standIn.answer('/tokens/verify', { token: seeded.secret })?.status).toBe(404);
    expect(standIn.answer('/settings', {})).toBeNull();
  });

  it('keeps the profiles the api writes, and reads back only the ones it has', () => {
    const standIn = createTokenStandIn('/e2e/accounts');
    expect(standIn.answer('/profiles/read', { ids: ['user_a'] })).toEqual({
      status: 200,
      body: { profiles: [] },
    });
    const written = standIn.answer('/profiles/write', { owner: 'user_a', name: '  Webber  ' });
    expect(written).toMatchObject({
      status: 200,
      body: { profile: { id: 'user_a', name: 'Webber', color: null } },
    });
    standIn.answer('/profiles/write', { owner: 'user_a', color: '#f59e0b' });
    expect(
      standIn.answer('/profiles/read', { ids: ['user_a', 'user_a', 'guest_b'] }),
    ).toMatchObject({
      status: 200,
      body: { profiles: [{ id: 'user_a', name: 'Webber', color: '#f59e0b' }] },
    });
    // A blank name clears it; the refusals are the accounts Worker's.
    standIn.answer('/profiles/write', { owner: 'user_a', name: ' ' });
    expect(standIn.answer('/profiles/read', { ids: ['user_a'] })).toMatchObject({
      body: { profiles: [{ name: null, color: '#f59e0b' }] },
    });
    expect(standIn.answer('/profiles/write', { owner: 'user_a' })).toEqual({
      status: 400,
      body: { error: 'nothing_to_change' },
    });
    expect(standIn.answer('/profiles/write', { owner: 'nobody', name: 'x' })?.status).toBe(400);
    expect(standIn.answer('/profiles/write', { owner: 'user_a', name: 7 })?.status).toBe(400);
    expect(standIn.answer('/profiles/read', { ids: 'user_a' })?.status).toBe(400);
    expect(
      standIn.answer('/profiles/read', { ids: Array.from({ length: 101 }, (_, i) => `user_${i}`) })
        ?.status,
    ).toBe(400);
  });

  it('serves the seed route and the account API over http', async () => {
    const standIn = createTokenStandIn('/e2e/accounts');
    const server = http.createServer((req, res) => {
      if (!standIn.serve(req, res, new URL(req.url!, 'http://x').pathname)) {
        res.writeHead(418);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/e2e/accounts`;
    try {
      const seeded = await fetch(`${base}/__seed/token`, {
        method: 'POST',
        body: JSON.stringify({ userId: 'user_b', readOnly: true }),
      });
      const { secret } = (await seeded.json()) as { secret: string };
      const verified = await fetch(`${base}/api/account/internal/tokens/verify`, {
        method: 'POST',
        body: JSON.stringify({ token: secret }),
      });
      expect(await verified.json()).toMatchObject({ userId: 'user_b', readOnly: true });
      await fetch(`${base}/api/account/internal/profiles/write`, {
        method: 'POST',
        body: JSON.stringify({ owner: 'user_b', name: 'Bea' }),
      });
      const read = await fetch(`${base}/api/account/internal/profiles/read`, {
        method: 'POST',
        body: JSON.stringify({ ids: ['user_b'] }),
      });
      expect(await read.json()).toMatchObject({ profiles: [{ id: 'user_b', name: 'Bea' }] });
      expect((await fetch(`${base}/api/account/internal/settings`)).status).toBe(418);
    } finally {
      server.close();
    }
  });
});
