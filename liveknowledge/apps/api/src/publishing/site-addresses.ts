// Who holds each site address (docs/specs/030-knowledgebase/blueprints/publishing.md P7). An address is one
// knowledgebase's, across every knowledgebase, so it is kept outside any of them: in its own instance of the worker's
// DOCUMENT_ROOM Durable Object (no new binding, class or migration), under a name no document id can take (ids are
// UUIDs, and none starts with `~`), as knowledge/setup-draft-count.ts keeps its counts. The instance holds one
// storage key and never a document's schema. A Durable Object runs one request's storage calls alone, so two claims
// of one address cannot both win.
import type { Env } from '../types';

/** The record an address's instance keeps: whose it is, and where it moved when the site took another. */
export type SiteAddressRecord = { documentId: string; movedTo?: string };

export type SiteAddressOp =
  | { kind: 'read' }
  | { kind: 'claim'; documentId: string }
  | { kind: 'move'; documentId: string; to: string }
  | { kind: 'release'; documentId: string };

export type SiteAddressAnswer = SiteAddressRecord | null | 'held' | 'taken';

/** The storage key of the record. */
export const SITE_ADDRESS_KEY = 'site';

/** The DOCUMENT_ROOM instance that holds `address`. */
export const siteAddressRoomName = (address: string): string => `~kb-site:${address}`;

type AddressStorage = Pick<DurableObjectStorage, 'get' | 'put' | 'delete'>;

/** The room's side of one call. */
export async function siteAddressIn(
  storage: AddressStorage,
  op: SiteAddressOp,
): Promise<SiteAddressAnswer> {
  const record = (await storage.get<SiteAddressRecord>(SITE_ADDRESS_KEY)) ?? null;
  if (op.kind === 'read') return record;
  const ours = record?.documentId === op.documentId;
  if (op.kind === 'claim') {
    if (record && !ours) return 'taken';
    // Claimed back after a move: it is the site's own address again.
    await storage.put(SITE_ADDRESS_KEY, { documentId: op.documentId });
    return 'held';
  }
  if (!ours) return 'taken';
  if (op.kind === 'move') await storage.put(SITE_ADDRESS_KEY, { documentId: op.documentId, movedTo: op.to });
  else await storage.delete(SITE_ADDRESS_KEY);
  return 'held';
}

type AddressRpc = { siteAddress(op: SiteAddressOp): Promise<SiteAddressAnswer> };

/** The worker's (or another room's) call to the instance that holds `address`. */
export function siteAddress(
  env: Pick<Env, 'DOCUMENT_ROOM'>,
  address: string,
  op: SiteAddressOp,
): Promise<SiteAddressAnswer> {
  const ns = env.DOCUMENT_ROOM;
  const stub = ns.get(ns.idFromName(siteAddressRoomName(address))) as unknown as AddressRpc;
  return stub.siteAddress(op);
}
