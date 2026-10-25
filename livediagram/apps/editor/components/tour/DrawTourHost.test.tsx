// @vitest-environment jsdom

// The Draw tour's offer (docs/specs/023-draw-mode/draw-tour.md "Where it appears"): on
// entering Draw, once, on its own (the Diagram tour never runs in Draw), never with another tour,
// and rerun from Settings.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestDrawTourRelaunch } from '@/lib/draw-tour';
import { setActiveTour } from '@/lib/tour-active';
import { anyModalOpen, modalClosed, modalOpened } from '@liveworkspace/workbench/lib/modal-guard';
import { setStartPanelOpen } from '@/components/start/start-panel-open';
import { clearTourPending, markTourPending } from '@/lib/tour-pending';
import type { TourEngine } from './useTourEngine';
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
vi.mock('./tour-dom', () => ({
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
const offered = () => track.mock.calls.some((c) => c[1] === 'Opened' && c[2] === 'DrawTourOffer');

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
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
  clearTourPending();
  while (anyModalOpen()) modalClosed();
});

describe('DrawTourHost offer', () => {
  it('offers itself after the settle delay when the person is in Draw', () => {
    editor();
    render(<DrawTourHost />);
    act(() => {
      vi.advanceTimersByTime(799);
    });
    expect(offered()).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(offered()).toBe(true);
    expect(stage.engine?.active).toBe(true);
    expect(stage.helpHref).toBe('/help/canvas/draw-mode/');
  });

  // docs/specs/007-editor/editor-tour.md "Dialogs come first".
  it('waits while a dialog is open, then offers once it closes', () => {
    editor();
    act(() => modalOpened());
    render(<DrawTourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    expect(setUserPreferences).not.toHaveBeenCalled();
    act(() => modalClosed());
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
  });

  it('waits for the person to enter Draw', () => {
    editor({ editorMode: { mode: 'diagram' } });
    const { rerender } = render(<DrawTourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    editor();
    rerender(<DrawTourHost />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
  });

  it.each([
    ['seen', { userPreferences: { tourSeen: true, drawTourSeen: true } }],
    ['read-only', { isReadOnly: true }],
    ['locked', { activeTab: { id: 'tab1', locked: true } }],
    ['not hydrated', { hydrated: false }],
    ['embedded', { embedMode: true }],
    ['in Workshop', { editorMode: { mode: 'workshop' } }],
    ['before the synced preferences are in', { prefsSettled: false }],
  ])('makes no offer when %s', (_why, over) => {
    editor(over);
    render(<DrawTourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
  });

  // docs/specs/023-draw-mode/draw-tour.md "Where it appears": on its own, whatever other tours.
  it('offers itself to someone who has not done the Diagram tour, even with its handoff owed', () => {
    markTourPending();
    editor({ userPreferences: {} });
    render(<DrawTourHost />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
    expect(stage.engine?.hasWelcome).toBe(true);
  });

  it('waits while the Diagram tour is on screen, then follows it', () => {
    setActiveTour('welcome', true);
    editor();
    render(<DrawTourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    act(() => setActiveTour('welcome', false));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
  });

  it('never runs beside the Workshop tour', () => {
    setActiveTour('workshop', true);
    editor();
    render(<DrawTourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
  });

  it('reruns from Settings in Draw', () => {
    editor({ userPreferences: { tourSeen: true, drawTourSeen: true } });
    const { rerender } = render(<DrawTourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    editor();
    rerender(<DrawTourHost />);
    act(() => requestDrawTourRelaunch());
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
  });

  it('ignores a rerun outside Draw', () => {
    editor({ editorMode: { mode: 'diagram' } });
    render(<DrawTourHost />);
    act(() => requestDrawTourRelaunch());
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
  });
});

describe('DrawTourHost end', () => {
  const start = () => {
    editor();
    const r = render(<DrawTourHost />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    return r;
  };

  it('declining marks it seen and sends the decline', () => {
    start();
    act(() => stage.engine!.skip());
    expect(writeUserPreferences).toHaveBeenCalledWith({ tourSeen: true, drawTourSeen: true }, 'me');
    expect(track).toHaveBeenCalledWith('UI', 'Closed', 'DrawTourOffer');
  });

  it('starting runs the steps and completing sends the completion', async () => {
    start();
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'DrawTour');
    // Every anchored step finds no target in this harness and is skipped, so Next runs to the end.
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

  // docs/specs/007-editor/start-diagramming.md "The tours wait".
  it('waits while a start panel is on screen', () => {
    act(() => setStartPanelOpen(true));
    editor();
    render(<DrawTourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    act(() => setStartPanelOpen(false));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
  });

  it('ends as skipped when the person leaves Draw or the tab', () => {
    const r = start();
    act(() => stage.engine!.next());
    editor({ editorMode: { mode: 'diagram' } });
    r.rerender(<DrawTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'DrawTourSkipped');
    expect(stage.engine?.active).toBe(false);
  });
});
