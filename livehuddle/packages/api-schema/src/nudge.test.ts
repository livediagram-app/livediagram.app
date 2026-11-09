import { describe, expect, it } from 'vitest';
import {
  createNudgeLedger,
  NUDGE_COOLDOWN_MS,
  nudgeCountdown,
  parseNudge,
  parseNudgeRefused,
} from './nudge';
import { isPresenceOpKind, isSystemOpKind } from './room-messages';

// docs/specs/012-collaboration/nudge.md "The wire".
describe('parseNudge', () => {
  it('keeps a well-formed nudge and nothing else', () => {
    expect(parseNudge({ kind: 'nudge', targetId: 's1', extra: 1 })).toEqual({
      kind: 'nudge',
      targetId: 's1',
    });
  });
  it('refuses a wrong kind, a missing, empty or oversized target', () => {
    expect(parseNudge(null)).toBeNull();
    expect(parseNudge({ kind: 'avatar-bell', targetId: 's1' })).toBeNull();
    expect(parseNudge({ kind: 'nudge' })).toBeNull();
    expect(parseNudge({ kind: 'nudge', targetId: '' })).toBeNull();
    expect(parseNudge({ kind: 'nudge', targetId: 'x'.repeat(65) })).toBeNull();
    expect(parseNudge({ kind: 'nudge', targetId: 4 })).toBeNull();
  });
});

describe('parseNudgeRefused', () => {
  it('keeps a refusal, clamping the time left to the window', () => {
    expect(parseNudgeRefused({ kind: 'nudge-refused', targetId: 's1', retryInMs: 5 })).toEqual({
      kind: 'nudge-refused',
      targetId: 's1',
      retryInMs: 5,
    });
    expect(
      parseNudgeRefused({ kind: 'nudge-refused', targetId: 's1', retryInMs: 1e9 })?.retryInMs,
    ).toBe(NUDGE_COOLDOWN_MS);
  });
  it('refuses anything malformed', () => {
    expect(parseNudgeRefused(null)).toBeNull();
    expect(parseNudgeRefused({ kind: 'nudge', targetId: 's1', retryInMs: 1 })).toBeNull();
    expect(parseNudgeRefused({ kind: 'nudge-refused', targetId: '', retryInMs: 1 })).toBeNull();
    expect(parseNudgeRefused({ kind: 'nudge-refused', targetId: 's', retryInMs: -1 })).toBeNull();
    expect(parseNudgeRefused({ kind: 'nudge-refused', targetId: 's', retryInMs: NaN })).toBeNull();
    expect(parseNudgeRefused({ kind: 'nudge-refused', targetId: 's' })).toBeNull();
  });
});

describe('the vocabulary', () => {
  it('a nudge is presence; its refusal is the room alone', () => {
    expect(isPresenceOpKind('nudge')).toBe(true);
    expect(isSystemOpKind('nudge-refused')).toBe(true);
  });
});

describe('createNudgeLedger', () => {
  it('lets one nudge a pair through per window and says how long is left', () => {
    const ledger = createNudgeLedger();
    expect(ledger.check('a', 'b', 0)).toEqual({ ok: true });
    expect(ledger.check('a', 'b', 30_000)).toEqual({ ok: false, retryInMs: 90_000 });
    expect(ledger.check('a', 'c', 30_000)).toEqual({ ok: true });
    expect(ledger.check('b', 'a', 30_000)).toEqual({ ok: true });
    expect(ledger.remaining('a', 'b', 30_000)).toBe(90_000);
    expect(ledger.remaining('z', 'b', 30_000)).toBe(0);
    expect(ledger.check('a', 'b', NUDGE_COOLDOWN_MS)).toEqual({ ok: true });
  });
  it('holds a window the room reported', () => {
    const ledger = createNudgeLedger();
    ledger.hold('a', 'b', 1_000, 42_000);
    expect(ledger.remaining('a', 'b', 1_000)).toBe(42_000);
    ledger.hold('a', 'c', 1_000, 1e9);
    expect(ledger.remaining('a', 'c', 1_000)).toBe(NUDGE_COOLDOWN_MS);
  });
  it('prunes pairs whose window is over once it grows', () => {
    const ledger = createNudgeLedger(1000);
    for (let i = 0; i < 300; i++) ledger.check(`s${i}`, 't', 0);
    expect(ledger.size()).toBe(300);
    ledger.check('late', 't', 5_000);
    expect(ledger.size()).toBe(1);
  });
});

describe('nudgeCountdown', () => {
  it('reads m:ss, rounded up to the second', () => {
    expect(nudgeCountdown(102_000)).toBe('1:42');
    expect(nudgeCountdown(4_100)).toBe('0:05');
    expect(nudgeCountdown(120_000)).toBe('2:00');
    expect(nudgeCountdown(-5)).toBe('0:00');
  });
});
