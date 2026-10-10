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
const popover = vi.hoisted(() => ({
  props: null as null | {
    card?: string;
    onNext: () => void;
    outroChoice?: { label: string; onPick: () => void };
  },
}));
vi.mock('./TourPopover', () => ({
  TourPopover: (props: NonNullable<typeof popover.props>) => {
    popover.props = props;
    return null;
  },
}));
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
    editorMode: { mode: 'diagram' },
    isOwner: true,
    prefsSettled: true,
    activeTab: { id: 'tab1', locked: false },
    userPreferences: { tourSeen: false },
    closeContextMenu: vi.fn(),
    setUserPreferences: vi.fn(),
    writeUserPreferences,
    selfParticipant: { id: 'me' },
    ...over,
  };
};
const writeUserPreferences = vi.fn();
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

  // docs/specs/012-collaboration/facilitate-tour.md "Where it appears": the welcome tour comes first.
  it('is owed in Facilitate to someone who has seen neither tour', () => {
    editor({ editorMode: { mode: 'facilitate' } });
    render(<TourHost />);
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
  });

  it.each([
    ["to an Editor joining someone else's session", { isOwner: false }],
    ['before the synced preferences are in', { prefsSettled: false }],
    ['on a locked tab', { activeTab: { id: 'tab1', locked: true } }],
  ])('is not owed in Facilitate %s', (_why, over) => {
    editor({ editorMode: { mode: 'facilitate' }, ...over });
    render(<TourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
  });

  it('is not owed in Facilitate once the Facilitate tour is answered, or once it is seen', () => {
    editor({
      editorMode: { mode: 'facilitate' },
      userPreferences: { tourSeen: false, facilitateTourSeen: true },
    });
    const { rerender } = render(<TourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
    editor({ editorMode: { mode: 'facilitate' }, userPreferences: { tourSeen: true } });
    rerender(<TourHost />);
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

// docs/specs/012-collaboration/facilitate-tour.md "Where it appears": the Facilitate tour's offer rides on
// this tour's closing card, never a pop-up after it.
describe('TourHost closing card in Facilitate', () => {
  const runToOutro = async (mode: string) => {
    editor({ editorMode: { mode } });
    render(<TourHost />);
    act(() => requestTourRelaunch());
    act(() => popover.props!.onNext());
    // Every anchored step finds no target in this harness and is skipped, so it runs to the outro.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(popover.props!.card).toBe('outro');
  };

  it('offers Show me Facilitate, which ends this tour and starts that one', async () => {
    const started = vi.fn();
    window.addEventListener('livediagram:facilitate-tour-start', started);
    await runToOutro('facilitate');
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'FacilitateTourOffer');
    expect(popover.props!.outroChoice?.label).toBe('Show me Facilitate');
    act(() => popover.props!.outroChoice!.onPick());
    expect(started).toHaveBeenCalledTimes(1);
    expect(writeUserPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ tourSeen: true, facilitateTourSeen: true }),
      'me',
    );
    expect(track).not.toHaveBeenCalledWith('UI', 'Closed', 'FacilitateTourOffer');
    window.removeEventListener('livediagram:facilitate-tour-start', started);
  });

  it('finishing without it answers the Facilitate tour too, so nothing pops up after', async () => {
    await runToOutro('facilitate');
    act(() => popover.props!.onNext());
    expect(writeUserPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ tourSeen: true, facilitateTourSeen: true }),
      'me',
    );
    expect(track).toHaveBeenCalledWith('UI', 'Closed', 'FacilitateTourOffer');
  });

  it('has no Facilitate offer outside Facilitate', async () => {
    await runToOutro('diagram');
    expect(popover.props!.outroChoice).toBeUndefined();
  });
});
