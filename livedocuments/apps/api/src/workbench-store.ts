// A person's workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md "Data and persistence"): their
// pairing requests, pairings, tickets and sessions, in their own Durable Object (@liveworkspace/index-app
// workbench.ts, the class in workbench-store-do.ts). A route that knows the person reaches it by their id; a ticket
// redemption and an `lvw_` bearer reach it from the secret, which names its store.

import {
  workbenchStoreOf,
  workbenchStoreOfSecret,
  type WorkbenchReach as ItemReach,
  type WorkbenchStoreApi,
} from '@liveworkspace/index-app';
import type { Env } from './types';

export type PlanWorkbench = WorkbenchStoreApi<'document'>;

// What a ticket or session reaches, as this api names it: one plan, or the workspace from an optional folder.
export type WorkbenchReach =
  | { scope: 'document'; documentId: string; folderId: null }
  | { scope: 'workspace'; documentId: null; folderId: string | null };

export const itemReachOf = (reach: WorkbenchReach): ItemReach<'document'> =>
  reach.scope === 'document'
    ? { scope: 'document', itemId: reach.documentId, folderId: null }
    : { scope: 'workspace', itemId: null, folderId: reach.folderId };

export const planReachOf = (reach: ItemReach<'document'>): WorkbenchReach =>
  reach.scope === 'workspace'
    ? { scope: 'workspace', documentId: null, folderId: reach.folderId }
    : { scope: 'document', documentId: reach.itemId, folderId: null };

export const workbenchStore = (env: Pick<Env, 'WORKBENCH'>, personId: string): PlanWorkbench =>
  workbenchStoreOf<'document'>(env.WORKBENCH, personId);

// The store a ticket or session names, or null for a secret that names none.
export const workbenchStoreOfSecretIn = (
  env: Pick<Env, 'WORKBENCH'>,
  secret: string,
): PlanWorkbench | null => workbenchStoreOfSecret<'document'>(env.WORKBENCH, secret);
