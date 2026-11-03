// One scope's export (liveworkspace/docs/specs/003-accounts/data-export.md "The service"), named by its key: a SQLite
// Durable Object whose alarm builds the zip a chunk at a time. The work is steps.ts's; this binds it to the object's
// storage, its alarm and the Worker's bindings.

import { DurableObject } from 'cloudflare:workers';
import type { ExportView, StartExportCall } from '@liveworkspace/data-export';
import type { Env } from '../env';
import { workerRasterise } from '../picture';
import { createSources } from '../sources';
import { removeJob, runChunk, startJob, type ExportBucket, type RunContext } from './steps';
import { JobStore, viewOf, type Sql } from './store';

const log = (event: string, fields: Record<string, unknown>) =>
  console.log(`[export] ${event}`, JSON.stringify(fields));

const newExportId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `ex_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
};

export class DataExport extends DurableObject<Env> {
  private readonly store: JobStore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.store = new JobStore(ctx.storage.sql as unknown as Sql);
  }

  private bucket(): ExportBucket {
    const bucket = this.env.EXPORTS;
    if (!bucket) throw new Error('export: no EXPORTS bucket');
    return bucket as unknown as ExportBucket;
  }

  async start(
    call: StartExportCall,
  ): Promise<{ ok: true; view: ExportView } | { ok: false; error: 'export_running' }> {
    const started = await startJob(
      { store: this.store, bucket: this.bucket(), log },
      call,
      newExportId(),
      Date.now(),
    );
    if (!started.ok) return started;
    await this.ctx.storage.setAlarm(Date.now());
    return { ok: true, view: viewOf(started.job) };
  }

  async status(): Promise<ExportView | null> {
    const job = this.store.job();
    return job ? viewOf(job) : null;
  }

  async remove(): Promise<void> {
    await removeJob({ store: this.store, bucket: this.bucket() });
    await this.ctx.storage.deleteAlarm();
  }

  override async alarm(): Promise<void> {
    let requests = 0;
    const context: RunContext = {
      store: this.store,
      sources: createSources(this.env, () => (requests += 1)),
      bucket: this.bucket(),
      rasterise: workerRasterise,
      now: () => Date.now(),
      requests: () => requests,
      transaction: (fn) => this.ctx.storage.transactionSync(fn),
      log,
    };
    const { alarmAt } = await runChunk(context);
    if (alarmAt !== null) await this.ctx.storage.setAlarm(alarmAt);
  }
}
