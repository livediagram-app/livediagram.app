// @vitest-environment jsdom

// The Diagram tour's offer (docs/specs/007-editor/editor-tour.md "Where it appears"): a /new handoff offers
// the tour once the editor is ready on a Diagram tab, and waits for one when the document opened in another
// mode; a user who has already seen it gets no offer and the stale handoff is cleared, and it stays resolved
// even if the preference later flips back. Leaving Diagram mid-tour ends it as skipped.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { anyModalOpen, modalClosed, modalOpened } from '@/lib/modal-guard';
import { hasTourPending, markTourPending, requestTourRelaunch } from '@/lib/tour-pending';
import { setActiveTour } from '@/lib/tour-active';
import { TourHost } from './TourHost';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const popover = vi.hoisted(() => ({
  props: null as null | {
    card?: string;
    title?: string;
    onNext: () => void;
  },
}));
vi.mock('./TourPopover', () => ({
  TourPopover: (props: NonNullable<typeof popover.props>) => {
    popover.props = props;
    return null;
  },
}));
// The offer and the last card are the banner's (TourBanner): read the same way.
vi.mock('./TourBanner', () => ({
  TourBanner: (props: NonNullable<typeof popover.props>) => {
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
vi.mock('@/app/document/[id]/EditorContext', () => ({
  useEditorContext: () => ctx.current,
  useOptionalEditorContext: () => ctx.current,
}));

const editor = (over: Record<string, unknown> = {}) => {
  ctx.current = {
    hydrated: true,
    anyWelcomeOpen: false,
    isReadOnly: false,
    embedMode: false,
    esBoard: false,
    editorMode: { mode: 'diagram' },
    activeTab: { id: 'tab1', locked: false },
    userPreferences: { tourSeen: false },
    closeContextMenu: vi.fn(),
    tourSquare: { place: vi.fn(), remove: tourSquareRemove },
    setSelectedId,
    setUserPreferences: vi.fn(),
    writeUserPreferences,
    selfParticipant: { id: 'me' },
    ...over,
  };
};
const writeUserPreferences = vi.fn();
const tourSquareRemove = vi.fn((): string | null => null);
const setSelectedId = vi.fn();
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
  while (anyModalOpen()) modalClosed();
});

describe('TourHost offer', () => {
  it('offers the tour after a /new handoff once ready', () => {
    markTourPending();
    editor();
    render(<TourHost />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
  });

  it('waits until the editor is ready', () => {
    markTourPending();
    editor({ hydrated: false });
    const { rerender } = render(<TourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    editor();
    rerender(<TourHost />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
  });

  it('makes no offer without a handoff', () => {
    editor();
    render(<TourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
  });

  // docs/specs/007-editor/editor-tour.md "Where it appears": Diagram mode only.
  it.each(['draw', 'pages', 'plan', 'workshop'])(
    'makes no offer on a tab in %s, and keeps it owed for a Diagram tab',
    (mode) => {
      markTourPending();
      editor({ editorMode: { mode } });
      const { rerender } = render(<TourHost />);
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(offered()).toBe(false);
      expect(hasTourPending()).toBe(true);
      editor();
      rerender(<TourHost />);
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(offered()).toBe(true);
    },
  );

  it('is never owed in Workshop without a handoff', () => {
    editor({ editorMode: { mode: 'workshop' } });
    render(<TourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
  });

  it('clears a stale handoff for a user who has seen it, and stays resolved', () => {
    markTourPending();
    editor({ userPreferences: { tourSeen: true } });
    const { rerender } = render(<TourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    expect(hasTourPending()).toBe(false);
    editor({ userPreferences: { tourSeen: false } });
    rerender(<TourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
  });
});

// docs/specs/007-editor/editor-tour.md "Dialogs come first".
describe('TourHost with a dialog open', () => {
  it('holds the offer until the last dialog closes, then offers', () => {
    markTourPending();
    editor();
    act(() => {
      modalOpened();
      modalOpened();
    });
    render(<TourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    act(() => modalClosed());
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    act(() => modalClosed());
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
    // Waiting was not an answer: the handoff stays owed until the offer is.
    expect(hasTourPending()).toBe(true);
  });

  it('holds a Settings rerun while a dialog is still open', () => {
    editor();
    act(() => modalOpened());
    render(<TourHost />);
    act(() => requestTourRelaunch());
    expect(offered()).toBe(false);
    act(() => modalClosed());
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
  });
});

describe('TourHost alongside the Plan tour', () => {
  it('waits while the Plan tour is on screen, then offers', () => {
    // docs/specs/026-plan/plan-tour.md "Where it appears": one tour at a time.
    setActiveTour('plan', true);
    markTourPending();
    editor();
    render(<TourHost />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    act(() => setActiveTour('plan', false));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
  });

  it('holds a Settings rerun until the Plan tour ends', () => {
    setActiveTour('plan', true);
    editor();
    render(<TourHost />);
    act(() => requestTourRelaunch());
    expect(offered()).toBe(false);
    act(() => setActiveTour('plan', false));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
  });

  it('reruns from Settings at once when nothing else is on screen', () => {
    editor();
    render(<TourHost />);
    act(() => requestTourRelaunch());
    expect(offered()).toBe(true);
    expect(hasTourPending()).toBe(true);
  });

  it('holds a Settings rerun off a Diagram tab until the person is on one', () => {
    editor({ editorMode: { mode: 'plan' } });
    const { rerender } = render(<TourHost />);
    act(() => requestTourRelaunch());
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(offered()).toBe(false);
    editor();
    rerender(<TourHost />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(offered()).toBe(true);
  });
});

describe('TourHost running', () => {
  const runToOutro = async () => {
    editor();
    render(<TourHost />);
    act(() => requestTourRelaunch());
    act(() => popover.props!.onNext());
    // Every anchored step finds no target in this harness and is skipped, so it runs to the outro.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(popover.props!.card).toBe('outro');
  };

  it('welcomes the person to Diagram and sends them off to diagram', async () => {
    editor();
    render(<TourHost />);
    act(() => requestTourRelaunch());
    expect(popover.props!.title).toBe('Getting started with Diagrams?');
    act(() => popover.props!.onNext());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(popover.props!.title).toBe("You're ready to diagram");
  });

  it('takes away the square it placed, and its selection, when it ends', async () => {
    tourSquareRemove.mockReturnValueOnce('sq1');
    await runToOutro();
    act(() => popover.props!.onNext());
    expect(tourSquareRemove).toHaveBeenCalled();
    expect(setSelectedId).toHaveBeenCalledWith(null);
    expect(writeUserPreferences).toHaveBeenCalledWith({ tourSeen: true }, 'me');
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'TourCompleted');
  });

  it('ends as skipped when the tab leaves Diagram mid-tour', () => {
    editor();
    const { rerender } = render(<TourHost />);
    act(() => requestTourRelaunch());
    act(() => popover.props!.onNext());
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'Tour');
    editor({ editorMode: { mode: 'draw' } });
    rerender(<TourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'TourSkipped');
    expect(writeUserPreferences).toHaveBeenCalledWith({ tourSeen: true }, 'me');
    expect(hasTourPending()).toBe(false);
  });
});
