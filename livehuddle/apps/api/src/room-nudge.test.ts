import { describe, expect, it } from 'vitest';
import { createNudgeLedger } from '@livehuddle/api-schema';
import { decideNudge, nudgeIdentity } from './room-nudge';

// docs/specs/012-collaboration/nudge.md "Nudging" (the room enforces it too); blueprint "Domain and naming".
const session = (id: string, key?: string, personTag?: string | null) => ({
  personTag: personTag ?? null,
  presence: { id, name: id, color: '#000', ...(key ? { key } : {}) },
});

describe('nudgeIdentity', () => {
  it('prefers the verified person tag, then the claimed key, then the presence id', () => {
    expect(nudgeIdentity(session('s1', 'k1', 'tag'))).toBe('p:tag');
    expect(nudgeIdentity(session('s1', 'k1'))).toBe('k:k1');
    expect(nudgeIdentity(session('s1'))).toBe('s:s1');
    expect(nudgeIdentity({ personTag: null, presence: null })).toBeNull();
  });
});

describe('decideNudge', () => {
  const op = { kind: 'nudge' as const, targetId: 't1' };
  it('delivers, then refuses the same pair inside the window with the time left', () => {
    const ledger = createNudgeLedger();
    const input = { op, sender: session('s1', 'a'), target: session('t1', 'b'), ledger };
    expect(decideNudge({ ...input, now: 0 })).toEqual({ kind: 'deliver' });
    expect(decideNudge({ ...input, now: 60_000 })).toEqual({ kind: 'refuse', retryInMs: 60_000 });
  });
  it('drops a nudge to yourself, your other tab, nobody, or from a session it cannot place', () => {
    const ledger = createNudgeLedger();
    expect(
      decideNudge({ op, sender: session('t1'), target: session('t1'), ledger, now: 0 }),
    ).toEqual({ kind: 'drop', reason: 'self' });
    expect(
      decideNudge({ op, sender: session('s1', 'a'), target: session('t1', 'a'), ledger, now: 0 }),
    ).toEqual({ kind: 'drop', reason: 'self' });
    expect(decideNudge({ op, sender: session('s1'), target: null, ledger, now: 0 })).toEqual({
      kind: 'drop',
      reason: 'absent',
    });
    expect(
      decideNudge({
        op,
        sender: { personTag: null, presence: null },
        target: session('t1'),
        ledger,
        now: 0,
      }),
    ).toEqual({ kind: 'drop', reason: 'unknown' });
    expect(ledger.size()).toBe(0);
  });
});
