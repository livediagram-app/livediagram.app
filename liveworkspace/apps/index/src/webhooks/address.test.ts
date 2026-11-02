// Where a webhook may send: HTTPS on 443 to a name resolving only to public addresses (webhooks.md "Security").
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dohResolve, isPrivateAddress, parseWebhookUrl, resolvesPublic } from './address';

afterEach(() => vi.unstubAllGlobals());

describe('parseWebhookUrl', () => {
  it('takes an HTTPS URL on 443 with a host name, keeping its host', () => {
    const ok = parseWebhookUrl('https://Hooks.Example.com:443/in?x=1', 'json');
    expect(ok).toMatchObject({ ok: true, host: 'hooks.example.com' });
    expect(parseWebhookUrl('https://example.com./x', 'json')).toMatchObject({
      host: 'example.com',
    });
  });

  it.each([
    ['not a string', 42],
    ['empty', ''],
    ['too long', `https://example.com/${'a'.repeat(2048)}`],
    ['not a URL', 'example.com/hook'],
    ['plain HTTP', 'http://example.com/hook'],
    ['credentials', 'https://user:pass@example.com/hook'],
    ['another port', 'https://example.com:8443/hook'],
  ])('refuses %s as invalid', (_, url) => {
    expect(parseWebhookUrl(url, 'json')).toEqual({ ok: false, error: 'webhook_url_invalid' });
  });

  it.each([
    'https://127.0.0.1/hook',
    'https://0x7f000001/hook',
    'https://8.8.8.8/hook',
    'https://[::1]/hook',
    'https://localhost/hook',
    'https://intranet/hook',
    'https://printer.local/hook',
    'https://db.internal/hook',
    'https://nas.home.arpa/hook',
    'https://router.lan/hook',
    'https://a.localhost/hook',
  ])('refuses %s as private: an address, or a name that never leaves a network', (url) => {
    expect(parseWebhookUrl(url, 'json')).toEqual({ ok: false, error: 'webhook_url_private' });
  });

  it('holds Slack and Teams to their own hosts', () => {
    expect(parseWebhookUrl('https://hooks.slack.com/services/T/B/x', 'slack').ok).toBe(true);
    expect(parseWebhookUrl('https://hooks.slack.com/other', 'slack').ok).toBe(false);
    expect(parseWebhookUrl('https://example.com/services/T', 'slack').ok).toBe(false);
    const flow =
      'https://prod-01.westus.logic.azure.com:443/workflows/abc/triggers/manual/paths/invoke';
    expect(parseWebhookUrl(flow, 'teams').ok).toBe(true);
    const direct =
      'https://default1.ab.environment.api.powerplatform.com/powerautomate/automations/direct/workflows/1';
    expect(parseWebhookUrl(direct, 'teams').ok).toBe(true);
    expect(parseWebhookUrl('https://outlook.office.com/webhook/x', 'teams').ok).toBe(false);
  });
});

describe('isPrivateAddress', () => {
  it.each([
    '0.1.2.3',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.0.0.1',
    '192.0.2.1',
    '192.168.1.1',
    '198.18.0.1',
    '203.0.113.9',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    '::ffff:10.0.0.1',
    '64:ff9b::a00:1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'fec0::1',
    'ff02::1',
    '2001:db8::1',
    '2002:a00:1::1',
    '100::1',
    'not an address',
    '300.1.1.1',
  ])('blocks %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '172.32.0.1', '104.16.0.1', '2606:4700::1111', '::ffff:8.8.8.8', '100:1::1'])(
    'lets %s through',
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    },
  );
});

describe('resolving', () => {
  it('is public only when every answer is', async () => {
    expect(await resolvesPublic('a.com', async () => ['8.8.8.8', '2606:4700::1'])).toBe('public');
    expect(await resolvesPublic('a.com', async () => ['8.8.8.8', '10.0.0.1'])).toBe('private');
    expect(await resolvesPublic('a.com', async () => [])).toBe('unresolved');
    expect(await resolvesPublic('a.com', async () => null)).toBe('unresolved');
  });

  it('asks DNS over HTTPS for A and AAAA, keeping only those answers', async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', async (input: string) => {
      asked.push(input);
      const type = new URL(input).searchParams.get('type');
      return Response.json({
        Answer:
          type === 'A'
            ? [
                { type: 5, data: 'alias.example.com.' },
                { type: 1, data: '93.184.216.34' },
              ]
            : [{ type: 28, data: '2606:2800::1' }],
      });
    });
    expect(await dohResolve('example.com')).toEqual(['93.184.216.34', '2606:2800::1']);
    expect(asked.map((u) => new URL(u).searchParams.get('type')).sort()).toEqual(['A', 'AAAA']);
  });

  it('answers null when the resolver fails, and nothing for a name with no answer', async () => {
    vi.stubGlobal('fetch', async () => new Response('no', { status: 502 }));
    expect(await dohResolve('example.com')).toBeNull();
    vi.stubGlobal('fetch', async () => Response.json({ Status: 3 }));
    expect(await dohResolve('nowhere.example')).toEqual([]);
  });
});
