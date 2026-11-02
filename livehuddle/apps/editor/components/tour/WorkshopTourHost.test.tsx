// @vitest-environment jsdom

// The Workshop tour's way in (docs/specs/012-collaboration/workshop-tour.md "Where it appears"): the footer's Start
// Tour button offers it in Workshop, taken or not; a press there (or the Settings row) starts it, never beside another
// tour, and it never starts on its own.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestWorkshopTourRelaunch } from '@/lib/workshop-tour';
import { setActiveTour } from '@/lib/tour-active';
import {
  resetTourOffersForTests,
  tourOffer,
} from '@liveworkspace/workbench/components/tour/tour-offer';
import type { TourEngine } from '@liveworkspace/workbench/components/tour/useTourEngine';
import type { WorkshopTourApi } from './workshop-tour-steps';
import { WorkshopTourHost } from './WorkshopTourHost';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const stage = vi.hoisted(() => ({
  engine: null as TourEngine<WorkshopTourApi> | null,
  helpHref: '' as string | undefined,
}));
vi.mock('./TourStage', () => ({
  TourStage: ({
    engine,
    copy,
  }: {
    engine: TourEngine<WorkshopTourApi>;
    copy: { helpHref?: string };
  }) => {
    stage.engine = engine;
    stage.helpHref = copy.helpHref;
    return null;
  },
}));
const dom = vi.hoisted(() => ({ share: true }));
vi.mock('@liveworkspace/workbench/components/tour/tour-dom', () => ({
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
    // The demonstration elements a tour places (useTourSquare).
    tourSquare: { place: vi.fn(), replace: vi.fn(), remove: vi.fn(() => []) },
    selfParticipant: { id: 'me' },
    prefsSettled: true,
    ...over,
  };
};
const startedTour = () =>
  track.mock.calls.some((c) => c[1] === 'Started' && c[2] === 'WorkshopTour');
const seenPrefs = { tourSeen: true, workshopTourSeen: true };

beforeEach(() => {
  vi.useFakeTimers();
  track.mockReset();
  stage.engine = null;
  dom.share = true;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  setActiveTour('welcome', false);
  setActiveTour('draw', false);
  setActiveTour('workshop', false);
  resetTourOffersForTests();
});

describe('WorkshopTourHost offer', () => {
  it('offers "Workshop" on the footer button in Workshop, and never starts on its own', () => {
    editor();
    render(<WorkshopTourHost />);
    expect(tourOffer()?.name).toBe('Workshop');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(startedTour()).toBe(false);
  });

  it('starts from the button, linking to its article', () => {
    editor();
    render(<WorkshopTourHost />);
    act(() => tourOffer()!.start());
    expect(startedTour()).toBe(true);
    expect(stage.engine?.active).toBe(true);
    expect(stage.helpHref).toBe('/help/canvas/workshop-mode/');
  });

  it('stays on offer once seen, so it can be taken again', () => {
    editor({ userPreferences: seenPrefs });
    render(<WorkshopTourHost />);
    expect(tourOffer()?.name).toBe('Workshop');
  });

  it.each([
    ['read-only', { isReadOnly: true }],
    ['locked', { activeTab: { id: 'tab1', locked: true } }],
    ['not hydrated', { hydrated: false }],
    ['embedded', { embedMode: true }],
    ['in Diagram', { editorMode: { mode: 'diagram' } }],
    ['in Draw', { editorMode: { mode: 'draw' } }],
  ])('offers nothing when %s', (_why, over) => {
    editor(over);
    render(<WorkshopTourHost />);
    expect(tourOffer()).toBeNull();
  });

  it('never starts beside the Draw tour', () => {
    setActiveTour('draw', true);
    editor();
    render(<WorkshopTourHost />);
    act(() => tourOffer()!.start());
    expect(startedTour()).toBe(false);
  });

  it('reruns from Settings in Workshop', () => {
    editor({ userPreferences: seenPrefs });
    render(<WorkshopTourHost />);
    act(() => requestWorkshopTourRelaunch());
    expect(startedTour()).toBe(true);
  });

  it('ignores a rerun outside Workshop', () => {
    editor({ editorMode: { mode: 'diagram' } });
    render(<WorkshopTourHost />);
    act(() => requestWorkshopTourRelaunch());
    expect(startedTour()).toBe(false);
  });
});

describe('WorkshopTourHost end', () => {
  const start = () => {
    editor();
    const r = render(<WorkshopTourHost />);
    act(() => tourOffer()!.start());
    return r;
  };

  it('skipping marks it seen and sends the skip', () => {
    start();
    act(() => stage.engine!.skip());
    expect(writeUserPreferences).toHaveBeenCalledWith(seenPrefs, 'me');
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'WorkshopTourSkipped');
  });

  it('runs the steps and completing sends the completion', async () => {
    start();
    // Every anchored step finds no target in this harness and is skipped, so it runs to the end.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(stage.engine?.step?.id).toBe('outro');
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'WorkshopTourCompleted');
    expect(writeUserPreferences).toHaveBeenCalledWith(seenPrefs, 'me');
  });

  it('leaves the Share step out where there is no Share button', () => {
    dom.share = false;
    start();
    expect(stage.engine!.countableSteps).toBe(5);
  });

  it('keeps the Share step where there is one', () => {
    start();
    expect(stage.engine!.countableSteps).toBe(6);
  });

  it('ends as skipped when the person leaves Workshop or the tab', () => {
    const r = start();
    editor({ editorMode: { mode: 'diagram' } });
    r.rerender(<WorkshopTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'WorkshopTourSkipped');
    expect(stage.engine?.active).toBe(false);
  });
});
