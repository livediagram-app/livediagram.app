// @vitest-environment jsdom

// The first-run tour offer (docs/specs/007-editor/user-preferences.md): a /new handoff offers the tour
// once the editor is ready; a user who has already seen it gets no offer and the stale handoff is
// cleared, and it stays resolved even if the preference later flips back.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasTourPending, markTourPending, requestTourRelaunch } from '@/lib/tour-pending';
import { setActiveTour } from '@/lib/tour-active';
import { TourHost } from './TourHost';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('./TourPopover', () => ({ TourPopover: () => null }));
vi.mock('./tour-dom', () => ({
  findTour: () => null,
  waitForSelector: async () => null,
  waitForTour: async () => null,
}));
const ctx = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/app/document/[id]/EditorContext', () => ({ useEditorContext: () => ctx.current }));

const editor = (over: Record<string, unknown> = {}) => {
  ctx.current = {
    hydrated: true,
    anyWelcomeOpen: false,
    isReadOnly: false,
    embedMode: false,
    esBoard: false,
    userPreferences: { tourSeen: false },
    closeContextMenu: vi.fn(),
    ...over,
  };
};
const offered = () => track.mock.calls.some((c) => c[0] === 'UI' && c[2] === 'TourOffer');

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  track.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setActiveTour('plan', false);
});

describe('TourHost offer', () => {
  it('offers the tour after a /new handoff once ready', () => {
    markTourPending();
    editor();
    render(<TourHost />);
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
  });

  it('waits until the editor is ready', () => {
    markTourPending();
    editor({ hydrated: false });
    const { rerender } = render(<TourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
    editor();
    rerender(<TourHost />);
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
  });

  it('makes no offer without a handoff', () => {
    editor();
    render(<TourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
  });

  it('clears a stale handoff for a user who has seen it, and stays resolved', () => {
    markTourPending();
    editor({ userPreferences: { tourSeen: true } });
    const { rerender } = render(<TourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
    expect(hasTourPending()).toBe(false);
    editor({ userPreferences: { tourSeen: false } });
    rerender(<TourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
  });
});

describe('TourHost alongside the Plan tour', () => {
  it('waits while the Plan tour is on screen, then offers', () => {
    // docs/specs/026-plan/plan-tour.md "Where it appears": one tour at a time.
    setActiveTour('plan', true);
    markTourPending();
    editor();
    render(<TourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
    act(() => setActiveTour('plan', false));
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
  });

  it('holds a Settings rerun until the Plan tour ends', () => {
    setActiveTour('plan', true);
    editor();
    render(<TourHost />);
    act(() => requestTourRelaunch());
    expect(offered()).toBe(false);
    act(() => setActiveTour('plan', false));
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
  });

  it('reruns from Settings at once when nothing else is on screen', () => {
    editor();
    render(<TourHost />);
    act(() => requestTourRelaunch());
    expect(offered()).toBe(true);
    expect(hasTourPending()).toBe(true);
  });
});
