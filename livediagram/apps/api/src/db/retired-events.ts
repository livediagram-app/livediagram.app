// The retired `events` table (docs/specs/017-telemetry/telemetry.md "Where events are stored"): telemetry
// now lives in the liveworkspace service's own database, so nothing writes here any more. The daily
// sweep still runs, so the rows already stored age out under the same 60-day promise they were
// collected with, and the table is empty 60 days after the switch.

import type { Env } from '../types';

export async function deleteOldEvents(env: Env, cutoffMs: number): Promise<number> {
  const result = await env.DB.prepare('DELETE FROM events WHERE ts < ?').bind(cutoffMs).run();
  return result.meta.changes ?? 0;
}
