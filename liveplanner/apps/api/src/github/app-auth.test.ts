import { createPublicKey, createVerify, generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appJwt, installationToken, pkcs8Of } from './app-auth';
import {
  appInstallation,
  exchangeCode,
  installationRepositories,
  revokeUserToken,
} from './github-api';

// The App's own credentials (blueprint "Part 2" "Talking to GitHub"): its RS256 JWT from the key as GitHub gives it
// (PKCS#1) or as PKCS#8, and installation tokens minted per call, asking for metadata alone, never kept.

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = (type: 'pkcs1' | 'pkcs8') => String(privateKey.export({ type, format: 'pem' }));
const PKCS1 = pem('pkcs1');
const PKCS8 = pem('pkcs8');

const bytesOf = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const fromB64url = (s: string) =>
  bytesOf(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
// The PKCS#8 bytes node writes, read off its own PEM.
const DER = bytesOf(
  PKCS8.split('\n')
    .filter((line) => line !== '' && !line.startsWith('-----'))
    .join(''),
);

function verified(jwt: string): Record<string, unknown> {
  const [h, p, sig] = jwt.split('.');
  const v = createVerify('RSA-SHA256');
  v.update(`${h}.${p}`);
  expect(v.verify(publicKey, fromB64url(sig!))).toBe(true);
  expect(JSON.parse(text(fromB64url(h!)))).toEqual({ alg: 'RS256', typ: 'JWT' });
  return JSON.parse(text(fromB64url(p!))) as Record<string, unknown>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('pkcs8Of', () => {
  it('wraps a PKCS#1 key into the PKCS#8 node itself writes', () => {
    expect(pkcs8Of(PKCS1)).toEqual(DER);
    expect(pkcs8Of(PKCS8)).toEqual(DER);
  });

  it('reads a key pasted on one line with \\n escapes', () => {
    expect(pkcs8Of(PKCS1.replace(/\n/g, '\\n'))).toEqual(DER);
  });

  it('refuses anything that is not a private key', () => {
    const pub = String(createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }));
    for (const text of [
      '',
      'probe-key',
      pub,
      '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----',
      '-----BEGIN PRIVATE KEY-----\n!!!\n',
    ])
      expect(pkcs8Of(text), text.slice(0, 30)).toBeNull();
  });

  it('wraps a short key with a one-byte length', () => {
    const tiny = `-----BEGIN RSA PRIVATE KEY-----\n${btoa(String.fromCharCode(1, 2, 3))}\n-----END RSA PRIVATE KEY-----`;
    expect([...pkcs8Of(tiny)!.slice(0, 2)]).toEqual([0x30, 3 + 3 + 15 + 2]);
  });
});

describe('appJwt', () => {
  it('signs RS256 with either key form, backdated a minute, good for 9 minutes', async () => {
    const now = 1_700_000_000_000;
    for (const key of [PKCS1, PKCS8]) {
      const claims = verified(await appJwt({ appId: '123', privateKey: key }, now));
      expect(claims).toEqual({ iat: 1_700_000_000 - 60, exp: 1_700_000_000 + 9 * 60, iss: '123' });
    }
  });

  it('throws on a key it can’t read', async () => {
    await expect(appJwt({ appId: '1', privateKey: 'nope' }, 0)).rejects.toThrow(/PEM/);
  });
});

describe('installationToken', () => {
  const config = { appId: '123', privateKey: PKCS1 };

  it('asks for metadata alone, with the App’s JWT, and hands the token back', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return Response.json({ token: 'ghs_x', expires_at: '2026-11-12T11:00:00Z' }, { status: 201 });
    });
    expect(await installationToken(config, 7, Date.now())).toBe('ghs_x');
    expect(seen[0]!.url).toBe('https://api.github.com/app/installations/7/access_tokens');
    expect(JSON.parse(seen[0]!.init.body as string)).toEqual({ permissions: { metadata: 'read' } });
    const auth = (seen[0]!.init.headers as Record<string, string>)['Authorization']!;
    expect(verified(auth.slice('Bearer '.length))['iss']).toBe('123');
  });

  it('is null when GitHub refuses, answers oddly or can’t be reached', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const answer of [
      () => new Response('no', { status: 404 }),
      () => Response.json({ token: '' }, { status: 201 }),
      () => Response.json([], { status: 201 }),
      () => {
        throw new TypeError('down');
      },
    ]) {
      vi.stubGlobal('fetch', async () => answer());
      expect(await installationToken(config, 7, Date.now())).toBeNull();
    }
    expect(await installationToken({ appId: '1', privateKey: 'bad' }, 7, Date.now())).toBeNull();
  });
});

describe('the GitHub calls', () => {
  const config = { appId: '123', privateKey: PKCS1, clientId: 'Iv1.c', clientSecret: 's' };

  it('answer null on a refusal or a body that is not JSON', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', async () => new Response('<html>', { status: 200 }));
    expect(await exchangeCode(config, 'c')).toBeNull();
    expect(await appInstallation(config, 7, Date.now())).toBeNull();
    vi.stubGlobal('fetch', async () => Response.json({ account: { login: '' } }));
    expect(await appInstallation(config, 7, Date.now())).toBeNull();
    expect(await appInstallation({ ...config, privateKey: 'bad' }, 7, Date.now())).toBeNull();
    vi.stubGlobal('fetch', async () => new Response('x', { status: 500 }));
    expect(await exchangeCode(config, 'c')).toBeNull();
    expect(await installationRepositories(config, 7, Date.now())).toBeNull();
  });

  it('a list page of an odd shape fails the whole list', async () => {
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith('/access_tokens')) return Response.json({ token: 't' }, { status: 201 });
      return new URL(url).searchParams.get('page') === '1'
        ? Response.json(
            { repositories: [{ id: 1, full_name: 'a/b' }] },
            { headers: { Link: '<https://api.github.com/x?page=2>; rel="next"' } },
          )
        : Response.json({ total_count: 2 });
    });
    expect(await installationRepositories(config, 7, Date.now())).toBeNull();
  });

  it('a failed revoke is logged, never thrown', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', async () => new Response('x', { status: 500 }));
    await revokeUserToken(config, 'gho_t');
    vi.stubGlobal('fetch', async () => new Response(null, { status: 404 }));
    await revokeUserToken(config, 'gho_t');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('gho_t');
  });
});
