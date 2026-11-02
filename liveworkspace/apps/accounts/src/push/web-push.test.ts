import { describe, expect, it } from 'vitest';
import {
  encryptPayload,
  fromBase64Url,
  toBase64Url,
  vapidAuthorization,
  vapidSigningKey,
  VAPID_TOKEN_SECONDS,
} from './web-push.ts';

const b64 = (text: string) => fromBase64Url(text)!;

// RFC 8291 Appendix A: the worked example, with the sender's key pair and salt fixed.
const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',
  asPublic:
    'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublic:
    'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

async function rfcSenderKeys(): Promise<CryptoKeyPair> {
  const point = b64(RFC.asPublic);
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: toBase64Url(point.slice(1, 33)),
    y: toBase64Url(point.slice(33)),
  };
  const algorithm = { name: 'ECDH', namedCurve: 'P-256' };
  return {
    publicKey: await crypto.subtle.importKey('jwk', jwk, algorithm, true, []),
    privateKey: await crypto.subtle.importKey(
      'jwk',
      { ...jwk, d: RFC.asPrivate },
      algorithm,
      true,
      ['deriveBits'],
    ),
  };
}

// The browser's side of RFC 8291: what a push service hands the service worker, decrypted.
async function decrypt(
  body: Uint8Array,
  receiver: CryptoKeyPair,
  auth: Uint8Array,
): Promise<string> {
  const salt = body.slice(0, 16);
  const idlen = body[20]!;
  const asPublic = body.slice(21, 21 + idlen);
  const sealed = body.slice(21 + idlen);
  const uaPublic = new Uint8Array(
    (await crypto.subtle.exportKey('raw', receiver.publicKey)) as ArrayBuffer,
  );
  const sender = await crypto.subtle.importKey(
    'raw',
    asPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const ecdh = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: sender } as unknown as SubtleCryptoDeriveKeyAlgorithm,
      receiver.privateKey,
      256,
    ),
  );
  const hkdf = async (s: Uint8Array, ikm: Uint8Array, info: Uint8Array, n: number) =>
    new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt: s, info },
        await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']),
        n * 8,
      ),
    );
  const enc = new TextEncoder();
  const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(auth, ecdh, info, 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, sealed),
  );
  expect(plain.at(-1)).toBe(2);
  return new TextDecoder().decode(plain.slice(0, -1));
}

describe('base64url', () => {
  it('round-trips bytes without padding, and refuses what is not base64url', () => {
    const bytes = Uint8Array.from([0, 255, 62, 63, 1]);
    expect(toBase64Url(bytes)).toBe('AP8-PwE');
    expect(fromBase64Url('AP8-PwE')).toEqual(bytes);
    expect(fromBase64Url('AP8-PwE=')).toEqual(bytes);
    expect(fromBase64Url('a+b/')).toBeNull();
    expect(fromBase64Url('abcde')).toBeNull();
  });
});

describe('encryptPayload (RFC 8291)', () => {
  it("writes the RFC's own example byte for byte", async () => {
    const body = await encryptPayload(
      { p256dh: RFC.uaPublic, auth: RFC.auth },
      new TextEncoder().encode(RFC.plaintext),
      { senderKeys: await rfcSenderKeys(), salt: b64(RFC.salt) },
    );
    expect(toBase64Url(body!)).toBe(RFC.body);
  });

  it('is read back by the browser side, with a fresh key and salt every time', async () => {
    const receiver = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ])) as CryptoKeyPair;
    const auth = crypto.getRandomValues(new Uint8Array(16));
    const keys = {
      p256dh: toBase64Url(
        new Uint8Array((await crypto.subtle.exportKey('raw', receiver.publicKey)) as ArrayBuffer),
      ),
      auth: toBase64Url(auth),
    };
    const message = JSON.stringify({ title: 'Ada mentioned you in Roadmap', url: 'https://x/y' });
    const one = (await encryptPayload(keys, new TextEncoder().encode(message)))!;
    const two = (await encryptPayload(keys, new TextEncoder().encode(message)))!;
    expect(await decrypt(one, receiver, auth)).toBe(message);
    expect(await decrypt(two, receiver, auth)).toBe(message);
    expect(toBase64Url(one.slice(0, 16))).not.toBe(toBase64Url(two.slice(0, 16)));
    // The header: the record size this Worker writes, and the sender's 65-byte key.
    expect(new DataView(one.buffer).getUint32(16)).toBe(4096);
    expect(one[20]).toBe(65);
  });

  it('refuses keys that are not a P-256 point and a 16-byte secret, and a payload past one record', async () => {
    const payload = new TextEncoder().encode('x');
    expect(await encryptPayload({ p256dh: 'AAAA', auth: RFC.auth }, payload)).toBeNull();
    expect(await encryptPayload({ p256dh: RFC.uaPublic, auth: 'AAAA' }, payload)).toBeNull();
    // 65 bytes with the right prefix that is no point on the curve.
    const offCurve = toBase64Url(Uint8Array.from({ length: 65 }, (_, i) => (i === 0 ? 4 : 1)));
    expect(await encryptPayload({ p256dh: offCurve, auth: RFC.auth }, payload)).toBeNull();
    expect(
      await encryptPayload({ p256dh: RFC.uaPublic, auth: RFC.auth }, new Uint8Array(4000)),
    ).toBeNull();
  });
});

describe('VAPID (RFC 8292)', () => {
  async function pair() {
    const keys = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair;
    const publicKey = toBase64Url(
      new Uint8Array((await crypto.subtle.exportKey('raw', keys.publicKey)) as ArrayBuffer),
    );
    const { d } = (await crypto.subtle.exportKey('jwk', keys.privateKey)) as JsonWebKey;
    return { verify: keys.publicKey, vapid: { publicKey, privateKey: d! } };
  }

  it('signs an ES256 token for the push service, which its public key verifies', async () => {
    const { verify, vapid } = await pair();
    const signing = (await vapidSigningKey(vapid))!;
    const header = await vapidAuthorization(
      'https://fcm.googleapis.com/fcm/send/abc',
      vapid,
      signing,
      'https://www.liveworkspace.app',
      1_000,
    );
    const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header)!;
    expect(match[4]).toBe(vapid.publicKey);
    const claims = JSON.parse(new TextDecoder().decode(b64(match[2]!)));
    expect(claims).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: 1_000 + VAPID_TOKEN_SECONDS,
      sub: 'https://www.liveworkspace.app',
    });
    expect(JSON.parse(new TextDecoder().decode(b64(match[1]!)))).toEqual({
      typ: 'JWT',
      alg: 'ES256',
    });
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      verify,
      b64(match[3]!),
      new TextEncoder().encode(`${match[1]}.${match[2]}`),
    );
    expect(ok).toBe(true);
  });

  it('refuses a malformed pair', async () => {
    const { vapid } = await pair();
    expect(await vapidSigningKey({ ...vapid, privateKey: 'short' })).toBeNull();
    expect(await vapidSigningKey({ ...vapid, publicKey: 'AAAA' })).toBeNull();
    // A private key that is not the public key's: the import refuses it.
    const other = await pair();
    expect(await vapidSigningKey({ ...vapid, privateKey: other.vapid.privateKey })).toBeNull();
  });
});
