// @vitest-environment jsdom

// The Facilitate tour's offer (docs/specs/012-collaboration/facilitate-tour.md "Where it appears"): on
// entering Facilitate, once, after the welcome tour and never with another tour, and rerun from Settings.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestFacilitateTourRelaunch } from '@/lib/facilitate-tour';
import { setActiveTour } from '@/lib/tour-active';
import { clearTourPending, markTourPending } from '@/lib/tour-pending';
import type { TourEngine } from './useTourEngine';
import type { FacilitateTourApi } from './facilitate-tour-steps';
import { FacilitateTourHost } from './FacilitateTourHost';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const stage = vi.hoisted(() => ({
  engine: null as TourEngine<FacilitateTourApi> | null,
  helpHref: '' as string | undefined,
}));
vi.mock('./TourStage', () => ({
  TourStage: ({
    engine,
    copy,
  }: {
    engine: TourEngine<FacilitateTourApi>;
    copy: { helpHref?: string };
  }) => {
    stage.engine = engine;
    stage.helpHref = copy.helpHref;
    return null;
  },
}));
const dom = vi.hoisted(() => ({ share: true }));
vi.mock('./tour-dom', () => ({
  findTour: (id: string) => (id === 'share' && dom.share ? ({} as HTMLElement) : null),
  clickTour: () => false,
  waitForSelector: async () => null,
  waitForTour: async () => null,
}));
const ctx = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/app/document/[id]/EditorContext', () => ({ useEditorContext: () => ctx.current }));

const setUserPreferences = vi.fn();
const writeUserPreferences = vi.fn();

const editor = (over: Record<string, unknown> = {}) => {
  ctx.current = {
    hydrated: true,
    anyWelcomeOpen: false,
    isReadOnly: false,
    embedMode: false,
    editorMode: { mode: 'facilitate' },
    activeTab: { id: 'tab1', locked: false },
    userPreferences: { tourSeen: true },
    setUserPreferences,
    writeUserPreferences,
    selfParticipant: { id: 'me' },
    ...over,
  };
};
const offered = () =>
  track.mock.calls.some((c) => c[1] === 'Opened' && c[2] === 'FacilitateTourOffer');

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  track.mockReset();
  stage.engine = null;
  dom.share = true;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  setActiveTour('welcome', false);
  setActiveTour('plan', false);
  setActiveTour('facilitate', false);
  clearTourPending();
});

describe('FacilitateTourHost offer', () => {
  it('offers itself after the settle delay when the person is in Facilitate', () => {
    editor();
    render(<FacilitateTourHost />);
    act(() => vi.advanceTimersByTime(799));
    expect(offered()).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(offered()).toBe(true);
    expect(stage.engine?.active).toBe(true);
    expect(stage.helpHref).toBe('/help/canvas/facilitate-mode/');
  });

  it('waits for the person to enter Facilitate', () => {
    editor({ editorMode: { mode: 'diagram' } });
    const { rerender } = render(<FacilitateTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
    editor();
    rerender(<FacilitateTourHost />);
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
  });

  it.each([
    ['seen', { userPreferences: { tourSeen: true, facilitateTourSeen: true } }],
    ['read-only', { isReadOnly: true }],
    ['locked', { activeTab: { id: 'tab1', locked: true } }],
    ['not hydrated', { hydrated: false }],
    ['embedded', { embedMode: true }],
    ['in Plan', { editorMode: { mode: 'plan' } }],
  ])('makes no offer when %s', (_why, over) => {
    editor(over);
    render(<FacilitateTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
  });

  // The ask: someone who has not done the welcome tour gets it first, and this one at its end.
  it('waits for the welcome tour, then is offered as it ends', () => {
    markTourPending();
    setActiveTour('welcome', true);
    editor();
    render(<FacilitateTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
    act(() => {
      clearTourPending();
      setActiveTour('welcome', false);
    });
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
  });

  it('waits until the welcome tour is answered, then follows it', () => {
    editor({ userPreferences: {} });
    const { rerender } = render(<FacilitateTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
    editor({ userPreferences: { tourSeen: true } });
    rerender(<FacilitateTourHost />);
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
  });

  it('waits while the welcome tour is still owed', () => {
    markTourPending();
    editor();
    render(<FacilitateTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
  });

  it('never runs beside the Plan tour', () => {
    setActiveTour('plan', true);
    editor();
    render(<FacilitateTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
  });

  it('reruns from Settings in Facilitate', () => {
    editor({ userPreferences: { tourSeen: true, facilitateTourSeen: true } });
    const { rerender } = render(<FacilitateTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
    editor();
    rerender(<FacilitateTourHost />);
    act(() => requestFacilitateTourRelaunch());
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
  });

  it('ignores a rerun outside Facilitate', () => {
    editor({ editorMode: { mode: 'diagram' } });
    render(<FacilitateTourHost />);
    act(() => requestFacilitateTourRelaunch());
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
  });
});

describe('FacilitateTourHost end', () => {
  const start = () => {
    editor();
    const r = render(<FacilitateTourHost />);
    act(() => vi.advanceTimersByTime(800));
    return r;
  };

  it('declining marks it seen and sends the decline', () => {
    start();
    act(() => stage.engine!.skip());
    expect(writeUserPreferences).toHaveBeenCalledWith(
      { tourSeen: true, facilitateTourSeen: true },
      'me',
    );
    expect(track).toHaveBeenCalledWith('UI', 'Closed', 'FacilitateTourOffer');
  });

  it('starting runs the steps and completing sends the completion', async () => {
    start();
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'FacilitateTour');
    // Every anchored step finds no target in this harness and is skipped, so Next runs to the end.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(stage.engine?.step?.id).toBe('outro');
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'FacilitateTourCompleted');
    expect(writeUserPreferences).toHaveBeenCalledWith(
      { tourSeen: true, facilitateTourSeen: true },
      'me',
    );
  });

  it('leaves the Share step out where there is no Share button', () => {
    dom.share = false;
    start();
    expect(stage.engine!.countableSteps).toBe(4);
  });

  it('keeps the Share step where there is one', () => {
    start();
    expect(stage.engine!.countableSteps).toBe(5);
  });

  it('ends as skipped when the person leaves Facilitate or the tab', () => {
    const r = start();
    act(() => stage.engine!.next());
    editor({ editorMode: { mode: 'diagram' } });
    r.rerender(<FacilitateTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'FacilitateTourSkipped');
    expect(stage.engine?.active).toBe(false);
  });
});
