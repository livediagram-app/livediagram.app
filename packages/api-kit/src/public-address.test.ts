// Which addresses a server-side fetch may reach: never a private, loopback, link-local or reserved one.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dohResolve, isPrivateAddress, resolvesPublic } from './public-address';

afterEach(() => vi.unstubAllGlobals());

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
