import { describe, expect, it, vi } from 'vitest';
import { bytesToBase64Url } from '@liveworkspace/api-kit/bytes';
import { chatKeys, readSigned, signPayload } from './signed';
import { slackSignature, verifySlackRequest } from './slack-signature';
import {
  BOT_FRAMEWORK_ISSUER,
  BOT_FRAMEWORK_OPENID,
  createBotFrameworkKeys,
  isTeamsServiceUrl,
  verifyBotFrameworkRequest,
  type BotKeys,
} from './teams-auth';
import { BOT_KEYS_KEEP_MS, BOT_KEYS_RETRY_MS, SIGNED_PAYLOAD_MAX } from './limits';

const NOW = 1_800_000_000_000;
const SECRET = 'slack-signing-secret';
const enc = new TextEncoder();

describe('Slack request check', () => {
  const body = 'token=x&team_id=T1&text=hello';
  const ts = String(NOW / 1000);
  it('takes a good signature', async () => {
    const signature = await slackSignature(SECRET, ts, body);
    expect(
      await verifySlackRequest({ secret: SECRET, timestamp: ts, signature, body, now: NOW }),
    ).toBe('ok');
  });
  it('refuses a wrong one, a byte short, another body and another secret', async () => {
    const signature = await slackSignature(SECRET, ts, body);
    for (const sent of [signature.slice(0, -1), `${signature.slice(0, -1)}0`, 'v0=00'])
      expect(
        await verifySlackRequest({
          secret: SECRET,
          timestamp: ts,
          signature: sent,
          body,
          now: NOW,
        }),
      ).toBe('bad');
    expect(
      await verifySlackRequest({
        secret: SECRET,
        timestamp: ts,
        signature,
        body: `${body}!`,
        now: NOW,
      }),
    ).toBe('bad');
    expect(
      await verifySlackRequest({ secret: 'other', timestamp: ts, signature, body, now: NOW }),
    ).toBe('bad');
  });
  it('refuses a stale or a future timestamp, and a timestamp that is no number', async () => {
    for (const at of [NOW / 1000 - 301, NOW / 1000 + 301]) {
      const t = String(at);
      const signature = await slackSignature(SECRET, t, body);
      expect(
        await verifySlackRequest({ secret: SECRET, timestamp: t, signature, body, now: NOW }),
      ).toBe('stale');
    }
    expect(
      await verifySlackRequest({
        secret: SECRET,
        timestamp: '12.5',
        signature: 'v0=1',
        body,
        now: NOW,
      }),
    ).toBe('bad');
  });
  it('says a missing header or secret is missing', async () => {
    expect(
      await verifySlackRequest({
        secret: SECRET,
        timestamp: null,
        signature: 'v0=1',
        body,
        now: NOW,
      }),
    ).toBe('missing');
    expect(
      await verifySlackRequest({ secret: SECRET, timestamp: ts, signature: null, body, now: NOW }),
    ).toBe('missing');
    expect(
      await verifySlackRequest({ secret: '', timestamp: ts, signature: 'v0=1', body, now: NOW }),
    ).toBe('missing');
  });
});

