import { describe, expect, it } from 'vitest';
import {
  createKnockThrottle,
  KNOCK_THROTTLE_MS,
  parseAvatarKnock,
  parseAvatarKnockAnswer,
} from './knock';

describe('parseAvatarKnock', () => {
  it('keeps a well-formed knock and nothing else', () => {
    expect(parseAvatarKnock({ kind: 'avatar-knock', tabId: 't', roomId: 'r', extra: 1 })).toEqual({
      kind: 'avatar-knock',
      tabId: 't',
      roomId: 'r',
    });
  });
  it('refuses a wrong kind, missing or oversized fields', () => {
    expect(parseAvatarKnock(null)).toBeNull();
    expect(parseAvatarKnock({ kind: 'avatar-push', tabId: 't', roomId: 'r' })).toBeNull();
    expect(parseAvatarKnock({ kind: 'avatar-knock', tabId: 't' })).toBeNull();
    expect(
      parseAvatarKnock({ kind: 'avatar-knock', tabId: 't', roomId: 'x'.repeat(65) }),
    ).toBeNull();
    expect(parseAvatarKnock({ kind: 'avatar-knock', tabId: '', roomId: 'r' })).toBeNull();
  });
});

describe('parseAvatarKnockAnswer', () => {
  const ok = { kind: 'avatar-knock-answer', tabId: 't', targetId: 'p1', roomId: 'r', answer: 'in' };
  it('keeps both answers', () => {
    expect(parseAvatarKnockAnswer(ok)).toEqual(ok);
    expect(parseAvatarKnockAnswer({ ...ok, answer: 'later' })?.answer).toBe('later');
  });
  it('refuses another answer or no target', () => {
    expect(parseAvatarKnockAnswer({ ...ok, answer: 'yes' })).toBeNull();
    expect(parseAvatarKnockAnswer({ ...ok, targetId: undefined })).toBeNull();
    expect(parseAvatarKnockAnswer({ ...ok, kind: 'avatar-knock' })).toBeNull();
    expect(parseAvatarKnockAnswer(undefined)).toBeNull();
  });
});

describe('createKnockThrottle', () => {
  it('lets one knock per sender through each window', () => {
    const t = createKnockThrottle();
    expect(t.allow('a', 0)).toBe(true);
    expect(t.allow('a', KNOCK_THROTTLE_MS - 1)).toBe(false);
    expect(t.allow('b', 1)).toBe(true);
    expect(t.allow('a', KNOCK_THROTTLE_MS)).toBe(true);
  });
  it('forgets a sender, and prunes stale senders past its bound', () => {
    const t = createKnockThrottle(10);
    t.allow('a', 0);
    t.forget('a');
    expect(t.allow('a', 1)).toBe(true);
    for (let i = 0; i < 300; i++) t.allow(`s${i}`, 100 + i * 20);
    expect(t.allow('s0', 100 + 300 * 20)).toBe(true);
  });
});
