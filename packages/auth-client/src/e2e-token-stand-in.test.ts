import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { createTokenStandIn } from './e2e-token-stand-in';

describe('the e2e stacks’ accounts token stand-in', () => {
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
      expect((await fetch(`${base}/api/account/internal/settings`)).status).toBe(418);
    } finally {
      server.close();
    }
  });
});