describe('signed payloads', () => {
  const secret = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
  it('needs a 32-byte key', async () => {
    expect(await chatKeys(undefined)).toBeNull();
    expect(await chatKeys(btoa('short'))).toBeNull();
    expect(await chatKeys(secret)).not.toBeNull();
  });
  it('reads back what it signed until it lapses', async () => {
    const keys = (await chatKeys(secret))!;
    const token = await signPayload(keys.sign, { kb: 'kb1' }, NOW + 1000);
    expect(await readSigned(keys.sign, token, NOW)).toEqual({ kb: 'kb1', exp: NOW + 1000 });
    expect(await readSigned(keys.sign, token, NOW + 1000)).toBeNull();
  });
  it('refuses a tampered, foreign, malformed or too long one', async () => {
    const keys = (await chatKeys(secret))!;
    const other = (await chatKeys(btoa(String.fromCharCode(...new Uint8Array(32).fill(9)))))!;
    const token = await signPayload(keys.sign, { kb: 'kb1' }, NOW + 1000);
    const [body, mac] = token.split('.');
    const forged = bytesToBase64Url(enc.encode(JSON.stringify({ kb: 'kb2', exp: NOW + 1000 })));
    expect(await readSigned(keys.sign, `${forged}.${mac}`, NOW)).toBeNull();
    expect(await readSigned(other.sign, token, NOW)).toBeNull();
    expect(await readSigned(keys.sign, `${body}`, NOW)).toBeNull();
    expect(await readSigned(keys.sign, `${token}.x`, NOW)).toBeNull();
    expect(await readSigned(keys.sign, `${body}.!!`, NOW)).toBeNull();
    expect(await readSigned(keys.sign, null, NOW)).toBeNull();
    expect(await readSigned(keys.sign, 'a'.repeat(SIGNED_PAYLOAD_MAX + 1), NOW)).toBeNull();
  });
  it('refuses a signed body that is not an object with an expiry', async () => {
    const keys = (await chatKeys(secret))!;
    const signBody = async (text: string) => {
      const b = bytesToBase64Url(enc.encode(text));
      const mac = await crypto.subtle.sign('HMAC', keys.sign, enc.encode(b));
      return `${b}.${bytesToBase64Url(mac)}`;
    };
    for (const text of ['[1]', '"x"', '{"kb":1}', 'not json', 'null'])
      expect(await readSigned(keys.sign, await signBody(text), NOW)).toBeNull();
    const notBase64 = '%%';
    const mac = await crypto.subtle.sign('HMAC', keys.sign, enc.encode(notBase64));
    expect(await readSigned(keys.sign, `${notBase64}.${bytesToBase64Url(mac)}`, NOW)).toBeNull();
  });
});

// A Bot Framework token signed by a test key standing in for Microsoft's.
async function botKit() {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const part = (value: unknown) => bytesToBase64Url(enc.encode(JSON.stringify(value)));
  const sign = async (claims: Record<string, unknown>, head: Record<string, unknown> = {}) => {
    const text = `${part({ alg: 'RS256', kid: 'k1', ...head })}.${part(claims)}`;
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, enc.encode(text));
    return `Bearer ${text}.${bytesToBase64Url(sig)}`;
  };
  const claims = {
    iss: BOT_FRAMEWORK_ISSUER,
    aud: 'app-1',
    serviceurl: 'https://smba.trafficmanager.net/emea/',
    exp: NOW / 1000 + 3600,
    nbf: NOW / 1000 - 60,
  };
  return { jwk: { ...jwk, kid: 'k1' }, sign, claims };
}

