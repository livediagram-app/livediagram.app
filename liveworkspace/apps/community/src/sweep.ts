// The sweep (liveworkspace/docs/specs/007-community/community.md "The sweep"): every five minutes, from the cron, each
// app's posts checked longest ago are checked against the index through the app's own door, and a post whose document
// is gone, archived, in the Trash or someone else's is removed. It is what catches a post no room knows of (one the
// migration carried over), a purge whose `gone` was lost, and a document trashed or archived from the Explorer, which
// talks to the index alone. Per app and run: one indexed read, one request, one batch.

import {
  COMMUNITY_APPS,
  COMMUNITY_STATES_DOOR,
  COMMUNITY_SWEEP_BATCH,
  type CommunityApp,
  type CommunityAppSync,
  type CommunityDocumentState,
} from '@liveworkspace/community';
import { COMMUNITY_SWEEP_EVERY_MS, COMMUNITY_SWEEP_TIMEOUT_MS } from './config';
import { appKey, appOrigin, type Env } from './env';
import { syncStatements } from './posts';

type SweepRow = {
  id: string;
  document: string;
  share_code: string;
  owner: string;
  document_state: string;
  state: string;
};
type SweepState = CommunityDocumentState | 'gone';

const STATES = new Set<string>(['public', 'closed', 'away', 'gone']);

// The app's posts whose last check is older than COMMUNITY_SWEEP_EVERY_MS, oldest first, at most a batch.
export async function claimSweepBatch(
  env: Env,
  app: CommunityApp,
  now: number,
): Promise<SweepRow[]> {
  const result = await env.COMMUNITY_DB.prepare(
    `SELECT id, document, share_code, owner, document_state, state FROM posts WHERE app = ? AND checked_at < ?
      ORDER BY checked_at LIMIT ?`,
  )
    .bind(app, now - COMMUNITY_SWEEP_EVERY_MS, COMMUNITY_SWEEP_BATCH)
    .all<SweepRow>();
  return result.results ?? [];
}

// Where each post's document stands, as the app's door answers it, or null when it did not answer well.
export async function askAppStates(
  env: Env,
  app: CommunityApp,
  rows: SweepRow[],
): Promise<Map<string, SweepState> | null> {
  const key = appKey(env, app);
  const origin = appOrigin(env, app);
  if (!key || !origin) return null;
  let res: Response;
  try {
    res = await fetch(`${origin}${COMMUNITY_STATES_DOOR}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        posts: rows.map((r) => ({ id: r.document, code: r.share_code, owner: r.owner })),
      }),
      signal: AbortSignal.timeout(COMMUNITY_SWEEP_TIMEOUT_MS),
    });
  } catch (error) {
    console.warn('[community] sweep unanswered', { app, error: String(error) });
    return null;
  }
  const body = res.ok
    ? ((await res.json().catch(() => null)) as { states?: unknown } | null)
    : null;
  const states = body?.states;
  if (!Array.isArray(states)) {
    console.warn('[community] sweep unanswered', { app, status: res.status });
    return null;
  }
  const answers = new Map<string, SweepState>();
  for (const entry of states as unknown[]) {
    const e = entry as { id?: unknown; state?: unknown } | null;
    if (typeof e?.id === 'string' && typeof e.state === 'string' && STATES.has(e.state)) {
      answers.set(e.id, e.state as SweepState);
    }
  }
  return answers;
}

// Whether an answer changes the post: gone always does; away does for a listed post (it goes) or a state not yet
// away; public and closed only when the stored state differs.
const changes = (row: SweepRow, state: SweepState): boolean =>
  state === 'gone' || state !== row.document_state || (state === 'away' && row.state === 'listed');

// The answers as one sync, and the whole batch stamped checked, in one D1 batch. Answers how many posts it removed or
// changed the state of.
export async function applySweep(
  env: Env,
  app: CommunityApp,
  rows: SweepRow[],
  answers: Map<string, SweepState>,
  now: number,
): Promise<number> {
  const sync: CommunityAppSync = { documents: [], gone: [] };
  for (const row of rows) {
    const state = answers.get(row.document);
    if (!state || !changes(row, state)) continue;
    if (state === 'gone') sync.gone.push(row.document);
    else sync.documents.push({ document: row.document, state });
  }
  await env.COMMUNITY_DB.batch([
    ...syncStatements(env, app, sync),
    env.COMMUNITY_DB.prepare(
      'UPDATE posts SET checked_at = ? WHERE app = ? AND id IN (SELECT value FROM json_each(?))',
    ).bind(now, app, JSON.stringify(rows.map((r) => r.id))),
  ]);
  return sync.gone.length + sync.documents.length;
}

// One app's run: nothing due, or no answer, changes nothing.
export async function sweepApp(env: Env, app: CommunityApp, now: number): Promise<number> {
  if (!appKey(env, app) || !appOrigin(env, app)) return 0;
  const rows = await claimSweepBatch(env, app, now);
  if (rows.length === 0) return 0;
  const answers = await askAppStates(env, app, rows);
  if (!answers) return 0;
  const changed = await applySweep(env, app, rows, answers, now);
  if (changed > 0) console.info('[community] swept', { app, checked: rows.length, changed });
  return changed;
}

// The cron's run: every app in turn, one failing never stopping the others.
export async function sweepCommunity(env: Env, now = Date.now()): Promise<void> {
  for (const app of COMMUNITY_APPS) {
    try {
      await sweepApp(env, app, now);
    } catch (error) {
      console.error('[community] sweep failed', { app, error: String(error) });
    }
  }
}
