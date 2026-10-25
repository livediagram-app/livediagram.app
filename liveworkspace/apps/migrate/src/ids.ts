// Deterministic ids and the one-way names the new side keys people by. Everything here is synchronous Node crypto,
// so the splitter's hooks (which are synchronous) can use it; each is checked against the async Web Crypto original it
// stands in for (ids.test.ts).
import { createHash, createHmac, pbkdf2Sync } from 'node:crypto';

// The namespace every id the split makes is derived under (a random v4, fixed for this migration).
const SPLIT_NAMESPACE = 'f2b7d5d4-5a4c-4c35-9d2e-6c1f8f0e9b21';

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

/** A name-based UUID (RFC 9562 version 5, SHA-1) for `seed`: the same seed always gives the same id, so a bundle
 *  planned twice from the same snapshot makes the same documents. */
export function uuidFromSeed(seed: string, namespace = SPLIT_NAMESPACE): string {
  const ns = Buffer.from(namespace.replaceAll('-', ''), 'hex');
  const digest = createHash('sha1').update(ns).update(seed, 'utf8').digest();
  const b = Uint8Array.from(digest.subarray(0, 16));
  b[6] = (b[6]! & 0x0f) | 0x50;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = hex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** The media service's owner for a guest (packages/media/src/owner.ts mediaGuestOwner): `guest:` and the SHA-256
 *  hex of `<app>\n<guest id>`. */
export function mediaGuestOwnerSync(app: string, guestId: string): string {
  return `guest:${sha256Hex(`${app}\n${guestId}`)}`;
}

/** The media app name livediagram uploads under (livediagram/apps/api/src/media.ts MEDIA_APP). */
export const LIVEDIAGRAM_MEDIA_APP = 'livediagram.app';

/** The media service's owner for a new-side owner, as an app's api names it (livediagram/apps/api/src/media.ts
 *  mediaOwner, the same in every app): an account id as itself, a guest (`guest_<uuid>`) through the one-way hash
 *  scoped to the app (`livediagram.app` by default: every old image was uploaded there). */
export function mediaOwnerOf(owner: string, site = LIVEDIAGRAM_MEDIA_APP): string {
  return owner.startsWith('user_') ? owner : mediaGuestOwnerSync(site, owner);
}

/** An app's site id, as the media service, settings and Community name it (`livediagram.app`). */
export const siteOf = (app: string): string => `${app}.app`;

/** Community's one-way name for who copied a post (livediagram/apps/api/src/community-service.ts copierHash). */
export function copierHash(owner: string): string {
  return sha256Hex(`community-copier:${owner}`);
}

const b64url = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const SHARE_PASSWORD_ITERATIONS = 100_000;

/** A share password the old site still kept in plain text (from before hashing shipped), hashed the way the index
 *  stores it (liveworkspace/apps/index/src/password-hash.ts): `pbkdf2-sha256$<iterations>$<salt>$<hash>`. The salt is
 *  derived from the document's id rather than drawn at random, so a plan is deterministic; it is still one per
 *  document. */
export function hashPlainSharePassword(password: string, documentId: string): string {
  const salt = createHmac('sha256', 'liveworkspace-migrate share password salt')
    .update(documentId)
    .digest()
    .subarray(0, 16);
  const hash = pbkdf2Sync(password, salt, SHARE_PASSWORD_ITERATIONS, 32, 'sha256');
  return `pbkdf2-sha256$${SHARE_PASSWORD_ITERATIONS}$${b64url(salt)}$${b64url(hash)}`;
}

export function isHashedSharePassword(stored: string): boolean {
  return stored.startsWith('pbkdf2-sha256$');
}
