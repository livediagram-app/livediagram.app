// Reaching a person's workbench store from the routes (store.ts).

import type { WorkbenchCore } from './store.ts';
import { storeIdOfSecret } from './store-types.ts';

// The store's methods as the routes call them, on the Durable Object's stub.
export type WorkbenchStoreApi = Pick<
  WorkbenchCore,
  | 'openPairingRequest'
  | 'readPairingRequest'
  | 'answerPairingRequest'
  | 'pairingRequestStatus'
  | 'findPairing'
  | 'readPairing'
  | 'listPairings'
  | 'mintTicket'
  | 'consumeTicket'
  | 'openSession'
  | 'readSession'
  | 'endSession'
  | 'noteSessionRoom'
  | 'endAccess'
  | 'takeQuota'
  | 'close'
>;

// The namespace the Worker binds the class to, as these helpers need it.
export type WorkbenchNamespace = {
  idFromName(name: string): DurableObjectId;
  idFromString(id: string): DurableObjectId;
  get(id: DurableObjectId): unknown;
};

// The person's store.
export function workbenchStoreOf(ns: WorkbenchNamespace, personId: string): WorkbenchStoreApi {
  return ns.get(ns.idFromName(personId)) as WorkbenchStoreApi;
}

// The store a ticket or session secret names, or null for a secret with no (or a malformed) suffix.
export function workbenchStoreOfSecret(
  ns: WorkbenchNamespace,
  secret: string,
): WorkbenchStoreApi | null {
  const id = storeIdOfSecret(secret);
  if (!id) return null;
  try {
    return ns.get(ns.idFromString(id)) as WorkbenchStoreApi;
  } catch {
    return null;
  }
}
