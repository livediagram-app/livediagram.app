// @vitest-environment jsdom
// The Dashboards tour's offer (docs/specs/026-plan/plan-tour.md "The Dashboards tour"): once, the first time an Editor
// has a dashboard open in Plan, while its track is owed and nothing else is on screen; answered however it ends.
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveTour } from '@/lib/tour-active';
import { useDashboardTour, useDashboardTourOffer } from './DashboardTour';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const ctx = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('@/app/project/[id]/EditorContext', () => ({
  useOptionalEditorContext: () => ctx.current,
}));
const modal = vi.hoisted(() => ({ open: false }));
vi.mock('@liveworkspace/workbench/lib/modal-guard', async (actual) => ({
  ...(await actual<typeof import('@liveworkspace/workbench/lib/modal-guard')>()),
  useAnyModalOpen: () => modal.open,
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

const offered = () =>
  track.mock.calls.some((c) => c[1] === 'Opened' && c[2] === 'DashboardTourOffer');
const wait = (ms = 1000) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

beforeEach(() => {
  vi.useFakeTimers();
  editor();
  modal.open = false;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  track.mockClear();
  setUserPreferences.mockClear();
  writeUserPreferences.mockClear();
});

describe('useDashboardTourOffer', () => {
  it('offers the tour on its welcome card once the dashboard has been on screen a moment', async () => {
    const { result } = renderHook(() => useOffered(true));
    expect(offered()).toBe(false);
    await wait();
    expect(offered()).toBe(true);
    expect(result.current.active).toBe(true);
    expect(result.current.step?.id).toBe('welcome');
  });

  it('answers the track when turned down, sending Closed rather than Ended', async () => {
    const { result } = renderHook(() => useOffered(true));
    await wait();
    act(() => result.current.skip());
    expect(track).toHaveBeenCalledWith('UI', 'Closed', 'DashboardTourOffer');
    expect(track).not.toHaveBeenCalledWith('UI', 'Ended', 'DashboardTourSkipped');
    const written = writeUserPreferences.mock.calls[0]![0] as { planTourTracks?: string[] };
    expect(written.planTourTracks).toContain('dashboards');
  });

  it.each([
    ['a Viewer or a covered dashboard', false, {}],
    ['a read-only project', true, { isReadOnly: true }],
    ['an embed', true, { embedMode: true }],
    ['before the synced preferences are in', true, { prefsSettled: false }],
    ['once answered', true, { userPreferences: { planTourTracks: ['dashboards'] } }],
  ])('waits with %s', async (_, canWork, over) => {
    editor(over);
    renderHook(() => useOffered(canWork));
    await wait();
    expect(offered()).toBe(false);
  });

  it('waits while another tour or a dialog is up', async () => {
    modal.open = true;
    renderHook(() => useOffered(true));
    await wait();
    expect(offered()).toBe(false);
    modal.open = false;
    act(() => setActiveTour('plan', true));
    renderHook(() => useOffered(true));
    await wait();
    expect(offered()).toBe(false);
    act(() => setActiveTour('plan', false));
  });

  it('never offers outside an editor', async () => {
    ctx.current = null;
    renderHook(() => useOffered(true));
    await wait();
    expect(offered()).toBe(false);
  });
});
