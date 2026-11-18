// The Forum check's daily tally (liveworkspace/docs/specs/007-community/community.md "The check"): how each day's checks
// ended and the Neurons they used, kept in `forum_counters` (no table of its own, no other binding) so the telemetry
// dashboard can show checks per day against the cap, and so the Neuron budget can be held.

import type { ForumChecksResponse } from '@liveworkspace/community';
import {
  FORUM_CHECKS_PER_DAY,
  FORUM_TALLY_PREFIX,
  FORUM_NEURONS_PER_DAY,
  FORUM_NEURONS_PER_M_INPUT,
  FORUM_NEURONS_PER_M_OUTPUT,
} from '../config';
import type { Env } from '../env';
import { DAY_MS } from './rate';

export type CheckOutcome = 'listed' | 'refused' | 'waiting';

const subjectOf = (what: CheckOutcome | 'neurons') => `${FORUM_TALLY_PREFIX}${what}`;
const dayOf = (now: number) => Math.floor(now / DAY_MS) * DAY_MS;

type Usage = { prompt_tokens?: unknown; completion_tokens?: unknown };

const tokens = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

/** The Neurons one check used, rounded up: from the tokens the model reports (`usage`), else about four characters a
 *  token of what was sent. */
export function neuronsOf(raw: unknown, sent: string): number {
  const usage = (raw as { usage?: Usage } | null)?.usage;
  const input = tokens(usage?.prompt_tokens) || Math.ceil(sent.length / 4);
  const output = tokens(usage?.completion_tokens);
  return Math.ceil(
    (input * FORUM_NEURONS_PER_M_INPUT + output * FORUM_NEURONS_PER_M_OUTPUT) / 1_000_000,
  );
}

/** Adds one check's outcome and Neurons to its day. */
export async function recordCheck(
  env: Env,
  outcome: CheckOutcome,
  neurons: number,
  now: number,
): Promise<void> {
  const bucket = dayOf(now);
  const add = (subject: string, by: number) =>
    env.COMMUNITY_DB.prepare(
      `INSERT INTO forum_counters (subject, bucket, n) VALUES (?1, ?2, ?3)
         ON CONFLICT (subject, bucket) DO UPDATE SET n = n + ?3`,
    ).bind(subject, bucket, by);
  const statements = [add(subjectOf(outcome), 1)];
  if (neurons > 0) statements.push(add(subjectOf('neurons'), neurons));
  await env.COMMUNITY_DB.batch(statements);
}

/** Whether the day's Neuron budget still has room. */
export async function withinNeuronBudget(env: Env, now: number): Promise<boolean> {
  const row = await env.COMMUNITY_DB.prepare(
    'SELECT n FROM forum_counters WHERE subject = ? AND bucket = ?',
  )
    .bind(subjectOf('neurons'), dayOf(now))
    .first<{ n: number }>();
  return (row?.n ?? 0) < FORUM_NEURONS_PER_DAY;
}

/** The last `days` days, oldest first, each with how its checks ended and the Neurons used, and the caps. */
export async function readChecks(
  env: Env,
  now: number,
  days: number,
): Promise<ForumChecksResponse> {
  const first = dayOf(now) - (days - 1) * DAY_MS;
  const result = await env.COMMUNITY_DB.prepare(
    'SELECT subject, bucket, n FROM forum_counters WHERE subject LIKE ? AND bucket >= ?',
  )
    .bind(`${FORUM_TALLY_PREFIX}%`, first)
    .all<{ subject: string; bucket: number; n: number }>();
  const byDay = new Map<number, Record<string, number>>();
  for (const { subject, bucket, n } of result.results ?? []) {
    const day = byDay.get(bucket) ?? {};
    day[subject.slice(FORUM_TALLY_PREFIX.length)] = n;
    byDay.set(bucket, day);
  }
  return {
    caps: { checks: FORUM_CHECKS_PER_DAY, neurons: FORUM_NEURONS_PER_DAY },
    days: Array.from({ length: days }, (_, i) => {
      const day = first + i * DAY_MS;
      const n = byDay.get(day) ?? {};
      return {
        day,
        listed: n.listed ?? 0,
        refused: n.refused ?? 0,
        waiting: n.waiting ?? 0,
        neurons: n.neurons ?? 0,
      };
    }),
  };
}
