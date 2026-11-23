// Free's limits as this deployment gives them (subscription.md "Trying a limit locally"). In development only, the
// var DEV_FREE_LIMITS (JSON) lowers them, so a reviewer can meet a limit by hand: 500 runs a month is three with
// `{"automationRunsPerMonth":3}`. Anywhere else the var is ignored and Free is the contract's own.

import { TIER_LIMITS, type LimitKey, type Limits } from '@liveworkspace/subscription';
import type { Env } from './env';

let read: string | undefined;
let limits: Limits = TIER_LIMITS.free;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The overrides a JSON value holds: only known numeric limits, each a whole number of zero or more. */
export function parseDevLimits(value: string | undefined): Partial<Limits> {
  if (!value) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return {};
  }
  if (!isRecord(parsed)) return {};
  const out: Partial<Record<LimitKey, number>> = {};
  for (const key of Object.keys(TIER_LIMITS.free) as LimitKey[]) {
    const given = parsed[key];
    if (typeof TIER_LIMITS.free[key] !== 'number') continue;
    if (typeof given === 'number' && Number.isInteger(given) && given >= 0) out[key] = given;
  }
  return out as Partial<Limits>;
}

/** Reads the var once per value. Called at the top of every request, before anything asks for a limit. */
export function readDevLimits(env: Pick<Env, 'ENVIRONMENT' | 'DEV_FREE_LIMITS'>): void {
  const value = env.ENVIRONMENT === 'development' ? env.DEV_FREE_LIMITS : undefined;
  if (value === read) return;
  read = value;
  limits = { ...TIER_LIMITS.free, ...parseDevLimits(value) };
}

/** Free's limits here: the contract's, or in development what DEV_FREE_LIMITS lowered them to. */
export function freeLimits(): Limits {
  return limits;
}
