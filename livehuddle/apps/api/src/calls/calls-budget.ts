// The calls budget poll (docs/specs/016-platform/calls-kill-switch.md "The budget poll"): every 15 minutes the
// worker's scheduled run prices the month's Realtime usage and, when the cost reaches a threshold this month has not
// yet tripped, tightens the switch, records the trip and emails the owner. It only ever tightens: turning calls back
// on is always a person's act.

import { callsBudgetEmail } from '../email/templates';
import { sendEmail } from '../email/client';
import type { Env } from '../types';
import {
  CALLS_MODE_KEY,
  parseCallsMode,
  stricterCallsMode,
  writeCallsMode,
  type CallsMode,
} from './calls-mode';
import {
  BYTES_PER_GB,
  fetchRealtimeEgressBytes,
  monthKey,
  realtimeCostUsd,
} from './realtime-usage';

export const CALLS_BUDGET_KEY = 'calls-budget';
export const DEFAULT_AUDIO_ONLY_AT_USD = 10;
export const DEFAULT_OFF_AT_USD = 25;

export type BudgetLevel = 'none' | 'audio-only' | 'off';
export type BudgetThresholds = { audioOnlyAtUsd: number; offAtUsd: number };

/** The highest level this month has tripped, so a later poll at the same level stays quiet. */
export type TripRecord = { month: string; level: BudgetLevel; costUsd: number; at: string };

export type PollOutcome = 'inert' | 'failed' | 'below' | 'already' | 'tripped';

const LEVEL_RANK: Record<BudgetLevel, number> = { none: 0, 'audio-only': 1, off: 2 };

function dollars(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** The two thresholds from the worker's vars, each falling back to its default when missing or unreadable. */
export function budgetThresholds(
  env: Pick<Env, 'CALLS_AUDIO_ONLY_AT_USD' | 'CALLS_OFF_AT_USD'>,
): BudgetThresholds {
  return {
    audioOnlyAtUsd: dollars(env.CALLS_AUDIO_ONLY_AT_USD, DEFAULT_AUDIO_ONLY_AT_USD),
    offAtUsd: dollars(env.CALLS_OFF_AT_USD, DEFAULT_OFF_AT_USD),
  };
}

/** The level a month's cost has reached. Nothing above the free tier never trips, whatever the thresholds say. */
export function budgetLevel(costUsd: number, t: BudgetThresholds): BudgetLevel {
  if (costUsd <= 0) return 'none';
  if (costUsd >= t.offAtUsd) return 'off';
  if (costUsd >= t.audioOnlyAtUsd) return 'audio-only';
  return 'none';
}

function parseTripRecord(raw: string | null): TripRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<TripRecord> | null;
    if (value && typeof value.month === 'string' && value.level && value.level in LEVEL_RANK) {
      return value as TripRecord;
    }
  } catch {
    // An unreadable record is no record: the worst case is one more email.
  }
  return null;
}

let warnedInert = false;

/** One poll. Returns what it did, for the log and the tests. Never throws. */
export async function pollCallsBudget(env: Env, now: Date = new Date()): Promise<PollOutcome> {
  const kv = env.CALLS_SWITCH;
  const testGb = env.CALLS_USAGE_TEST_GB?.trim() ? Number(env.CALLS_USAGE_TEST_GB) : null;
  const canMeasure =
    (testGb !== null && Number.isFinite(testGb)) ||
    Boolean(env.CALLS_ANALYTICS_TOKEN && env.CALLS_USAGE_ACCOUNT_ID);
  if (!kv || !canMeasure) {
    if (!warnedInert) {
      warnedInert = true;
      console.log(
        '[calls] budget poll is off: it needs CALLS_SWITCH, CALLS_ANALYTICS_TOKEN and CALLS_USAGE_ACCOUNT_ID',
      );
    }
    return 'inert';
  }

  let bytes: number;
  try {
    bytes =
      testGb !== null && Number.isFinite(testGb)
        ? testGb * BYTES_PER_GB
        : await fetchRealtimeEgressBytes({
            accountId: env.CALLS_USAGE_ACCOUNT_ID!,
            token: env.CALLS_ANALYTICS_TOKEN!,
            now,
          });
  } catch (err) {
    console.error('[calls] could not read Realtime usage; the switch is unchanged', err);
    return 'failed';
  }

  const thresholds = budgetThresholds(env);
  const costUsd = realtimeCostUsd(bytes);
  const level = budgetLevel(costUsd, thresholds);
  const month = monthKey(now);

  try {
    const stored = parseTripRecord(await kv.get(CALLS_BUDGET_KEY));
    const tripped: BudgetLevel = stored && stored.month === month ? stored.level : 'none';
    if (level === 'none') return 'below';
    if (LEVEL_RANK[level] <= LEVEL_RANK[tripped]) return 'already';

    // Switch first, then the record, then the email: a crash part way never sends a second email for the same
    // level, and never leaves the switch looser than the record says.
    // Read past the isolate's cache: the poll must tighten what the key says now.
    const before = parseCallsMode(await kv.get(CALLS_MODE_KEY));
    const after: CallsMode = stricterCallsMode(before, level);
    if (after !== before) await writeCallsMode(kv, after, now.getTime());
    const record: TripRecord = { month, level, costUsd, at: now.toISOString() };
    await kv.put(CALLS_BUDGET_KEY, JSON.stringify(record));
    console.log(
      `[calls] budget tripped ${level} at $${costUsd} this month; the switch is ${after}`,
    );

    if (env.CALLS_ALERT_TO) {
      await sendEmail(env, {
        to: env.CALLS_ALERT_TO,
        ...callsBudgetEmail(env, {
          level,
          usageGb: bytes / BYTES_PER_GB,
          costUsd,
          thresholdUsd: level === 'off' ? thresholds.offAtUsd : thresholds.audioOnlyAtUsd,
          mode: after,
        }),
      });
    }
    return 'tripped';
  } catch (err) {
    console.error('[calls] budget poll could not update the switch', err);
    return 'failed';
  }
}

/** Forget the once-per-isolate log line (tests). */
export function resetCallsBudgetLog(): void {
  warnedInert = false;
}