describe('Teams request check', () => {
  const keysOf = (jwk: JsonWebKey | null): BotKeys => ({ keyFor: async () => jwk });
  it('takes a token the Bot Framework signed for this app and activity', async () => {
    const kit = await botKit();
    const check = {
      authorization: await kit.sign(kit.claims),
      appId: 'app-1',
      serviceUrl: kit.claims.serviceurl,
      now: NOW,
      keys: keysOf(kit.jwk),
    };
    expect(await verifyBotFrameworkRequest(check)).toBe('ok');
    expect(
      await verifyBotFrameworkRequest({
        ...check,
        keys: keysOf({ ...kit.jwk, endorsements: ['msteams', 'skype'] } as JsonWebKey),
      }),
    ).toBe('ok');
  });
  it('refuses the wrong issuer, audience, service, time, key, algorithm and signature', async () => {
    const kit = await botKit();
    const base = {
      appId: 'app-1',
      serviceUrl: kit.claims.serviceurl,
      now: NOW,
      keys: keysOf(kit.jwk),
    };
    const refused = async (authorization: string | null, more: object = {}) =>
      verifyBotFrameworkRequest({ ...base, authorization, ...more });
    expect(await refused(await kit.sign({ ...kit.claims, iss: 'https://evil.example' }))).toBe(
      'bad',
    );
    expect(await refused(await kit.sign({ ...kit.claims, aud: 'app-2' }))).toBe('bad');
    expect(
      await refused(await kit.sign({ ...kit.claims, serviceurl: 'https://evil.example/' })),
    ).toBe('bad');
    expect(await refused(await kit.sign(kit.claims), { serviceUrl: null })).toBe('bad');
    expect(await refused(await kit.sign({ ...kit.claims, exp: NOW / 1000 - 400 }))).toBe('stale');
    expect(await refused(await kit.sign({ ...kit.claims, exp: undefined }))).toBe('stale');
    expect(await refused(await kit.sign({ ...kit.claims, nbf: NOW / 1000 + 400 }))).toBe('stale');
    expect(await refused(await kit.sign(kit.claims, { alg: 'none' }))).toBe('bad');
    expect(await refused(await kit.sign(kit.claims, { kid: 7 }))).toBe('bad');
    expect(await refused(await kit.sign(kit.claims), { keys: keysOf(null) })).toBe('bad');
    expect(
      await refused(await kit.sign(kit.claims), {
        keys: keysOf({ ...kit.jwk, endorsements: ['skype'] } as JsonWebKey),
      }),
    ).toBe('bad');
    expect(
      await refused(await kit.sign(kit.claims), { keys: keysOf({ kty: 'EC', crv: 'P-256' }) }),
    ).toBe('bad');
    const good = await kit.sign(kit.claims);
    expect(await refused(`${good.slice(0, -4)}AAAA`)).toBe('bad');
    expect(await refused(`${good}.x`)).toBe('bad');
    expect(await refused('Bearer a.b.c')).toBe('bad');
    expect(await refused('Bearer %%.e30.AA')).toBe('bad');
    expect(await refused('Bearer YWJj.e30.AA')).toBe('bad');
    expect(await refused('Bearer Nw.e30.AA')).toBe('bad');
    expect(await refused(null)).toBe('missing');
    expect(await refused('Basic abc')).toBe('missing');
    expect(await refused(good, { appId: '' })).toBe('missing');
  });
  it('knows Teams service addresses', () => {
    expect(isTeamsServiceUrl('https://smba.trafficmanager.net/emea/')).toBe(true);
    expect(isTeamsServiceUrl('https://x.botframework.com/')).toBe(true);
    expect(isTeamsServiceUrl('https://x.teams.microsoft.com/')).toBe(true);
    expect(isTeamsServiceUrl('http://smba.trafficmanager.net/')).toBe(false);
    expect(isTeamsServiceUrl('https://smba.trafficmanager.net:8443/')).toBe(false);
    expect(isTeamsServiceUrl('https://evil.example/')).toBe(false);
    expect(isTeamsServiceUrl('not a url')).toBe(false);
  });
});

describe('the Bot Framework keys', () => {
  const answering = (jwksUri: unknown, keys: unknown) =>
    vi.fn(async (url: string | URL | Request) =>
      (url instanceof Request ? url.url : url.toString()) === BOT_FRAMEWORK_OPENID
        ? Response.json({ jwks_uri: jwksUri })
        : Response.json({ keys }),
    );
  it('fetches once a day, and again for an unknown key at most every five minutes', async () => {
    const fetcher = answering('https://login.botframework.com/v1/.well-known/keys', [
      { kid: 'a', kty: 'RSA' },
      { kty: 'RSA' },
    ]);
    const keys = createBotFrameworkKeys(fetcher);
    expect(await keys.keyFor('a', NOW)).toMatchObject({ kid: 'a' });
    expect(await keys.keyFor('a', NOW + 1000)).toMatchObject({ kid: 'a' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(await keys.keyFor('b', NOW + 2000)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(await keys.keyFor('b', NOW + BOT_KEYS_RETRY_MS + 1)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(4);
    await keys.keyFor('a', NOW + BOT_KEYS_KEEP_MS + BOT_KEYS_RETRY_MS + 2);
    expect(fetcher).toHaveBeenCalledTimes(6);
  });
  it('keeps no keys from anywhere but the Bot Framework, nor from a failed read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const uri of ['https://evil.example/keys', 'http://login.botframework.com/k', 7, 'nope']) {
      const keys = createBotFrameworkKeys(answering(uri, [{ kid: 'a' }]));
      expect(await keys.keyFor('a', NOW)).toBeNull();
    }
    const failing = createBotFrameworkKeys(async () => new Response('', { status: 500 }));
    expect(await failing.keyFor('a', NOW)).toBeNull();
    const noList = createBotFrameworkKeys(answering('https://login.botframework.com/k', 'none'));
    expect(await noList.keyFor('a', NOW)).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
