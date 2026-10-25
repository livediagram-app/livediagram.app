// @vitest-environment jsdom
// The Dashboards tour's way in (docs/specs/026-plan/plan-tour.md "The Dashboards tour"): the footer's Start Tour button,
// while an Editor has a dashboard open in Plan, taken or not; a press starts it, never beside another tour, and its
// track is taken however it ends. It never starts on its own.
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveTour } from '@/lib/tour-active';
import {
  resetTourOffersForTests,
  tourOffer,
} from '@liveworkspace/workbench/components/tour/tour-offer';
import { useDashboardTour, useDashboardTourOffer } from './DashboardTour';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const ctx = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('@/app/project/[id]/EditorContext', () => ({
  useOptionalEditorContext: () => ctx.current,
}));

const setUserPreferences = vi.fn();
const writeUserPreferences = vi.fn();

const editor = (over: Record<string, unknown> = {}) => {
  ctx.current = {
    userPreferences: {},
    prefsSettled: true,
    isReadOnly: false,
    embedMode: false,
    setUserPreferences,
    writeUserPreferences,
    selfParticipant: { id: 'me' },
    ...over,
  };
};

const slots = () => ({ hasEmpty: true, hasFilled: false });

function useOffered(canWork: boolean) {
  const { tour, freeze } = useDashboardTour(false);
  useDashboardTourOffer({ tour, freeze, canWork, slots });
  return tour;
}

const wait = (ms = 1000) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

beforeEach(() => {
  vi.useFakeTimers();
  editor();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  track.mockClear();
  setUserPreferences.mockClear();
  writeUserPreferences.mockClear();
  setActiveTour('plan', false);
  resetTourOffersForTests();
});

describe('useDashboardTourOffer', () => {
  it('offers "Dashboards" on the footer button, and never starts on its own', async () => {
    const { result } = renderHook(() => useOffered(true));
    expect(tourOffer()?.name).toBe('Dashboards');
    await wait(5000);
    expect(result.current.active).toBe(false);
  });

  it('starts on its first step from the button', () => {
    const { result } = renderHook(() => useOffered(true));
    act(() => tourOffer()!.start());
    expect(result.current.active).toBe(true);
    expect(result.current.step?.id).toBe('rows');
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'DashboardTour');
  });

  it('takes the track however it ends', () => {
    const { result } = renderHook(() => useOffered(true));
    act(() => tourOffer()!.start());
    act(() => result.current.skip());
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'DashboardTourSkipped');
    const written = writeUserPreferences.mock.calls[0]![0] as { planTourTracks?: string[] };
    expect(written.planTourTracks).toContain('dashboards');
  });

  it('stays on offer once taken, so it can be taken again', () => {
    editor({ userPreferences: { planTourTracks: ['dashboards'] } });
    renderHook(() => useOffered(true));
    expect(tourOffer()?.name).toBe('Dashboards');
  });

  it.each([
    ['a Viewer or a covered dashboard', false, {}],
    ['a read-only project', true, { isReadOnly: true }],
    ['an embed', true, { embedMode: true }],
  ])('offers nothing with %s', (_, canWork, over) => {
    editor(over);
    renderHook(() => useOffered(canWork));
    expect(tourOffer()).toBeNull();
  });

  it('starts nothing while another tour is up', () => {
    act(() => setActiveTour('plan', true));
    const { result } = renderHook(() => useOffered(true));
    act(() => tourOffer()!.start());
    expect(result.current.active).toBe(false);
  });

  it('never offers outside an editor', () => {
    ctx.current = null;
    renderHook(() => useOffered(true));
    expect(tourOffer()).toBeNull();
  });
});
