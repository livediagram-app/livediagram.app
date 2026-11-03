// The emailed download link (liveworkspace/docs/specs/003-accounts/data-export.md "The link"):
// `<accounts>/api/account/data-export/download?key=&id=&exp=&sig=`, `sig` an HMAC-SHA-256 over who the link is for, the
// export's scope and run, and when it lapses, with a key derived from accounts' own secret for this alone. The
// download also needs that person's session, so a forwarded link opens nothing.
import { DATA_EXPORT_DOWNLOAD_PATH, exportLinkMessage } from '@liveworkspace/data-export';

const encoder = new TextEncoder();
const INFO = 'liveworkspace data export link';

// One derived key per secret for the life of the isolate.
const keys = new Map<string, Promise<CryptoKey>>();

function linkKey(secret: string): Promise<CryptoKey> {
  let key = keys.get(secret);
  if (!key) {
    key = (async () => {
      const base = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, [
        'deriveKey',
      ]);
      return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(), info: encoder.encode(INFO) },
        base,
        { name: 'HMAC', hash: 'SHA-256', length: 256 },
        false,
        ['sign', 'verify'],
      );
    })();
    keys.set(secret, key);
  }
  return key;
}

export type LinkFacts = { forPerson: string; key: string; exportId: string; expiresAt: number };

const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function signLink(secret: string, facts: LinkFacts): Promise<string> {
  const message = exportLinkMessage(facts.forPerson, facts.key, facts.exportId, facts.expiresAt);
  return hex(await crypto.subtle.sign('HMAC', await linkKey(secret), encoder.encode(message)));
}

/** Whether `sig` is this link's signature, compared in constant time by the platform's HMAC verify. */
export async function checkLink(secret: string, facts: LinkFacts, sig: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(sig)) return false;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = parseInt(sig.slice(i * 2, i * 2 + 2), 16);
  const message = exportLinkMessage(facts.forPerson, facts.key, facts.exportId, facts.expiresAt);
  return crypto.subtle.verify('HMAC', await linkKey(secret), bytes, encoder.encode(message));
}

/** The whole link, for the email and Settings' Download. */
export async function linkUrl(baseUrl: string, secret: string, facts: LinkFacts): Promise<string> {
  const query = new URLSearchParams({
    key: facts.key,
    id: facts.exportId,
    exp: String(facts.expiresAt),
    sig: await signLink(secret, facts),
  });
  return `${baseUrl.replace(/\/+$/, '')}${DATA_EXPORT_DOWNLOAD_PATH}?${query}`;
}
