import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_OFFER_COUNTERS,
  OFFER_COUNTERS_KEY,
  POWER_USER_OFFER_DAYS,
  POWER_USER_OFFER_SHORTCUTS,
  localDayKey,
  offerDue,
  offerEligible,
  parseOfferCounters,
  recordEditingSession,
  recordShortcut,
} from './power-user-offer';

// The once-ever power user mode offer (docs/specs/007-editor/power-user-mode.md): due after 20
// editing sessions on separate days, or 50 keyboard shortcuts.

const ELIGIBLE_CTX = { editable: true, embed: false, zen: false };

describe('thresholds', () => {
  it('are the operator-chosen 20 days and 50 shortcuts', () => {
    expect(POWER_USER_OFFER_DAYS).toBe(20);
    expect(POWER_USER_OFFER_SHORTCUTS).toBe(50);
    expect(OFFER_COUNTERS_KEY).toBe('livediagram:power-user-offer:v1');
  });
});

describe('localDayKey', () => {
  it('names the local calendar day', () => {
    expect(localDayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDayKey(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31');
  });
});

describe('recordEditingSession', () => {
  it('counts a day once, however many sessions it holds', () => {
    let c = recordEditingSession(EMPTY_OFFER_COUNTERS, '2026-01-01');
    c = recordEditingSession(c, '2026-01-01');
    expect(c).toEqual({ days: 1, lastDay: '2026-01-01', shortcuts: 0 });
    c = recordEditingSession(c, '2026-01-02');
    expect(c.days).toBe(2);
  });

  it('returns the same object when nothing changed', () => {
    const c = recordEditingSession(EMPTY_OFFER_COUNTERS, '2026-01-01');
    expect(recordEditingSession(c, '2026-01-01')).toBe(c);
  });
});

describe('offerDue', () => {
  it('is due on the 20th separate day, not before', () => {
    let c = EMPTY_OFFER_COUNTERS;
    for (let d = 1; d < POWER_USER_OFFER_DAYS; d += 1) {
      c = recordEditingSession(c, `2026-02-${String(d).padStart(2, '0')}`);
    }
    expect(offerDue(c)).toBe(false);
    c = recordEditingSession(c, '2026-03-01');
    expect(offerDue(c)).toBe(true);
  });

  it('is due on the 50th shortcut, whichever comes first', () => {
    let c = EMPTY_OFFER_COUNTERS;
    for (let i = 1; i < POWER_USER_OFFER_SHORTCUTS; i += 1) c = recordShortcut(c);
    expect(offerDue(c)).toBe(false);
    expect(offerDue(recordShortcut(c))).toBe(true);
  });
});

describe('offerEligible', () => {
  it('offers to an editing session with nothing in the way', () => {
    expect(offerEligible({}, ELIGIBLE_CTX)).toBe(true);
  });

  it('never offers twice, nor to someone already in the mode', () => {
    expect(offerEligible({ powerUserOfferShown: true }, ELIGIBLE_CTX)).toBe(false);
    expect(offerEligible({ powerUserMode: true }, ELIGIBLE_CTX)).toBe(false);
  });

  it('respects a quieter editor', () => {
    expect(offerEligible({ notificationsEnabled: false }, ELIGIBLE_CTX)).toBe(false);
  });

  it('stays away from view-only, embedded and Zen sessions', () => {
    expect(offerEligible({}, { ...ELIGIBLE_CTX, editable: false })).toBe(false);
    expect(offerEligible({}, { ...ELIGIBLE_CTX, embed: true })).toBe(false);
    expect(offerEligible({}, { ...ELIGIBLE_CTX, zen: true })).toBe(false);
  });
});

describe('parseOfferCounters', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads what was written', () => {
    const c = { days: 3, lastDay: '2026-01-03', shortcuts: 12 };
    expect(parseOfferCounters(JSON.stringify(c))).toEqual(c);
  });

  it('starts from zero with nothing stored', () => {
    expect(parseOfferCounters(null)).toEqual(EMPTY_OFFER_COUNTERS);
  });

  it('resets malformed counters with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseOfferCounters('{nope')).toEqual(EMPTY_OFFER_COUNTERS);
    expect(parseOfferCounters('{"days":"3","lastDay":null,"shortcuts":1}')).toEqual(
      EMPTY_OFFER_COUNTERS,
    );
    expect(parseOfferCounters('[]')).toEqual(EMPTY_OFFER_COUNTERS);
    expect(warn).toHaveBeenCalledTimes(3);
    expect(warn.mock.calls[0]?.[0]).toBe('[power-user-offer] counters reset');
  });
});
