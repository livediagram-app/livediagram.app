import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../types';
import { callsConfigured, callsGate } from './calls-gate';
import { resetCallsModeCache } from './calls-mode';
import { fakeKv } from './fake-kv';

// docs/specs/012-collaboration/proximity-audio.md "Turning calls on".
const secrets = {
  REALTIME_APP_ID: 'app',
  REALTIME_APP_TOKEN: 'secret',
  TURN_KEY_ID: 'turn',
  TURN_KEY_API_TOKEN: 'turn-secret',
};
const env = (e: Partial<Env>) => e as Env;

beforeEach(() => resetCallsModeCache());

describe('the calls gate', () => {
  it('is open on production once the secrets are set and the switch allows it', async () => {
    for (const APP_BASE_URL of ['https://www.livehuddle.app', 'https://livehuddle.app']) {
      const CALLS_SWITCH = fakeKv({ 'calls-mode': 'on' });
      expect(await callsGate(env({ ...secrets, APP_BASE_URL, CALLS_SWITCH }))).toEqual({
        open: true,
        mode: 'on',
      });
      expect(await callsGate(env({ APP_BASE_URL, CALLS_SWITCH }))).toEqual({
        open: false,
        reason: 'unconfigured',
      });
    }
    resetCallsModeCache();
    const paused = fakeKv({ 'calls-mode': 'off' });
    expect(
      await callsGate(
        env({ ...secrets, APP_BASE_URL: 'https://www.livehuddle.app', CALLS_SWITCH: paused }),
      ),
    ).toEqual({ open: false, reason: 'paused' });
  });

  it('is shut while any secret is missing', async () => {
    expect(await callsGate(env({}))).toEqual({ open: false, reason: 'unconfigured' });
    for (const key of Object.keys(secrets)) {
      const partial = { ...secrets, [key]: undefined };
      expect((await callsGate(env(partial))).open).toBe(false);
    }
    expect(callsConfigured(secrets)).toBe(true);
  });

  it('is open on staging, locally and on a fork with the secrets', async () => {
    for (const APP_BASE_URL of [
      'https://staging.livehuddle.app',
      'http://localhost:3500',
      undefined,
      'not a url',
    ]) {
      expect(await callsGate(env({ ...secrets, APP_BASE_URL }))).toEqual({
        open: true,
        mode: 'on',
      });
    }
  });

  it('reads the kill switch last: off pauses, audio only stays open with its mode', async () => {
    const CALLS_SWITCH = fakeKv({ 'calls-mode': 'off' });
    expect(await callsGate(env({ ...secrets, CALLS_SWITCH }))).toEqual({
      open: false,
      reason: 'paused',
    });
    resetCallsModeCache();
    CALLS_SWITCH.store.set('calls-mode', 'audio-only');
    expect(await callsGate(env({ ...secrets, CALLS_SWITCH }))).toEqual({
      open: true,
      mode: 'audio-only',
    });
    // Unconfigured is answered before the switch is read.
    resetCallsModeCache();
    const unread = fakeKv({ 'calls-mode': 'off' });
    expect(await callsGate(env({ CALLS_SWITCH: unread }))).toEqual({
      open: false,
      reason: 'unconfigured',
    });
    expect(unread.gets).toBe(0);
  });
});
