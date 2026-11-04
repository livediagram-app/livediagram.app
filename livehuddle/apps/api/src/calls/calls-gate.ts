// Whether calls are on (docs/specs/012-collaboration/proximity-audio.md "Turning calls on"): the api's one decision,
// asked by every calls route and by /api/capabilities, so the mint route and the editor's controls never disagree.
//
// Three checks, in order: a hard production flag (livehuddle.app's own origin, from the hosted profile, refuses every
// session whatever is configured), the secrets, then the calls kill switch (docs/specs/016-platform/
// calls-kill-switch.md "The mint route"), which is a further gate beside the flag, never its replacement.
import type { CallsOffReason } from '@livehuddle/api-schema';
import hostedVars from '../../hosted-vars.json';
import type { Env } from '../types';
import { callsMode } from './calls-mode';

/** Open, with the switch's mode (`on` or `audio-only`); or shut, and why. */
export type CallsGate =
  { open: true; mode: 'on' | 'audio-only' } | { open: false; reason: CallsOffReason };

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
 * The calls gate. Production is checked first: the flag holds even with every secret set and the switch on. The
 * switch is read last, so a deployment without calls never reads KV for them.
 */
export async function callsGate(env: Env): Promise<CallsGate> {
  if (isProductionDeployment(env)) return { open: false, reason: 'production' };
  if (!callsConfigured(env)) return { open: false, reason: 'unconfigured' };
  const mode = await callsMode(env);
  if (mode === 'off') return { open: false, reason: 'paused' };
  return { open: true, mode };
}
