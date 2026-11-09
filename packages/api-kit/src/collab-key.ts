// The server's collab key (each product's docs/specs/013-workspace/share-roles.md "The collab key"; blueprint
// docs/specs/013-workspace/blueprints/share-roles.md "Collab key"). The public id a person's dots, responses and
// comment reactions are recorded under, derived from who they are, never read from a request: the same on every
// device and every document, and one-way, so it gives the account or guest id away to nobody. The api's room upgrade
// forwards it on COLLAB_KEY_HEADER, the room pins it on the session, and the room's gate refuses an answer naming
// any other key.

import { COLLAB_KEY_LENGTH, isCollabKey } from '@liveworkspace/api-schema/collab-key';
import { sha256Hex } from '@liveworkspace/api-schema/sha256';

/** The trust header the api's room upgrade sets on every path: the session's collab key, empty when it has none. */
export const COLLAB_KEY_HEADER = 'X-Verified-Collab-Key';

/** A person's collab key: the first COLLAB_KEY_LENGTH hex characters of SHA-256 of the versioned label and their id. */
export async function collabKeyFor(person: string): Promise<string> {
  const digest = await sha256Hex(new TextEncoder().encode(`liveworkspace:collab:v1:${person}`));
  return digest.slice(0, COLLAB_KEY_LENGTH);
}

/** A random collab key, for a session with no identity: nobody else can be handed it, and it lasts as the socket. */
export function mintCollabKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(COLLAB_KEY_LENGTH / 2));
  let out = '';
  for (const b of bytes) out += (b < 16 ? '0' : '') + b.toString(16);
  return out;
}

/** The key a new session keeps: the upgrade's header when it is a key's shape, else a minted one. */
export function sessionCollabKey(header: string | null | undefined): string {
  return isCollabKey(header) ? header : mintCollabKey();
}

/**
 * Whether an op records an answer under a key that is not the sender's: a `vote` naming another `voter`, or an
 * `el-delta` `response` naming another `participantId`. The room drops such an op at every level, an Editor's
 * included; a sender with no key may record no answer. A reaction is not judged here: the room stamps its `by`.
 */
export function namesAnotherPerson(op: unknown, key: string | undefined): boolean {
  if (typeof op !== 'object' || op === null) return false;
  const o = op as { kind?: unknown; voter?: unknown; delta?: unknown };
  if (o.kind === 'vote') return key === undefined || o.voter !== key;
  if (o.kind !== 'el-delta' || typeof o.delta !== 'object' || o.delta === null) return false;
  const d = o.delta as { kind?: unknown; participantId?: unknown };
  return d.kind === 'response' && (key === undefined || d.participantId !== key);
}
