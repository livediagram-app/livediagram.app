// @vitest-environment jsdom

// The Draw tour's way in (docs/specs/023-draw-mode/draw-tour.md "Where it appears"): the footer's Start Tour button
// offers it in Draw, taken or not; a press there (or the Settings row) starts it, never beside another tour, and it
// never starts on its own.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestDrawTourRelaunch } from '@/lib/draw-tour';
import { setActiveTour } from '@/lib/tour-active';
import { setStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import {
  resetTourOffersForTests,
  tourOffer,
} from '@liveworkspace/workbench/components/tour/tour-offer';
import type { TourEngine } from '@liveworkspace/workbench/components/tour/useTourEngine';
import type { DrawTourApi } from './draw-tour-steps';
import { DrawTourHost } from './DrawTourHost';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const stage = vi.hoisted(() => ({
  engine: null as TourEngine<DrawTourApi> | null,
  helpHref: '' as string | undefined,
}));
vi.mock('./TourStage', () => ({
  TourStage: ({
    engine,
    copy,
  }: {
    engine: TourEngine<DrawTourApi>;
    copy: { helpHref?: string };
  }) => {
    stage.engine = engine;
    stage.helpHref = copy.helpHref;
    return null;
  },
}));
vi.mock('@liveworkspace/workbench/components/tour/tour-dom', () => ({
  findTour: () => null,
  clickTour: () => false,
  waitForSelector: async () => null,
  waitForTour: async () => null,
}));
const ctx = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/app/document/[id]/EditorContext', () => ({
  useEditorContext: () => ctx.current,
  useOptionalEditorContext: () => ctx.current,
}));

const setUserPreferences = vi.fn();
const writeUserPreferences = vi.fn();

const editor = (over: Record<string, unknown> = {}) => {
  ctx.current = {
    hydrated: true,
    anyWelcomeOpen: false,
    isReadOnly: false,
    embedMode: false,
    editorMode: { mode: 'draw' },
    activeTab: { id: 'tab1', locked: false },
    userPreferences: { tourSeen: true },
    setUserPreferences,
    writeUserPreferences,
    selfParticipant: { id: 'me' },
    prefsSettled: true,
    ...over,
  };
};
const startedTour = () => track.mock.calls.some((c) => c[1] === 'Started' && c[2] === 'DrawTour');

beforeEach(() => {
  vi.useFakeTimers();
  track.mockReset();
  stage.engine = null;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  setActiveTour('welcome', false);
  setActiveTour('workshop', false);
  setActiveTour('draw', false);
  setStartPanelOpen(false);
  resetTourOffersForTests();
});

describe('DrawTourHost offer', () => {
  it('offers "Draw" on the footer button in Draw, and never starts on its own', () => {
    editor();
    render(<DrawTourHost />);
    expect(tourOffer()?.name).toBe('Draw');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(startedTour()).toBe(false);
    expect(stage.engine?.active).toBe(false);
  });

  it('starts from the button, linking to its article', () => {
    editor();
    render(<DrawTourHost />);
    act(() => tourOffer()!.start());
    expect(startedTour()).toBe(true);
    expect(stage.engine?.active).toBe(true);
    expect(stage.helpHref).toBe('/help/canvas/draw-mode/');
  });

  it('stays on offer once seen, so it can be taken again', () => {
    editor({ userPreferences: { tourSeen: true, drawTourSeen: true } });
    render(<DrawTourHost />);
    expect(tourOffer()?.name).toBe('Draw');
  });

  it.each([
    ['read-only', { isReadOnly: true }],
    ['locked', { activeTab: { id: 'tab1', locked: true } }],
    ['not hydrated', { hydrated: false }],
    ['embedded', { embedMode: true }],
    ['in Diagram', { editorMode: { mode: 'diagram' } }],
    ['in Workshop', { editorMode: { mode: 'workshop' } }],
  ])('offers nothing when %s', (_why, over) => {
    editor(over);
    render(<DrawTourHost />);
    expect(tourOffer()).toBeNull();
  });

  // docs/specs/007-editor/start-diagramming.md "The tours wait".
  it('offers nothing while a start panel is on screen', () => {
    act(() => setStartPanelOpen(true));
    editor();
    render(<DrawTourHost />);
    expect(tourOffer()).toBeNull();
    act(() => setStartPanelOpen(false));
    expect(tourOffer()?.name).toBe('Draw');
  });

  it('never starts beside another tour', () => {
    setActiveTour('workshop', true);
    editor();
    render(<DrawTourHost />);
    act(() => tourOffer()!.start());
    expect(startedTour()).toBe(false);
  });

  it('reruns from Settings in Draw', () => {
    editor({ userPreferences: { tourSeen: true, drawTourSeen: true } });
    render(<DrawTourHost />);
    act(() => requestDrawTourRelaunch());
    expect(startedTour()).toBe(true);
  });

  it('ignores a rerun outside Draw', () => {
    editor({ editorMode: { mode: 'diagram' } });
    render(<DrawTourHost />);
    act(() => requestDrawTourRelaunch());
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(startedTour()).toBe(false);
  });
});

describe('DrawTourHost end', () => {
  const start = () => {
    editor();
    const r = render(<DrawTourHost />);
    act(() => tourOffer()!.start());
    return r;
  };

  it('skipping marks it seen and sends the skip', () => {
    start();
    act(() => stage.engine!.skip());
    expect(writeUserPreferences).toHaveBeenCalledWith({ tourSeen: true, drawTourSeen: true }, 'me');
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'DrawTourSkipped');
  });

  it('runs the steps and completing sends the completion', async () => {
    start();
    // Every anchored step finds no target in this harness and is skipped, so it runs to the end.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(stage.engine?.step?.id).toBe('outro');
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'DrawTourCompleted');
    expect(writeUserPreferences).toHaveBeenCalledWith({ tourSeen: true, drawTourSeen: true }, 'me');
  });

  it("counts the dock's three groups and Quick Style as its steps", () => {
    start();
    expect(stage.engine!.countableSteps).toBe(4);
  });

  it('ends as skipped when the person leaves Draw or the tab', () => {
    const r = start();
    editor({ editorMode: { mode: 'diagram' } });
    r.rerender(<DrawTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'DrawTourSkipped');
    expect(stage.engine?.active).toBe(false);
  });
});
