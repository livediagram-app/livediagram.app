// The chain a run carries across apps (liveworkspace/docs/specs/018-automations/automations.md "Loops across apps";
// blueprint cross-app.md "Running"): an id, the hops so far and each rule that ran in it. A run takes its event's,
// or starts one; a step elsewhere extends it; the index refuses a step whose chain already holds its rule, or one
// that would take a fourth hop. Pure.

import {
  CROSS_APP_CHAIN_RULES_MAX,
  CROSS_APP_HOPS_MAX,
  type CrossAppChain,
  type CrossAppRefusal,
} from '@liveworkspace/index-client';

const CHAIN_ID_MAX = 100;
const RULE_KEY_MAX = 300;

/** A chain as data arrives with it (an event, a door's body), or null for one that does not read. */
export function readChain(value: unknown): CrossAppChain | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { id, hops, rules } = value as Record<string, unknown>;
  if (typeof id !== 'string' || id.length === 0 || id.length > CHAIN_ID_MAX) return null;
  if (!Number.isInteger(hops) || (hops as number) < 0 || (hops as number) > CROSS_APP_HOPS_MAX)
    return null;
  if (
    !Array.isArray(rules) ||
    rules.length > CROSS_APP_CHAIN_RULES_MAX ||
    !rules.every((r) => typeof r === 'string' && r.length > 0 && r.length <= RULE_KEY_MAX)
  )
    return null;
  return { id, hops: hops as number, rules: [...(rules as string[])] };
}

/** The chain a run goes on in: its event's, else a fresh one named by the run. */
export const chainOf = (carried: unknown, runId: string): CrossAppChain =>
  readChain(carried) ?? { id: runId, hops: 0, rules: [] };

/** Why a step in this chain may not go from the rule `key`, or null when it may. */
export function chainStop(chain: CrossAppChain, key: string): CrossAppRefusal | null {
  if (chain.rules.includes(key)) return 'loop';
  if (chain.hops >= CROSS_APP_HOPS_MAX) return 'chain_long';
  return null;
}

/** The chain a target's write carries on: one hop more, the rule that sent it added. */
export const nextChain = (chain: CrossAppChain, key: string): CrossAppChain => ({
  id: chain.id,
  hops: chain.hops + 1,
  rules: [...chain.rules, key].slice(-CROSS_APP_CHAIN_RULES_MAX),
});
