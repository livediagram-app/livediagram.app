// The workbench store's Durable Object (store.ts), one per person, bound as WORKBENCH (wrangler.toml: a
// `new_sqlite_classes` migration). Every method is the store's, over RPC; the alarm sweeps what lapsed.

import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../env.ts';
import { WorkbenchCore, type WorkbenchStoreApi } from './store.ts';

type Core = WorkbenchCore;

export class WorkbenchStore extends DurableObject<Env> implements WorkbenchStoreApi {
  readonly core: Core;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.core = new WorkbenchCore(ctx.storage, ctx.id.toString());
  }

  openPairingRequest(...a: Parameters<Core['openPairingRequest']>) {
    return this.core.openPairingRequest(...a);
  }
  readPairingRequest(...a: Parameters<Core['readPairingRequest']>) {
    return this.core.readPairingRequest(...a);
  }
  answerPairingRequest(...a: Parameters<Core['answerPairingRequest']>) {
    return this.core.answerPairingRequest(...a);
  }
  pairingRequestStatus(...a: Parameters<Core['pairingRequestStatus']>) {
    return this.core.pairingRequestStatus(...a);
  }
  findPairing(...a: Parameters<Core['findPairing']>) {
    return this.core.findPairing(...a);
  }
  readPairing(...a: Parameters<Core['readPairing']>) {
    return this.core.readPairing(...a);
  }
  listPairings(...a: Parameters<Core['listPairings']>) {
    return this.core.listPairings(...a);
  }
  mintTicket(...a: Parameters<Core['mintTicket']>) {
    return this.core.mintTicket(...a);
  }
  consumeTicket(...a: Parameters<Core['consumeTicket']>) {
    return this.core.consumeTicket(...a);
  }
  openSession(...a: Parameters<Core['openSession']>) {
    return this.core.openSession(...a);
  }
  readSession(...a: Parameters<Core['readSession']>) {
    return this.core.readSession(...a);
  }
  endSession(...a: Parameters<Core['endSession']>) {
    return this.core.endSession(...a);
  }
  noteSessionRoom(...a: Parameters<Core['noteSessionRoom']>) {
    return this.core.noteSessionRoom(...a);
  }
  endAccess(...a: Parameters<Core['endAccess']>) {
    return this.core.endAccess(...a);
  }
  takeQuota(...a: Parameters<Core['takeQuota']>) {
    return this.core.takeQuota(...a);
  }
  close() {
    return this.core.close();
  }

  override async alarm(): Promise<void> {
    const { swept } = await this.core.alarm();
    if (swept > 0) console.log('[workbench] swept', { swept });
  }
}
