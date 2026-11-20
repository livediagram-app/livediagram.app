// The team's Claude API key at rest (docs/specs/030-knowledgebase/search-and-ask.md "Ask"): sealed with AES-GCM
// under the Worker's `AI_KEY_SECRET` before the room stores it, and opened only to make a model call. WebCrypto
// alone, so it runs in a Worker and in Node. The key never appears in an envelope, a hint beyond its last four
// characters, or an error.

const VERSION = 'v1';
const IV_BYTES = 12;
const HKDF_INFO = 'liveknowledge ai key v1';
/** A key no longer than this is no API key, and showing its last four characters would show most of it. */
const MIN_HINTED_KEY_CHARS = 12;
export const KEY_HINT_CHARS = 4;
/** No API key is longer; a longer value is refused before it is sealed. */
export const MAX_API_KEY_CHARS = 512;

/** Sealing or opening failed. The message never holds the key, the secret or the envelope. */
export class KeySealError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeySealError';
  }
}

const utf8 = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// The AES key for a secret: HKDF over the secret's bytes, so a secret of any length makes a full-strength key and
// a later envelope version can derive a different one from the same secret.
async function sealingKey(secret: string): Promise<CryptoKey> {
  if (!secret) throw new KeySealError('The key secret is not set.');
  const material = await crypto.subtle.importKey('raw', utf8.encode(secret), 'HKDF', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: utf8.encode(HKDF_INFO) },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Seals `apiKey` under `secret`: `v1.<iv>.<ciphertext>`, a fresh random IV each time. `boundTo` (the
 *  knowledgebase's id) is authenticated with it, so an envelope copied into another knowledgebase does not open. */
export async function sealApiKey(secret: string, apiKey: string, boundTo = ''): Promise<string> {
  if (!apiKey || apiKey.length > MAX_API_KEY_CHARS) {
    throw new KeySealError('That is not an API key.');
  }
  const key = await sealingKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: utf8.encode(boundTo) },
    key,
    utf8.encode(apiKey),
  );
  return `${VERSION}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(sealed))}`;
}

/** Opens an envelope `sealApiKey` made. Fails closed: a wrong secret, another knowledgebase's envelope, a changed
 *  or cut envelope and an unknown version all throw the same KeySealError. */
export async function openApiKey(secret: string, envelope: string, boundTo = ''): Promise<string> {
  const failed = () => new KeySealError('The stored key could not be read.');
  const [version, ivText, sealedText, ...extra] = envelope.split('.');
  if (version !== VERSION || !ivText || !sealedText || extra.length) throw failed();
  const key = await sealingKey(secret);
  try {
    const iv = fromBase64Url(ivText);
    if (iv.length !== IV_BYTES) throw failed();
    const opened = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: utf8.encode(boundTo) },
      key,
      fromBase64Url(sealedText),
    );
    return new TextDecoder('utf-8', { fatal: true }).decode(opened);
  } catch {
    // Whatever WebCrypto or the decoding said, the caller learns only that it did not open.
    throw failed();
  }
}

/** What Settings shows of a key ("Key ending 4f2a"): its last four characters, or '' for a value too short to be
 *  one. */
export const keyHint = (apiKey: string): string =>
  apiKey.length < MIN_HINTED_KEY_CHARS ? '' : apiKey.slice(-KEY_HINT_CHARS);
