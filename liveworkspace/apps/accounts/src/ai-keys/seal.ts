// A customer's AI key at rest (liveworkspace/docs/specs/003-accounts/ai-keys.md "Sealing"; blueprint "Sealing"):
// AES-256-GCM under a key derived for each record with HKDF-SHA-256 from the master secret (`AI_KEY_SECRET`), a fresh
// random salt, and the record's owner, provider and version. The same string is the ciphertext's additional data,
// so a sealed key moved to another row, relabelled to the other provider or to another version does not open.
// WebCrypto alone. Nothing here logs, and no error holds a key, a secret or an envelope.
import type { KeyProviderId } from '@liveworkspace/ai';

/** No API key is longer; a longer value is refused before it is sealed. */
export const MAX_AI_KEY_CHARS = 512;
/** A key no longer than this is no API key, and showing its last four characters would show most of it. */
const MIN_HINTED_KEY_CHARS = 12;
const HINT_CHARS = 4;
const SALT_BYTES = 16;
const IV_BYTES = 12;
// A rotation's version, as `AI_KEY_SECRET` names it: `<version>:<secret>`.
const VERSIONED = /^(\d{1,4}):(.+)$/s;
// Whitespace or a control character: no provider's key holds one, and a pasted one is a mistake.
// oxlint-disable-next-line no-control-regex -- control characters are what it refuses
const NOT_A_KEY_CHAR = /[\s\u0000-\u001f\u007f]/;

/** Whose key a record is: `account:<user id>` or `team:<team id>`. */
export type AiKeyOwner = `account:${string}` | `team:${string}`;

export type AiKeySecret = { version: number; secret: string };
export type AiKeySecrets = { current: AiKeySecret; previous?: AiKeySecret };

/** Sealing or opening failed. The message never holds the key, the secret or the envelope. */
export class AiKeySealError extends Error {
  constructor(message = 'The stored key could not be read.') {
    super(message);
    this.name = 'AiKeySealError';
  }
}

function parseSecret(value: string | undefined): AiKeySecret | null {
  const raw = value?.trim();
  if (!raw) return null;
  const versioned = VERSIONED.exec(raw);
  if (versioned) {
    const version = Number(versioned[1]);
    return version >= 1 ? { version, secret: versioned[2]! } : null;
  }
  return { version: 1, secret: raw };
}

/** The master secrets this deployment holds, or null without `AI_KEY_SECRET`: then no key is sealed or opened, and
 *  every route fails closed. A previous secret of the current one's version is ignored. */
export function aiKeySecrets(env: {
  AI_KEY_SECRET?: string;
  AI_KEY_SECRET_PREVIOUS?: string;
}): AiKeySecrets | null {
  const current = parseSecret(env.AI_KEY_SECRET);
  if (!current) return null;
  const previous = parseSecret(env.AI_KEY_SECRET_PREVIOUS);
  return previous && previous.version !== current.version ? { current, previous } : { current };
}

/** Whether `value` could be a key: a string of 1 to 512 characters with no whitespace or control character. */
export const isAiKeyShaped = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= MAX_AI_KEY_CHARS &&
  !NOT_A_KEY_CHAR.test(value);

/** What Settings shows of a key ("Key Ending 4f2a"): its last four characters, or '' for a value too short. */
export const aiKeyHint = (apiKey: string): string =>
  apiKey.length < MIN_HINTED_KEY_CHARS ? '' : apiKey.slice(-HINT_CHARS);

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

/** The string a record is bound to: HKDF's info and the cipher's additional data alike. */
export const recordContext = (
  version: number,
  owner: AiKeyOwner,
  provider: KeyProviderId,
): string => `liveworkspace ai key|v${version}|${owner}|${provider}`;

async function recordKey(secret: string, salt: Uint8Array<ArrayBuffer>, context: string) {
  const material = await crypto.subtle.importKey('raw', utf8.encode(secret), 'HKDF', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: utf8.encode(context) },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Seals `apiKey` for `owner` and `provider` under the current secret. */
export async function sealAiKey(
  secrets: AiKeySecrets,
  owner: AiKeyOwner,
  provider: KeyProviderId,
  apiKey: string,
): Promise<{ sealed: string; version: number }> {
  if (!isAiKeyShaped(apiKey)) throw new AiKeySealError('That is not an API key.');
  const { version, secret } = secrets.current;
  const context = recordContext(version, owner, provider);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await recordKey(secret, salt, context);
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: utf8.encode(context) },
    key,
    utf8.encode(apiKey),
  );
  return {
    sealed: `${version}.${toBase64Url(salt)}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(sealed))}`,
    version,
  };
}

/** The version an envelope names, or null for one that names none. */
export function sealedVersion(sealed: string): number | null {
  const version = Number(sealed.split('.', 1)[0]);
  return Number.isInteger(version) && version >= 1 ? version : null;
}

/** Opens an envelope `sealAiKey` made for this owner and provider. Fails closed: a version neither secret has, a
 *  wrong secret, another owner's or provider's envelope, a changed or cut one, all throw the same AiKeySealError. */
export async function openAiKey(
  secrets: AiKeySecrets,
  owner: AiKeyOwner,
  provider: KeyProviderId,
  sealed: string,
): Promise<string> {
  const parts = sealed.split('.');
  if (parts.length !== 4) throw new AiKeySealError();
  const [versionText, saltText, ivText, cipherText] = parts as [string, string, string, string];
  const version = Number(versionText);
  const secret = [secrets.current, secrets.previous].find((s) => s?.version === version)?.secret;
  if (!secret || String(version) !== versionText) throw new AiKeySealError();
  try {
    const salt = fromBase64Url(saltText);
    const iv = fromBase64Url(ivText);
    if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES) throw new AiKeySealError();
    const context = recordContext(version, owner, provider);
    const opened = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: utf8.encode(context) },
      await recordKey(secret, salt, context),
      fromBase64Url(cipherText),
    );
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(opened);
  } catch {
    // Whatever WebCrypto or the decoding said, the caller learns only that it did not open.
    throw new AiKeySealError();
  }
}
