// The apps' old MCP addresses (liveworkspace/docs/specs/021-mcp/mcp.md "The app MCPs fold in"): which hosts count, and
// every sign-in endpoint there refusing with the pointer. Serving their /mcp is pinned in router.test.ts.
import { describe, expect, it } from 'vitest';
import { ONE_MCP_URL, oldHostApp, oldHostSignIn } from './old-hosts';

const at = (path: string, init?: RequestInit, host = 'mcp.livediagram.app') => {
  const request = new Request(`https://${host}${path}`, init);
  return oldHostSignIn(request, new URL(request.url));
};

describe('oldHostApp', () => {
  it('names the app of an old address, production or staging', () => {
    expect(oldHostApp('mcp.livediagram.app')).toBe('livediagram');
    expect(oldHostApp('mcp-staging.liveknowledge.app')).toBe('liveknowledge');
  });

  it('leaves the one MCP, livehuddle and anything else alone', () => {
    for (const host of [
      'mcp.liveworkspace.app',
      'mcp.livehuddle.app',
      'www.livediagram.app',
      'localhost',
    ])
      expect(oldHostApp(host)).toBeNull();
  });
});

describe('sign-in at an old address', () => {
  it('is refused at registration, authorize, token and device sign-in, naming the one MCP', async () => {
    const register = at('/oauth/register', { method: 'POST', body: '{}' })!;
    expect(register.status).toBe(400);
    expect(await register.json()).toMatchObject({ error: 'invalid_client_metadata' });
    const authorize = at('/oauth/authorize?client_id=x')!;
    expect(authorize.status).toBe(410);
    expect(await authorize.text()).toContain(ONE_MCP_URL);
    const token = at('/oauth/token', { method: 'POST', body: 'grant_type=authorization_code' })!;
    expect(await token.json()).toMatchObject({ error: 'invalid_grant' });
    const device = at('/oauth/device_authorization', { method: 'POST' })!;
    expect(device.status).toBe(410);
    expect(JSON.stringify(await device.json())).toContain(ONE_MCP_URL);
  });

  it('still answers discovery, with no device sign-in, so a client finds the refusal', async () => {
    const meta = await at('/.well-known/oauth-authorization-server')!.json<
      Record<string, unknown>
    >();
    expect(meta.registration_endpoint).toBe('https://mcp.livediagram.app/oauth/register');
    expect(meta).not.toHaveProperty('device_authorization_endpoint');
    expect(meta.service_documentation).toBe(ONE_MCP_URL);
  });

  it('points a staging address at staging’s one MCP', async () => {
    const register = at('/oauth/register', { method: 'POST' }, 'mcp-staging.livedesign.app')!;
    expect(JSON.stringify(await register.json())).toContain(
      'https://mcp-staging.liveworkspace.app/mcp',
    );
  });

  it('leaves /mcp, /health and the server card to the router', () => {
    for (const path of ['/mcp', '/health', '/.well-known/mcp/server-card.json'])
      expect(at(path)).toBeNull();
  });
});
