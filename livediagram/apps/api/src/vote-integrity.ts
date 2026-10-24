import { sha256Hex } from '@livediagram/api-schema';
import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import { personTagFor } from './person-tag';
import { json } from './responses';
import type { DocumentRouteContext } from './routes/context';
import type { DocumentEnv } from './types';

// Who one voter is (docs/specs/012-collaboration/vote-integrity.md). A verified account is one voter. A guest id costs
// nothing to make, so guests are counted against their network: at most this many distinct guest voters per network
// take part in one target (a document over REST, a poll in the room). Far above a household or an office on one
// address, far below what a flood needs.
export const GUEST_VOTERS_PER_NETWORK = 100;

// The caller's network as stored: a SHA-256 of the target's scope and the network key, so it cannot be read back or
// matched across documents. 32 hex characters (128 bits) keeps the room's poll state and the ledger rows small.
export async function networkTagFor(scope: string, networkKey: string): Promise<string> {
  const digest = await sha256Hex(
    new TextEncoder().encode(`livediagram:vote-network:v1:${scope}:${networkKey}`),
  );
  return digest.slice(0, 32);
}

// Admit `personTag` as a guest voter of `documentId` from `networkTag`: true when it already is one, or the network
// has room for another. The voters live in the document's own store (its Durable Object, document-schema.ts), so
// they go with the document. One batch: a conditional insert, then a read of the caller's row, so two guests racing
// for the last place cannot both take it.
export async function admitGuestVoter(
  env: DocumentEnv,
  documentId: string,
  networkTag: string,
  personTag: string,
  now = Date.now(),
): Promise<boolean> {
  const db = env.DOCUMENT_DB;
  const results = await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO guest_voters (document_id, network_tag, person_tag, created_at)
       SELECT ?1, ?2, ?3, ?4
        WHERE (SELECT COUNT(*) FROM guest_voters WHERE document_id = ?1 AND network_tag = ?2) < ?5`,
      )
      .bind(documentId, networkTag, personTag, now, GUEST_VOTERS_PER_NETWORK),
    db
      .prepare(
        `SELECT 1 AS admitted FROM guest_voters
        WHERE document_id = ? AND network_tag = ? AND person_tag = ?`,
      )
      .bind(documentId, networkTag, personTag),
  ]);
  return (results[1]?.results?.length ?? 0) > 0;
}

// The REST gate for a vote that ADDS a vote (a Q&A upvote). Null = go ahead; a Response = refused.
// A verified account votes freely; a guest is admitted against its network's cap. Withdrawing never calls this.
export async function refuseGuestVoteOverCap(
  ctx: DocumentRouteContext,
  documentId: string,
  owner: string,
): Promise<Response | null> {
  if (ctx.verifiedUserId) return null;
  const networkTag = await networkTagFor(documentId, clientRateKey(ctx.request));
  const personTag = await personTagFor(documentId, owner);
  if (await admitGuestVoter(ctx.env, documentId, networkTag, personTag)) return null;
  console.warn('[vote-integrity] guest voter refused', { documentId });
  return json({ error: 'vote_limit' }, { status: 429 });
}
