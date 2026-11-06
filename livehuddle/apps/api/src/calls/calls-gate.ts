// Whether calls are on (docs/specs/012-collaboration/proximity-audio.md "Turning calls on"): the api's one decision,
// asked by every calls route and by /api/capabilities, so the mint route and the editor's controls never disagree.
//
// Two checks, in order: the secrets, then the calls kill switch (docs/specs/016-platform/calls-kill-switch.md "The mint
// route"). Every deployment, production included, has calls once its secrets are set and the switch allows them.
import type { CallsOffReason } from '@livehuddle/api-schema';
import type { Env } from '../types';
import { callsMode } from './calls-mode';

/** Open, with the switch's mode (`on` or `audio-only`); or shut, and why. */
export type CallsGate =
  { open: true; mode: 'on' | 'audio-only' } | { open: false; reason: CallsOffReason };

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

/** The calls gate. The switch is read last, so a deployment without calls never reads KV for them. */
export async function callsGate(env: Env): Promise<CallsGate> {
  if (!callsConfigured(env)) return { open: false, reason: 'unconfigured' };
  const mode = await callsMode(env);
  if (mode === 'off') return { open: false, reason: 'paused' };
  return { open: true, mode };
}
