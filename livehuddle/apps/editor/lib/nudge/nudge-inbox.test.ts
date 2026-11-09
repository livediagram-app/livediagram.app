// Nudge on this screen (docs/specs/012-collaboration/nudge.md "Nudging", "The wire"): the client cooldown, the sender
// door and the inbox.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NUDGE_COOLDOWN_MS } from '@livehuddle/api-schema';
import {
  holdNudgeCooldown,
  nudgeCooldownLeft,
  onNudge,
  receiveNudgeOp,
  resetNudges,
  sendNudge,
  setNudgeSender,
} from './nudge-inbox';

const sam = { id: 's1', key: 'k-sam', name: 'Sam' };

beforeEach(() => resetNudges());
afterEach(() => resetNudges());

describe('sendNudge', () => {
  it('sends nothing without a room', () => {
    expect(sendNudge(sam, 0)).toBe(false);
    expect(nudgeCooldownLeft(sam, 0)).toBe(0);
  });

  it('sends once per 2 minutes per person, by their key across reconnects', () => {
    const send = vi.fn();
    setNudgeSender(send);
    expect(sendNudge(sam, 0)).toBe(true);
    expect(send).toHaveBeenCalledWith('s1');
    expect(sendNudge({ ...sam, id: 's9' }, 1_000)).toBe(false);
    expect(nudgeCooldownLeft({ id: 's9', key: 'k-sam' }, 1_000)).toBe(NUDGE_COOLDOWN_MS - 1_000);
    expect(sendNudge({ id: 's2', name: 'Kim' }, 1_000)).toBe(true);
    expect(sendNudge(sam, NUDGE_COOLDOWN_MS)).toBe(true);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("takes the room's time left on a refusal", () => {
    holdNudgeCooldown(sam, 42_000, 5_000);
    expect(nudgeCooldownLeft(sam, 5_000)).toBe(42_000);
  });
});

describe('receiveNudgeOp', () => {
  it('hands on a nudge and a refusal, and drops anything malformed', () => {
    const heard = vi.fn();
    const stop = onNudge(heard);
    receiveNudgeOp('s7', { kind: 'nudge', targetId: 'me' });
    receiveNudgeOp('s1', { kind: 'nudge-refused', targetId: 's1', retryInMs: 30_000 });
    receiveNudgeOp('s1', { kind: 'nudge', targetId: '' });
    receiveNudgeOp('s1', { kind: 'nudge-refused', targetId: 's1' });
    expect(heard.mock.calls).toEqual([
      [{ kind: 'nudged', from: 's7' }],
      [{ kind: 'refused', op: { kind: 'nudge-refused', targetId: 's1', retryInMs: 30_000 } }],
    ]);
    stop();
    receiveNudgeOp('s7', { kind: 'nudge', targetId: 'me' });
    expect(heard).toHaveBeenCalledTimes(2);
  });
});
