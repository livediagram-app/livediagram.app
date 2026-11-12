// The App's own credentials (docs/specs/026-plan/github-pull-requests.md "Connecting a repository"; blueprint "Part 2"
// "Talking to GitHub"): an RS256 JWT signed with GITHUB_APP_PRIVATE_KEY by WebCrypto, and installation tokens minted
// from it per call. Neither is ever stored: a token is handed to its one caller and dropped.
import type { GithubConfig } from './github-config';
import { GITHUB_API, GITHUB_FETCH_TIMEOUT_MS } from './github-config';

// The JWT is backdated a minute for clock drift and lives 9 minutes (GitHub's cap is 10).
const JWT_BACKDATE_S = 60;
const JWT_LIFETIME_S = 9 * 60;

// The PKCS#8 envelope's fixed parts for an RSA key: version 0, then the rsaEncryption algorithm with NULL params.
const PKCS8_VERSION = [0x02, 0x01, 0x00];
const RSA_ALGORITHM = [
  0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
];

// A DER length: one byte under 128, else 0x80 + the count of big-endian bytes that follow.
function derLength(n: number): number[] {
  if (n < 0x80) return [n];
  const bytes: number[] = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) bytes.unshift(v % 256);
  return [0x80 | bytes.length, ...bytes];
}

const der = (tag: number, body: readonly number[] | Uint8Array): number[] => [
  tag,
  ...derLength(body.length),
  ...body,
];

function base64Bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** The key's PKCS#8 bytes: a PKCS#8 PEM read as it is, a PKCS#1 one (GitHub's download) wrapped. `\n` escapes, as a
 *  secret pasted on one line holds them, read as line breaks. Null for anything else. */
export function pkcs8Of(pem: string): Uint8Array | null {
  const text = pem.replace(/\\n/g, '\n');
  const pkcs1 = text.includes('-----BEGIN RSA PRIVATE KEY-----');
  const pkcs8 = text.includes('-----BEGIN PRIVATE KEY-----');
  if (!pkcs1 && !pkcs8) return null;
  const body = text
    .split('\n')
    .filter((line) => !line.startsWith('-----'))
    .join('')
    .replace(/\s/g, '');
  let bytes: Uint8Array;
  try {
    bytes = base64Bytes(body);
  } catch {
    return null;
  }
  if (bytes.length === 0) return null;
  if (pkcs8) return bytes;
  return Uint8Array.from(der(0x30, [...PKCS8_VERSION, ...RSA_ALGORITHM, ...der(0x04, bytes)]));
}

const enc = new TextEncoder();

export function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const part = (value: unknown) => base64url(enc.encode(JSON.stringify(value)));

/** The App's JWT, good for 9 minutes from `now` (ms). Throws when the key can't be read: a misset secret. */
export async function appJwt(config: Pick<GithubConfig, 'appId' | 'privateKey'>, now: number) {
  const pkcs8 = pkcs8Of(config.privateKey);
  if (!pkcs8) throw new Error('GITHUB_APP_PRIVATE_KEY is not a PEM private key');
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const iat = Math.floor(now / 1000) - JWT_BACKDATE_S;
  const signing = `${part({ alg: 'RS256', typ: 'JWT' })}.${part({
    iat,
    exp: iat + JWT_BACKDATE_S + JWT_LIFETIME_S,
    iss: config.appId,
  })}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signing));
  return `${signing}.${base64url(new Uint8Array(signature))}`;
}

/** The headers every call to GitHub's API carries. */
export const githubHeaders = (authorization: string): Record<string, string> => ({
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'liveplanner',
  Authorization: authorization,
});

/** An installation token for one call, asking for metadata (read) alone, or null when GitHub won't give one. Never
 *  stored. */
export async function installationToken(
  config: Pick<GithubConfig, 'appId' | 'privateKey'>,
  installationId: number,
  now: number,
): Promise<string | null> {
  try {
    const jwt = await appJwt(config, now);
    const res = await fetch(`${GITHUB_API}/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: { ...githubHeaders(`Bearer ${jwt}`), 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: { metadata: 'read' } }),
      signal: AbortSignal.timeout(GITHUB_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const token: unknown =
      typeof body === 'object' && body !== null ? Reflect.get(body, 'token') : null;
    return typeof token === 'string' && token !== '' ? token : null;
  } catch (err) {
    console.warn('[github] installation token failed', { error: String(err) });
    return null;
  }
}
