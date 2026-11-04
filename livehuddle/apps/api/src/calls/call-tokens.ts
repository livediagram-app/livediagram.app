// The calls' proofs (docs/specs/012-collaboration/blueprints/proximity-audio.md "Tokens"): stateless signatures the
// Worker hands out with a Realtime session, so it can later tell, without storing anything, that a session is the
// caller's (the private session token) and that a published microphone belongs to this Space (the public track
// token a speaker shares in its `call-track` op). HMAC-SHA256, keyed by the Realtime app's own secret, base64url.

/** Whether a session may publish: `s` a speaker's (Editor, Participant), `l` a listener's (Viewer). */
export type CallRole = 's' | 'l';

const encoder = new TextEncoder();

async function mac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
  let bin = '';
  for (const byte of sig) bin += String.fromCharCode(byte);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

// Constant time over the shorter length, and unequal whenever the lengths differ.
function sameString(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The private proof that `sessionId` is the caller's on `documentId`, with the role it was minted for. */
export async function sealSessionToken(
  secret: string,
  documentId: string,
  sessionId: string,
  role: CallRole,
): Promise<string> {
  return `${role}.${await mac(secret, `own|${documentId}|${sessionId}|${role}`)}`;
}

/** The role a session token proves for `sessionId` on `documentId`, or null for anything else. */
export async function openSessionToken(
  secret: string,
  documentId: string,
  sessionId: string,
  token: unknown,
): Promise<CallRole | null> {
  if (typeof token !== 'string') return null;
  const role = token.slice(0, 1);
  if ((role !== 's' && role !== 'l') || token[1] !== '.') return null;
  const expected = await sealSessionToken(secret, documentId, sessionId, role);
  return sameString(expected, token) ? role : null;
}

/** The public proof that the microphone on `sessionId` was published in `documentId`. */
export function sealTrackToken(
  secret: string,
  documentId: string,
  sessionId: string,
): Promise<string> {
  return mac(secret, `pub|${documentId}|${sessionId}`);
}

/** Whether a locator's token proves its session publishes in `documentId`. */
export async function trackTokenHolds(
  secret: string,
  documentId: string,
  sessionId: string,
  token: string,
): Promise<boolean> {
  return sameString(await sealTrackToken(secret, documentId, sessionId), token);
}
