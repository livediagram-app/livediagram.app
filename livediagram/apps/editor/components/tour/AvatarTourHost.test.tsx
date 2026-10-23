// @vitest-environment jsdom

// The Avatar tour's offer (docs/specs/008-canvas/avatar-tour.md "Where it appears"): on entering Avatar mode,
// once, whatever the role, never with another tour, and rerun from Settings.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestAvatarTourRelaunch } from '@/lib/avatar-tour';
import { setActiveTour } from '@/lib/tour-active';
import { setStartPanelOpen } from '@/components/start/start-panel-open';
import type { TourEngine } from './useTourEngine';
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
const offered = () => track.mock.calls.some((c) => c[1] === 'Opened' && c[2] === 'AvatarTourOffer');

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
  setActiveTour('avatar', false);
  setStartPanelOpen(false);
});

describe('AvatarTourHost offer', () => {
  it('offers itself after the settle delay in Avatar mode, linking to its article', () => {
    editor();
    render(<AvatarTourHost />);
    act(() => {
      vi.advanceTimersByTime(799);
    });
    expect(offered()).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(offered()).toBe(true);
    expect(stage.helpHref).toBe('/help/selection-modes/avatar-mode/');
  });

  it('waits for the person to walk as an avatar', () => {
    editor({ canvasTool: 'select' });
    const { rerender } = render(<AvatarTourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    editor();
    rerender(<AvatarTourHost />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
  });

  // docs/specs/008-canvas/avatar-tour.md "Share roles": the mode is a Viewer's too.
  it('offers itself to a Viewer, without the Say Something step', () => {
    editor({ isReadOnly: true, can: { takePart: false } });
    render(<AvatarTourHost />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
    expect(stage.engine!.countableSteps).toBe(4);
  });

  it('counts five steps for someone who may speak', () => {
    editor();
    render(<AvatarTourHost />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(stage.engine!.countableSteps).toBe(5);
  });

  it.each([
    ['seen', { userPreferences: { tourSeen: true, avatarTourSeen: true } }],
    ['not hydrated', { hydrated: false }],
    ['embedded', { embedMode: true }],
    ['before the synced preferences are in', { prefsSettled: false }],
  ])('makes no offer when %s', (_why, over) => {
    editor(over);
    render(<AvatarTourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
  });

  it('never runs beside another tour, then follows it', () => {
    setActiveTour('draw', true);
    editor();
    render(<AvatarTourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    act(() => setActiveTour('draw', false));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
  });

  it('reruns from Settings in Avatar mode, and not outside it', () => {
    editor({ canvasTool: 'select', userPreferences: { tourSeen: true } });
    const { rerender } = render(<AvatarTourHost />);
    act(() => requestAvatarTourRelaunch());
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    editor({ userPreferences: { tourSeen: true, avatarTourSeen: true } });
    rerender(<AvatarTourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    editor();
    rerender(<AvatarTourHost />);
    act(() => requestAvatarTourRelaunch());
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
  });

  it('waits while a start panel is on screen', () => {
    act(() => setStartPanelOpen(true));
    editor();
    render(<AvatarTourHost />);
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
});

describe('AvatarTourHost end', () => {
  const start = () => {
    editor();
    const r = render(<AvatarTourHost />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    return r;
  };

  it('declining marks it seen and sends the decline', () => {
    start();
    act(() => stage.engine!.skip());
    expect(writeUserPreferences).toHaveBeenCalledWith(
      { tourSeen: true, avatarTourSeen: true },
      'me',
    );
    expect(track).toHaveBeenCalledWith('UI', 'Closed', 'AvatarTourOffer');
  });

  it('starting runs the steps and completing sends the completion', async () => {
    start();
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'AvatarTour');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(stage.engine?.step?.id).toBe('outro');
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'AvatarTourCompleted');
  });

  it('ends as skipped when the person leaves Avatar mode', () => {
    const r = start();
    act(() => stage.engine!.next());
    editor({ canvasTool: 'select' });
    r.rerender(<AvatarTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'AvatarTourSkipped');
    expect(stage.engine?.active).toBe(false);
  });
});
