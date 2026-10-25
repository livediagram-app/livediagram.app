// The person's Durable Object (liveworkspace/docs/drive.md "The service"): one SQLite-backed `DriveMirror` per
// connected account, by `idFromName(accountId)`. A thin shell: it wires its storage, its alarm and the Worker's
// configuration into the Mirror (mirror.ts) and exposes its calls over RPC.

import { DurableObject } from 'cloudflare:workers';
import { createAppDoors } from '../app-doors';
import { createIndexApi } from '../index-api';
import { environmentOf, googleConfig, publicOrigin, type Env } from '../env';
import { workerRasterise } from '../thumbnail';
import type { OpenTarget } from '../open';
import { Mirror } from './mirror';
import { MirrorStore } from './store';

export class DriveMirror extends DurableObject<Env> {
  private readonly store: MirrorStore;
  private readonly mirror: Mirror;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.store = new MirrorStore(ctx.storage.sql);
    const origin = publicOrigin(env);
    this.mirror = new Mirror({
      store: this.store,
      scheduler: {
        getAlarm: () => ctx.storage.getAlarm(),
        setAlarm: (at) => ctx.storage.setAlarm(at),
        deleteAlarm: () => ctx.storage.deleteAlarm(),
      },
      google: googleConfig(env),
      tokenKey: env.DRIVE_TOKEN_KEY ?? '',
      origin,
      environment: environmentOf(env),
      pushAddress: `${origin}/api/drive/push`,
      index: createIndexApi(env),
      doors: createAppDoors(env),
      rasterise: workerRasterise,
      now: () => Date.now(),
      newId: () => crypto.randomUUID(),
    });
  }

  isConnected(personId: string) {
    return this.mirror.isConnected(personId);
  }

  // Not `connect`: that name is the Durable Object's own (TCP sockets).
  connectGoogle(personId: string, code: string, redirectUri: string) {
    return this.mirror.connect(personId, code, redirectUri);
  }

  connection(personId: string) {
    return this.mirror.connectionSummary(personId);
  }

  confirmSwitch(personId: string) {
    return this.mirror.confirmSwitch(personId);
  }

  cancelSwitch(personId: string) {
    return this.mirror.cancelSwitch(personId);
  }

  async disconnect(personId: string): Promise<boolean> {
    const had = await this.mirror.disconnect(personId);
    // Nothing of the person's is kept: the object's storage goes whole.
    if (had) {
      await this.ctx.storage.deleteAll();
      this.store.forgetSchema();
    }
    return had;
  }

  signal(personId: string) {
    return this.mirror.signal(personId);
  }

  check(personId: string) {
    return this.mirror.check(personId);
  }

  marks(personId: string) {
    return this.mirror.marks(personId);
  }

  pickerToken(personId: string) {
    return this.mirror.pickerToken(personId);
  }

  adopt(personId: string, folderId: string, itemId: string | null) {
    return this.mirror.adopt(personId, folderId, itemId);
  }

  open(personId: string, target: OpenTarget) {
    return this.mirror.open(personId, target);
  }

  importFile(personId: string, target: OpenTarget) {
    return this.mirror.importFile(personId, target);
  }

  override async alarm(): Promise<void> {
    await this.mirror.alarm();
  }
}
