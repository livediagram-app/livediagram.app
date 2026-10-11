// @vitest-environment jsdom

// The Illustrate tour's offer (docs/specs/007-editor/illustrate-tour.md "Where it appears"): on
// entering Illustrate, once, on its own (the Diagram tour never runs in Illustrate), never with another tour,
// and rerun from Settings.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestIllustrateTourRelaunch } from '@/lib/illustrate-tour';
import { setActiveTour } from '@/lib/tour-active';
import { setStartPanelOpen } from '@/components/start/start-panel-open';
import { clearTourPending, markTourPending } from '@/lib/tour-pending';
import type { TourEngine } from './useTourEngine';
import type { IllustrateTourApi } from './illustrate-tour-steps';
import { IllustrateTourHost } from './IllustrateTourHost';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const stage = vi.hoisted(() => ({
  engine: null as TourEngine<IllustrateTourApi> | null,
  helpHref: '' as string | undefined,
}));
vi.mock('./TourStage', () => ({
  TourStage: ({
    engine,
    copy,
  }: {
    engine: TourEngine<IllustrateTourApi>;
    copy: { helpHref?: string };
  }) => {
    stage.engine = engine;
    stage.helpHref = copy.helpHref;
    return null;
  },
}));
const dom = vi.hoisted(() => ({ shown: new Set(['page-name', 'page-cog', 'add-page', 'slides']) }));
vi.mock('./tour-dom', () => ({
  findTour: (id: string) => (dom.shown.has(id) ? ({} as HTMLElement) : null),
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
    editorMode: { mode: 'illustrate' },
    activeTab: { id: 'tab1', locked: false },
    userPreferences: { tourSeen: true },
    setUserPreferences,
    writeUserPreferences,
    selfParticipant: { id: 'me' },
    prefsSettled: true,
    ...over,
  };
};
const offered = () =>
  track.mock.calls.some((c) => c[1] === 'Opened' && c[2] === 'IllustrateTourOffer');

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  track.mockReset();
  dom.shown = new Set(['page-name', 'page-cog', 'add-page', 'slides']);
  stage.engine = null;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  setActiveTour('welcome', false);
  setActiveTour('plan', false);
  setActiveTour('facilitate', false);
  setActiveTour('draw', false);
  setActiveTour('illustrate', false);
  setStartPanelOpen(false);
  clearTourPending();
});

describe('IllustrateTourHost offer', () => {
  it('offers itself after the settle delay when the person is in Illustrate', () => {
    editor();
    render(<IllustrateTourHost />);
    act(() => vi.advanceTimersByTime(799));
    expect(offered()).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(offered()).toBe(true);
    expect(stage.engine?.active).toBe(true);
    expect(stage.helpHref).toBe('/help/canvas/illustrate/');
  });

  it('waits for the person to enter Illustrate', () => {
    editor({ editorMode: { mode: 'diagram' } });
    const { rerender } = render(<IllustrateTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
    editor();
    rerender(<IllustrateTourHost />);
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
  });

  it.each([
    ['seen', { userPreferences: { tourSeen: true, illustrateTourSeen: true } }],
    ['read-only', { isReadOnly: true }],
    ['locked', { activeTab: { id: 'tab1', locked: true } }],
    ['not hydrated', { hydrated: false }],
    ['embedded', { embedMode: true }],
    ['in Draw', { editorMode: { mode: 'draw' } }],
    ['before the synced preferences are in', { prefsSettled: false }],
  ])('makes no offer when %s', (_why, over) => {
    editor(over);
    render(<IllustrateTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
  });

  // docs/specs/007-editor/illustrate-tour.md "Where it appears": on its own, whatever other tours.
  it('offers itself to someone who has not done the Diagram tour, even with its handoff owed', () => {
    markTourPending();
    editor({ userPreferences: {} });
    render(<IllustrateTourHost />);
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
    expect(stage.engine?.hasWelcome).toBe(true);
  });

  it('waits while the Diagram tour is on screen, then follows it', () => {
    setActiveTour('welcome', true);
    editor();
    render(<IllustrateTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
    act(() => setActiveTour('welcome', false));
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
  });

  it('never runs beside the Draw tour', () => {
    setActiveTour('draw', true);
    editor();
    render(<IllustrateTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
  });

  it('reruns from Settings in Illustrate', () => {
    editor({ userPreferences: { tourSeen: true, illustrateTourSeen: true } });
    const { rerender } = render(<IllustrateTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
    editor();
    rerender(<IllustrateTourHost />);
    act(() => requestIllustrateTourRelaunch());
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
  });

  it('ignores a rerun outside Illustrate', () => {
    editor({ editorMode: { mode: 'diagram' } });
    render(<IllustrateTourHost />);
    act(() => requestIllustrateTourRelaunch());
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
  });
});

describe('IllustrateTourHost end', () => {
  const start = () => {
    editor();
    const r = render(<IllustrateTourHost />);
    act(() => vi.advanceTimersByTime(800));
    return r;
  };

  it('declining marks it seen and sends the decline', () => {
    start();
    act(() => stage.engine!.skip());
    expect(writeUserPreferences).toHaveBeenCalledWith(
      { tourSeen: true, illustrateTourSeen: true },
      'me',
    );
    expect(track).toHaveBeenCalledWith('UI', 'Closed', 'IllustrateTourOffer');
  });

  it('starting runs the steps and completing sends the completion', async () => {
    start();
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'IllustrateTour');
    // Every anchored step finds no target in this harness and is skipped, so Next runs to the end.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(stage.engine?.step?.id).toBe('outro');
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'IllustrateTourCompleted');
    expect(writeUserPreferences).toHaveBeenCalledWith(
      { tourSeen: true, illustrateTourSeen: true },
      'me',
    );
  });

  it('counts the page chrome on screen as its steps', () => {
    start();
    expect(stage.engine!.countableSteps).toBe(4);
  });

  it('leaves out a step whose anchor is not on screen', () => {
    dom.shown.delete('slides');
    start();
    expect(stage.engine!.countableSteps).toBe(3);
  });

  // docs/specs/007-editor/start-diagramming.md "The tours wait".
  it('waits while a start panel is on screen', () => {
    act(() => setStartPanelOpen(true));
    editor();
    render(<IllustrateTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
    act(() => setStartPanelOpen(false));
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
  });

  it('ends as skipped when the person leaves Illustrate or the tab', () => {
    const r = start();
    act(() => stage.engine!.next());
    editor({ editorMode: { mode: 'diagram' } });
    r.rerender(<IllustrateTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'IllustrateTourSkipped');
    expect(stage.engine?.active).toBe(false);
  });
});
