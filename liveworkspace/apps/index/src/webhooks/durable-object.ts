// The webhook dispatcher (liveworkspace/docs/specs/004-index/webhooks.md "Delivery"): one Durable Object, bound as
// WEBHOOKS (wrangler.toml), whose alarm sends what the outbox holds (dispatch.ts) and sleeps until the next retry.
// A request that queued a delivery wakes it with `kick` after answering; the 15-minute cron wakes it too, in case a
// wake was lost. It keeps nothing of its own: the deliveries are the index's D1 rows.

import { DurableObject } from 'cloudflare:workers';
import { roomAlarmAt } from '@liveworkspace/api-kit/room-alarm';
import type { Env } from '../env';
import { accountsAdminTeams } from '../accounts-access';
import { dohResolve } from './address';
import { dispatch, type DispatchDeps } from './dispatch';

// A kick while the alarm is set further off than this brings it forward to now.
const KICK_SLACK_MS = 500;

export class WebhookDispatcher extends DurableObject<Env> {
  // Swapped in tests.
  deps: DispatchDeps = {
    now: () => Date.now(),
    fetch: (input, init) => fetch(input, init),
    resolve: dohResolve,
    adminTeams: accountsAdminTeams(this.env),
  };

  /** Something was queued: run the alarm now unless it is about to run anyway. */
  async kick(): Promise<void> {
    const now = Date.now();
    const at = await this.ctx.storage.getAlarm();
    if (at === null || at > now + KICK_SLACK_MS) await this.ctx.storage.setAlarm(now);
  }

  override async alarm(): Promise<void> {
    const result = await dispatch(this.env, this.deps);
    if (result.delivered + result.failed + result.retrying > 0) {
      console.log('[webhooks] dispatched', JSON.stringify(result));
    }
    if (result.nextAt !== null) {
      // Never sooner than a second from now: a row stuck due must not fire the alarm back to back.
      await this.ctx.storage.setAlarm(roomAlarmAt(result.nextAt, Date.now()));
    }
  }
}
