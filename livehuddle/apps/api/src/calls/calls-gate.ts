// Whether calls are on (docs/specs/012-collaboration/proximity-audio.md "Turning calls on"): the api's one decision,
// asked by every calls route and by /api/capabilities, so the mint route and the editor's controls never disagree.
//
// Today it is a hard production flag plus the secrets: production (livehuddle.app's own origin, from the hosted
// profile) refuses every session whatever is configured, until the calls kill switch (Work Tracker #316) is live.
// #316 extends this function with its switch; nothing else needs to change.
import type { CallsOffReason } from '@livehuddle/api-schema';
import hostedVars from '../../hosted-vars.json';
import type { Env } from '../types';

export type CallsGate = { open: true } | { open: false; reason: CallsOffReason };

// Production's public origin, as the deploy sets APP_BASE_URL on it (hosted-vars.json), and the bare host too.
const PRODUCTION_HOSTS: ReadonlySet<string> = new Set(
  [hostedVars.environments.production.APP_BASE_URL, 'https://livehuddle.app'].map(
    (url) => new URL(url).host,
  ),
);

/** Whether this Worker is livehuddle.app's production deployment. */
export function isProductionDeployment(env: Pick<Env, 'APP_BASE_URL'>): boolean {
  const base = env.APP_BASE_URL?.trim();
  if (!base) return false;
  try {
    return PRODUCTION_HOSTS.has(new URL(base).host);
  } catch {
    return false;
  }
}

/** Whether the Realtime app and the TURN key are both configured. */
export function callsConfigured(
  env: Pick<Env, 'REALTIME_APP_ID' | 'REALTIME_APP_TOKEN' | 'TURN_KEY_ID' | 'TURN_KEY_API_TOKEN'>,
): boolean {
  return !!(
    env.REALTIME_APP_ID &&
    env.REALTIME_APP_TOKEN &&
    env.TURN_KEY_ID &&
    env.TURN_KEY_API_TOKEN
  );
}

/**
 * The calls gate. Async so the kill switch (#316) can read its own state here without touching a caller.
 * Production is checked first: the flag holds even with every secret set.
 */
export async function callsGate(env: Env): Promise<CallsGate> {
  if (isProductionDeployment(env)) return { open: false, reason: 'production' };
  if (!callsConfigured(env)) return { open: false, reason: 'unconfigured' };
  return { open: true };
}
