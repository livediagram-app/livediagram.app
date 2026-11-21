import { describe, expect, it, vi } from 'vitest';
import { claimAddresses } from '../automation-addresses';
import { makeHookSecret, type HookCall } from '../automation-incoming';
import { queued, world, type World } from '../item/test-kit';
import { incomingItemHook, itemEmailOptOut, type ItemDoorRoom } from './doors';

const enc = new TextEncoder();

function roomOf(w: World, started = true) {
  const asked = { ensure: 0, arm: 0 };
  const room: ItemDoorRoom = {
    started: () => started,
    ensure: () => void (asked.ensure += 1),
    engine: w.engine,
    arm: () => void (asked.arm += 1),
  };
  return { room, asked };
}

const call = (secret: string): HookCall => ({
  body: enc.encode('{}'),
  authorization: `Bearer ${secret}`,
  signature: null,
});

describe('an Incoming Webhook call at the room', () => {
  it('answers an item never started as a wrong secret, and does not start it', async () => {
    const w = world();
    const { room, asked } = roomOf(w, false);
    expect(await incomingItemHook(room, 'r1', call('lwh_x'))).toMatchObject({ status: 401 });
    expect(asked).toEqual({ ensure: 0, arm: 0 });
  });

  it('queues the run for a good secret, and asks for the alarm', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = world();
    const rule = w.rule({ trigger: { kind: 'incoming_webhook' } });
    const { secret } = await makeHookSecret(w.kit.hookUrl, w.sql, rule.id, Date.now());
    const { room, asked } = roomOf(w);
    expect(await incomingItemHook(room, rule.id, call(secret))).toMatchObject({ status: 202 });
    expect(asked).toEqual({ ensure: 1, arm: 1 });
    expect(queued(w.sql)).toHaveLength(1);
    vi.restoreAllMocks();
  });
});

describe('a rule email’s unsubscribe at the room', () => {
  it('stops a token’s address, and answers false for one the item never made or an item never started', () => {
    const w = world();
    const never = roomOf(w, false);
    expect(itemEmailOptOut(never.room, 'tok')).toBe(false);
    expect(never.asked.ensure).toBe(0);
    const { room } = roomOf(w);
    expect(itemEmailOptOut(room, 'nope')).toBe(false);
    const claimed = claimAddresses(w.sql, ['kim@example.com'], Date.now());
    const token = JSON.stringify(claimed).match(/"token":"([^"]+)"/)?.[1] ?? '';
    expect(token).not.toBe('');
    expect(itemEmailOptOut(room, token)).toBe(true);
  });
});
