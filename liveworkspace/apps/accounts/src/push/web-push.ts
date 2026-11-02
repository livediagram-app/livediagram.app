// Web Push, written on Web Crypto alone (liveworkspace/docs/specs/003-accounts/push.md "Sending"): the message
// encryption of RFC 8291 (`aes128gcm`, RFC 8188) and the VAPID signature of RFC 8292, so the Worker needs no Node
// library. A push service sees only the encrypted record, the VAPID token and the TTL.

const encoder = new TextEncoder();

/** Bytes as unpadded base64url, the encoding every Web Push key travels in. */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** Unpadded (or padded) base64url to bytes; null for anything that isn't base64url. */
export function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*={0,2}$/.test(text)) return null;
  const plain = text.replace(/=+$/, '').replaceAll('-', '+').replaceAll('_', '/');
  if (plain.length % 4 === 1) return null;
  const binary = atob(plain + '='.repeat((4 - (plain.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// A P-256 public key in the uncompressed form (0x04, x, y): 65 bytes.
const POINT_LENGTH = 65;
// The record size this Worker writes: one record holds any payload it sends (MAX_PUSH_PAYLOAD_BYTES).
const RECORD_SIZE = 4096;

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  bytes: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    bytes * 8,
  );
  return new Uint8Array(bits);
}

/** A browser's subscription keys, as `PushSubscription.toJSON().keys` gives them. */
export interface SubscriptionKeys {
  p256dh: string;
  auth: string;
}

/** For tests: the sender's one-off key pair and salt, which are random otherwise. */
export interface EncryptOverrides {
  senderKeys?: CryptoKeyPair;
  salt?: Uint8Array;
}

/**
 * Encrypts `payload` for one subscription as an `aes128gcm` body (RFC 8291 section 3.4): a fresh ECDH key pair and
 * salt every message, the shared secret mixed with the subscription's auth secret, one record, delimiter 0x02.
 * Null when the subscription's keys are not a P-256 point and a 16-byte secret.
 */
export async function encryptPayload(
  keys: SubscriptionKeys,
  payload: Uint8Array,
  overrides: EncryptOverrides = {},
): Promise<Uint8Array | null> {
  const uaPublic = fromBase64Url(keys.p256dh);
  const authSecret = fromBase64Url(keys.auth);
  if (!uaPublic || uaPublic.length !== POINT_LENGTH || uaPublic[0] !== 4) return null;
  if (!authSecret || authSecret.length !== 16) return null;
  // One record: the payload, its delimiter and the tag. Push services take about 4 KB of body, header included.
  if (payload.length + 1 + 16 + 86 > RECORD_SIZE) return null;

  let receiver: CryptoKey;
  try {
    receiver = await crypto.subtle.importKey(
      'raw',
      uaPublic,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    );
  } catch {
    return null;
  }
  const sender =
    overrides.senderKeys ??
    ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ])) as CryptoKeyPair);
  const asPublic = new Uint8Array(
    (await crypto.subtle.exportKey('raw', sender.publicKey)) as ArrayBuffer,
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      // The standard's `public` (workers-types spell it `$public`, a name its binding generator reserves).
      { name: 'ECDH', public: receiver } as unknown as SubtleCryptoDeriveKeyAlgorithm,
      sender.privateKey,
      256,
    ),
  );

  const keyInfo = concat(encoder.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const salt = overrides.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12);

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      aes,
      concat(payload, Uint8Array.of(2)),
    ),
  );

  const header = new Uint8Array(16 + 4 + 1 + POINT_LENGTH);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = POINT_LENGTH;
  header.set(asPublic, 21);
  return concat(header, sealed);
}

/** The deployment's VAPID key pair (RFC 8292), as the VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets hold it. */
export interface VapidKeys {
  // The uncompressed P-256 point, base64url: what browsers subscribe with (`applicationServerKey`).
  publicKey: string;
  // The private scalar d, 32 bytes, base64url.
  privateKey: string;
}

/** The signing key the VAPID pair names, or null when either half is malformed. */
export async function vapidSigningKey(keys: VapidKeys): Promise<CryptoKey | null> {
  const point = fromBase64Url(keys.publicKey.trim());
  const d = fromBase64Url(keys.privateKey.trim());
  if (!point || point.length !== POINT_LENGTH || point[0] !== 4 || !d || d.length !== 32)
    return null;
  try {
    return await crypto.subtle.importKey(
      'jwk',
      {
        kty: 'EC',
        crv: 'P-256',
        x: toBase64Url(point.slice(1, 33)),
        y: toBase64Url(point.slice(33)),
        d: toBase64Url(d),
        ext: false,
      },
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );
  } catch {
    return null;
  }
}

// How long a VAPID token is good for: RFC 8292 caps it at 24 hours; 12 leaves room for a skewed clock.
export const VAPID_TOKEN_SECONDS = 12 * 60 * 60;

/**
 * The `Authorization: vapid t=…, k=…` header for a push to `endpoint` (RFC 8292 section 3): an ES256 JWT whose
 * audience is the push service's origin and whose subject is how the service can reach this deployment.
 */
export async function vapidAuthorization(
  endpoint: string,
  keys: VapidKeys,
  signingKey: CryptoKey,
  subject: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const header = toBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = toBase64Url(
    encoder.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: nowSeconds + VAPID_TOKEN_SECONDS,
        sub: subject,
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;
  // Web Crypto's ECDSA signature is r || s, which is exactly JWS's ES256 form.
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      signingKey,
      encoder.encode(unsigned),
    ),
  );
  return `vapid t=${unsigned}.${toBase64Url(signature)}, k=${keys.publicKey.trim()}`;
}
