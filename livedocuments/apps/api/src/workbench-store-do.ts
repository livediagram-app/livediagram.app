// The workbench's Durable Object, one per person (workbench-store.ts): @liveworkspace/index-app's store, told how
// this app reaches liveworkspace (to check tokens) and closes a pairing's sessions in a plan's room.

import { DurableObject } from 'cloudflare:workers';
import { workbenchStoreClass } from '@liveworkspace/index-app';
import { accountCredentials } from './auth/accounts';
import { closeWorkbenchSessions } from './room-access-client';
import type { Env } from './types';

export class WorkbenchStore extends workbenchStoreClass<Env, 'document'>(DurableObject, (env) => ({
  credentials: () => accountCredentials(env),
  closeRoom: (planId, pairingId) => closeWorkbenchSessions(env, planId, pairingId),
})) {}
