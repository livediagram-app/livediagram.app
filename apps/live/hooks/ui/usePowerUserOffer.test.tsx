// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { usePowerUserOffer, type PowerUserOfferDeps } from './usePowerUserOffer';
import {
  OFFER_COUNTERS_KEY,
  POWER_USER_OFFER_SHORTCUTS,
  localDayKey,
} from '@/lib/power-user-offer';
import type { ToastOffer } from './useToast';
import type { UserPreferences } from '@/lib/user-preferences';

// The offer wiring (docs/specs/007-editor/power-user-mode.md): record, evaluate, show once, and
// apply the answer.

const track = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...a: unknown[]) => track(...a) }));

function setup(overrides: Partial<PowerUserOfferDeps> = {}) {
  let prefs: UserPreferences = {};
  const offers: ToastOffer[] = [];
  const deps: PowerUserOfferDeps = {
    prefs,
    settled: true,
    editable: true,
    embed: false,
    zen: false,
    apply: vi.fn((next: UserPreferences) => {
      prefs = next;
    }),
    offer: (o) => offers.push(o),
    ...overrides,
  };
  const hook = renderHook((d: PowerUserOfferDeps) => usePowerUserOffer(d), { initialProps: deps });
  return { hook, deps, offers, prefs: () => prefs };
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  track.mockReset();
  vi.restoreAllMocks();
});

describe('usePowerUserOffer', () => {
  it('records today as an editing session, once', () => {
    const { hook, deps } = setup();
    hook.rerender({ ...deps });
    const stored = JSON.parse(localStorage.getItem(OFFER_COUNTERS_KEY)!);
    expect(stored).toMatchObject({ days: 1, lastDay: localDayKey(new Date()) });
  });

  it('waits for the preferences to settle before recording or offering', () => {
    localStorage.setItem(
      OFFER_COUNTERS_KEY,
      JSON.stringify({ days: 0, lastDay: null, shortcuts: POWER_USER_OFFER_SHORTCUTS }),
    );
    const { offers } = setup({ settled: false });
    expect(offers).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem(OFFER_COUNTERS_KEY)!).days).toBe(0);
  });

  it('offers on the 50th shortcut, marks it shown, and never offers again', () => {
    localStorage.setItem(
      OFFER_COUNTERS_KEY,
      JSON.stringify({ days: 1, lastDay: localDayKey(new Date()), shortcuts: 48 }),
    );
    const { hook, offers, deps, prefs } = setup();
    hook.result.current.onShortcutUsed();
    expect(offers).toHaveLength(0);
    hook.result.current.onShortcutUsed();
    expect(offers).toHaveLength(1);
    expect(prefs().powerUserOfferShown).toBe(true);
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'PowerUserOffer');
    hook.rerender({ ...deps, prefs: prefs() });
    hook.result.current.onShortcutUsed();
    expect(offers).toHaveLength(1);
  });

  it('switches the mode on when accepted', () => {
    localStorage.setItem(
      OFFER_COUNTERS_KEY,
      JSON.stringify({ days: 0, lastDay: null, shortcuts: POWER_USER_OFFER_SHORTCUTS }),
    );
    const { offers, prefs } = setup();
    offers[0]!.onConfirm();
    expect(prefs().powerUserMode).toBe(true);
    expect(prefs().minimalChrome).toBe(true);
    expect(prefs().powerUserOfferShown).toBe(true);
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'PowerUserOffer');
    expect(track).toHaveBeenCalledWith('UI', 'Toggled', 'PowerUserModeOn');
  });

  it('changes nothing else when declined', () => {
    localStorage.setItem(
      OFFER_COUNTERS_KEY,
      JSON.stringify({ days: 0, lastDay: null, shortcuts: POWER_USER_OFFER_SHORTCUTS }),
    );
    const { offers, prefs } = setup();
    offers[0]!.onDecline();
    expect(prefs()).toEqual({ powerUserOfferShown: true });
    expect(track).toHaveBeenCalledWith('UI', 'Declined', 'PowerUserOffer');
  });

  it('does not offer to a session that cannot edit', () => {
    localStorage.setItem(
      OFFER_COUNTERS_KEY,
      JSON.stringify({ days: 0, lastDay: null, shortcuts: POWER_USER_OFFER_SHORTCUTS }),
    );
    const { offers } = setup({ editable: false });
    expect(offers).toHaveLength(0);
  });
});
