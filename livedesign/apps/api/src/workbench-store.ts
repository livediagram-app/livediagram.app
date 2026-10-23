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

export type DesignWorkbench = WorkbenchStoreApi<'design'>;

// What a ticket or session reaches, as this api names it: one design, or the workspace from an optional folder.
export type WorkbenchReach =
  | { scope: 'design'; designId: string; folderId: null }
  | { scope: 'workspace'; designId: null; folderId: string | null };

export const itemReachOf = (reach: WorkbenchReach): ItemReach<'design'> =>
  reach.scope === 'design'
    ? { scope: 'design', itemId: reach.designId, folderId: null }
    : { scope: 'workspace', itemId: null, folderId: reach.folderId };

export const designReachOf = (reach: ItemReach<'design'>): WorkbenchReach =>
  reach.scope === 'workspace'
    ? { scope: 'workspace', designId: null, folderId: reach.folderId }
    : { scope: 'design', designId: reach.itemId, folderId: null };

export const workbenchStore = (env: Pick<Env, 'WORKBENCH'>, personId: string): DesignWorkbench =>
  workbenchStoreOf<'design'>(env.WORKBENCH, personId);

// The store a ticket or session names, or null for a secret that names none.
export const workbenchStoreOfSecretIn = (
  env: Pick<Env, 'WORKBENCH'>,
  secret: string,
): DesignWorkbench | null => workbenchStoreOfSecret<'design'>(env.WORKBENCH, secret);
