// @vitest-environment jsdom

// The Workshop tour's offer (docs/specs/012-collaboration/workshop-tour.md "Where it appears"): on
// entering Workshop, once, on its own (the Diagram tour never runs in Workshop), never with another tour,
// and rerun from Settings.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestWorkshopTourRelaunch } from '@/lib/workshop-tour';
import { setActiveTour } from '@/lib/tour-active';
import { clearTourPending, markTourPending } from '@/lib/tour-pending';
import type { TourEngine } from './useTourEngine';
import type { WorkshopTourApi } from './workshop-tour-steps';
import { WorkshopTourHost } from './WorkshopTourHost';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const stage = vi.hoisted(() => ({
  engine: null as TourEngine<WorkshopTourApi> | null,
  helpHref: '' as string | undefined,
}));
// The fold and chip callbacks the host hands the dock, to fire as the dock would.
const dockChip = vi.hoisted(() => ({
  onFolded: undefined as (() => void) | undefined,
  onChipStart: undefined as (() => void) | undefined,
}));
vi.mock('./coach-dock/CoachDockStage', () => ({
  CoachDockStage: ({
    onFolded,
    onChipStart,
    engine,
    help,
  }: {
    onFolded?: () => void;
    onChipStart?: () => void;
    engine: TourEngine<WorkshopTourApi>;
    help: { href: string };
  }) => {
    dockChip.onFolded = onFolded;
    dockChip.onChipStart = onChipStart;
    stage.engine = engine;
    stage.helpHref = help.href;
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
    editorMode: { mode: 'workshop' },
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
  track.mock.calls.some((c) => c[1] === 'Opened' && c[2] === 'WorkshopTourOffer');

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
  setActiveTour('workshop', false);
  clearTourPending();
});

describe('WorkshopTourHost offer', () => {
  it('offers itself after the settle delay when the person is in Workshop', () => {
    editor();
    render(<WorkshopTourHost />);
    act(() => {
      vi.advanceTimersByTime(799);
    });
    expect(offered()).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(offered()).toBe(true);
    expect(stage.engine?.active).toBe(true);
    expect(stage.helpHref).toBe('/help/canvas/workshop-mode/');
  });

  it('waits for the person to enter Workshop', () => {
    editor({ editorMode: { mode: 'diagram' } });
    const { rerender } = render(<WorkshopTourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    editor();
    rerender(<WorkshopTourHost />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
  });

  it.each([
    ['seen', { userPreferences: { tourSeen: true, workshopTourSeen: true } }],
    ['read-only', { isReadOnly: true }],
    ['locked', { activeTab: { id: 'tab1', locked: true } }],
    ['not hydrated', { hydrated: false }],
    ['embedded', { embedMode: true }],
    ['in Plan', { editorMode: { mode: 'plan' } }],
    ['before the synced preferences are in', { prefsSettled: false }],
  ])('makes no offer when %s', (_why, over) => {
    editor(over);
    render(<WorkshopTourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
  });

  // docs/specs/012-collaboration/workshop-tour.md "Where it appears": on its own, whatever other tours.
  it('offers itself to someone who has not done the Diagram tour, even with its handoff owed', () => {
    markTourPending();
    editor({ userPreferences: {} });
    render(<WorkshopTourHost />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
    expect(stage.engine?.hasWelcome).toBe(true);
  });

  it('waits while the Diagram tour is on screen, then follows it', () => {
    setActiveTour('welcome', true);
    editor();
    render(<WorkshopTourHost />);
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

  it('never runs beside the Plan tour', () => {
    setActiveTour('plan', true);
    editor();
    render(<WorkshopTourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
  });

  it('reruns from Settings in Workshop', () => {
    editor({ userPreferences: { tourSeen: true, workshopTourSeen: true } });
    const { rerender } = render(<WorkshopTourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    editor();
    rerender(<WorkshopTourHost />);
    act(() => requestWorkshopTourRelaunch());
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
  });

  it('ignores a rerun outside Workshop', () => {
    editor({ editorMode: { mode: 'diagram' } });
    render(<WorkshopTourHost />);
    act(() => requestWorkshopTourRelaunch());
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
  });
});

describe('WorkshopTourHost end', () => {
  const start = () => {
    editor();
    const r = render(<WorkshopTourHost />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    return r;
  };

  it('declining marks it seen and sends the decline', () => {
    start();
    act(() => stage.engine!.skip());
    expect(writeUserPreferences).toHaveBeenCalledWith(
      { tourSeen: true, workshopTourSeen: true },
      'me',
    );
    expect(track).toHaveBeenCalledWith('UI', 'Closed', 'WorkshopTourOffer');
  });

  it('starting runs the steps and completing sends the completion', async () => {
    start();
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'WorkshopTour');
    // Every anchored step finds no target in this harness and is skipped, so Next runs to the end.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(stage.engine?.step?.id).toBe('outro');
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'WorkshopTourCompleted');
    expect(writeUserPreferences).toHaveBeenCalledWith(
      { tourSeen: true, workshopTourSeen: true },
      'me',
    );
  });

  it('leaves the Share step out where there is no Share button', () => {
    dom.share = false;
    start();
    expect(stage.engine!.countableSteps).toBe(2);
  });

  it('keeps the Share step where there is one', () => {
    start();
    expect(stage.engine!.countableSteps).toBe(3);
  });

  it('ends as skipped when the person leaves Workshop or the tab', () => {
    const r = start();
    act(() => stage.engine!.next());
    editor({ editorMode: { mode: 'diagram' } });
    r.rerender(<WorkshopTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'WorkshopTourSkipped');
    expect(stage.engine?.active).toBe(false);
  });
});

describe('WorkshopTourHost in the coach dock', () => {
  it('counts an offer folding into its chip, and a start from the chip', () => {
    editor();
    render(<WorkshopTourHost />);
    act(() => dockChip.onFolded!());
    expect(track).toHaveBeenCalledWith('UI', 'Closed', 'WorkshopTourOfferFolded');
    act(() => dockChip.onChipStart!());
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'WorkshopTourChip');
  });
});
