// @vitest-environment jsdom

// The Avatar tour's way in (docs/specs/008-canvas/avatar-tour.md "Where it appears"): the footer's Start Tour button
// offers it in Avatar mode whatever the role, ahead of the mode's own tour, taken or not; a press there (or the
// Settings row) starts it, never beside another tour, and it never starts on its own.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestAvatarTourRelaunch } from '@/lib/avatar-tour';
import { setActiveTour } from '@/lib/tour-active';
import { setStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import {
  publishTourOffer,
  resetTourOffersForTests,
  TOUR_OFFER_RANK,
  tourOffer,
} from '@liveworkspace/workbench/components/tour/tour-offer';
import type { TourEngine } from '@liveworkspace/workbench/components/tour/useTourEngine';
import type { AvatarTourApi } from './avatar-tour-steps';
import { AvatarTourHost } from './AvatarTourHost';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const stage = vi.hoisted(() => ({
  engine: null as TourEngine<AvatarTourApi> | null,
  helpHref: '' as string | undefined,
}));
vi.mock('./TourStage', () => ({
  TourStage: ({
    engine,
    copy,
  }: {
    engine: TourEngine<AvatarTourApi>;
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
    canvasTool: 'avatar',
    can: { takePart: true },
    activeTab: { id: 'tab1', locked: false },
    userPreferences: { tourSeen: true },
    setUserPreferences,
    writeUserPreferences,
    selfParticipant: { id: 'me' },
    prefsSettled: true,
    ...over,
  };
};
const startedTour = () => track.mock.calls.some((c) => c[1] === 'Started' && c[2] === 'AvatarTour');

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
  setActiveTour('avatar', false);
  setStartPanelOpen(false);
  resetTourOffersForTests();
});

describe('AvatarTourHost offer', () => {
  it('offers "Avatar" on the footer button in Avatar mode, and never starts on its own', () => {
    editor();
    render(<AvatarTourHost />);
    expect(tourOffer()?.name).toBe('Avatar');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(startedTour()).toBe(false);
  });

  it("wins the button over the mode's own tour", () => {
    publishTourOffer('draw', {
      id: 'draw',
      name: 'Draw',
      rank: TOUR_OFFER_RANK.mode,
      start: () => {},
    });
    editor();
    render(<AvatarTourHost />);
    expect(tourOffer()?.name).toBe('Avatar');
  });

  it('starts from the button, linking to its article', () => {
    editor();
    render(<AvatarTourHost />);
    act(() => tourOffer()!.start());
    expect(startedTour()).toBe(true);
    expect(stage.helpHref).toBe('/help/selection-modes/avatar-mode/');
  });

  it('offers nothing until the person walks as an avatar', () => {
    editor({ canvasTool: 'select' });
    const { rerender } = render(<AvatarTourHost />);
    expect(tourOffer()).toBeNull();
    editor();
    rerender(<AvatarTourHost />);
    expect(tourOffer()?.name).toBe('Avatar');
  });

  // docs/specs/008-canvas/avatar-tour.md "Share roles": the mode is a Viewer's too.
  it('offers itself to a Viewer, without the Say Something step', () => {
    editor({ isReadOnly: true, can: { takePart: false } });
    render(<AvatarTourHost />);
    act(() => tourOffer()!.start());
    expect(stage.engine!.countableSteps).toBe(4);
  });

  it('counts five steps for someone who may speak', () => {
    editor();
    render(<AvatarTourHost />);
    expect(stage.engine!.countableSteps).toBe(5);
  });

  it('stays on offer once seen, so it can be taken again', () => {
    editor({ userPreferences: { tourSeen: true, avatarTourSeen: true } });
    render(<AvatarTourHost />);
    expect(tourOffer()?.name).toBe('Avatar');
  });

  it.each([
    ['not hydrated', { hydrated: false }],
    ['embedded', { embedMode: true }],
  ])('offers nothing when %s', (_why, over) => {
    editor(over);
    render(<AvatarTourHost />);
    expect(tourOffer()).toBeNull();
  });

  it('never starts beside another tour', () => {
    setActiveTour('draw', true);
    editor();
    render(<AvatarTourHost />);
    act(() => tourOffer()!.start());
    expect(startedTour()).toBe(false);
  });

  it('reruns from Settings in Avatar mode, and not outside it', () => {
    editor({ canvasTool: 'select' });
    const { rerender } = render(<AvatarTourHost />);
    act(() => requestAvatarTourRelaunch());
    expect(startedTour()).toBe(false);
    editor();
    rerender(<AvatarTourHost />);
    act(() => requestAvatarTourRelaunch());
    expect(startedTour()).toBe(true);
  });

  it('offers nothing while a start panel is on screen', () => {
    act(() => setStartPanelOpen(true));
    editor();
    render(<AvatarTourHost />);
    expect(tourOffer()).toBeNull();
    act(() => setStartPanelOpen(false));
    expect(tourOffer()?.name).toBe('Avatar');
  });
});

describe('AvatarTourHost end', () => {
  const start = () => {
    editor();
    const r = render(<AvatarTourHost />);
    act(() => tourOffer()!.start());
    return r;
  };

  it('skipping marks it seen and sends the skip', () => {
    start();
    act(() => stage.engine!.skip());
    expect(writeUserPreferences).toHaveBeenCalledWith(
      { tourSeen: true, avatarTourSeen: true },
      'me',
    );
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'AvatarTourSkipped');
  });

  it('runs the steps and completing sends the completion', async () => {
    start();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(stage.engine?.step?.id).toBe('outro');
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'AvatarTourCompleted');
  });

  it('ends as skipped when the person leaves Avatar mode', () => {
    const r = start();
    editor({ canvasTool: 'select' });
    r.rerender(<AvatarTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'AvatarTourSkipped');
    expect(stage.engine?.active).toBe(false);
  });
});
