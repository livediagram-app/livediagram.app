// @vitest-environment jsdom

// The Plan tour's way in (docs/specs/026-plan/plan-tour.md "Where it appears"): the footer's Start Tour button, once
// there is a board or Sheet on the open tab, taken or not, naming the track it runs; a press there (or the Settings
// row) starts it on that board or Sheet without changing it, never beside another tour. It never starts on its own.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestPlanTourRelaunch } from '@/lib/plan-tour';
import { setActiveTour } from '@/lib/tour-active';
import {
  resetTourOffersForTests,
  tourOffer,
} from '@liveworkspace/workbench/components/tour/tour-offer';
import type { TourEngine } from '@liveworkspace/workbench/components/tour/useTourEngine';
import type { PlanTourApi } from './plan-tour-steps';
import { PlanTourHost } from './PlanTourHost';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const stage = vi.hoisted(() => ({
  engine: null as TourEngine<PlanTourApi> | null,
  helpHref: '' as string | undefined,
}));
vi.mock('./TourStage', () => ({
  TourStage: ({
    engine,
    copy,
  }: {
    engine: TourEngine<PlanTourApi>;
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
vi.mock('@/app/project/[id]/EditorContext', () => ({
  useEditorContext: () => ctx.current,
  useOptionalEditorContext: () => ctx.current,
}));

const setUserPreferences = vi.fn();
const writeUserPreferences = vi.fn();
const tickTabs = vi.fn();
const showItem = vi.fn();
const closeItem = vi.fn();
const scrollIntoView = vi.fn();

// The person's own board and Sheet: the offer waits for one (docs/specs/026-plan/plan-tour.md).
const BOARD = { id: 'b0', type: 'shape', shape: 'plan-board' };
const SHEET = { id: 's0', type: 'shape', shape: 'plan-sheet' };

const editor = (over: Record<string, unknown> = {}) => {
  ctx.current = {
    hydrated: true,
    anyWelcomeOpen: false,
    isReadOnly: false,
    embedMode: false,
    activeTab: { id: 'tab1', locked: false, elements: [BOARD] },
    userPreferences: {},
    setUserPreferences,
    writeUserPreferences,
    selfParticipant: { id: 'me' },
    plan: { openItemId: null, showItem, closeItem },
    tickTabs,
    scrollIntoView,
    ...over,
  };
};
const onTab = (...elements: unknown[]) => ({
  activeTab: { id: 'tab1', locked: false, elements },
});
const startedTour = () => track.mock.calls.some((c) => c[1] === 'Started' && c[2] === 'PlanTour');
// A drawn board with one card, for the card steps.
const drawBoard = (cards: string[]) => {
  document.body.innerHTML = `<div data-plan-board="b0">${cards
    .map((id) => `<div data-plan-card="${id}"></div>`)
    .join('')}</div>`;
};

// Presses Next until the tour reaches `id` (anchored steps without a target skip themselves; a card waits for Next).
const nextUntil = async (id: string) => {
  for (let i = 0; i < 12 && stage.engine?.step?.id !== id; i++) {
    act(() => stage.engine!.next());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
  }
};

beforeEach(() => {
  vi.useFakeTimers();
  track.mockReset();
  stage.engine = null;
  drawBoard(['card1']);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  setActiveTour('form', false);
  setActiveTour('plan', false);
  document.body.innerHTML = '';
  resetTourOffersForTests();
});

describe('PlanTourHost offer', () => {
  it('offers "Boards" on the footer button with a board on the tab, and never starts on its own', () => {
    editor();
    render(<PlanTourHost />);
    expect(tourOffer()?.name).toBe('Boards');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(startedTour()).toBe(false);
    expect(stage.engine?.active).toBe(false);
  });

  it('starts from the button', () => {
    editor();
    render(<PlanTourHost />);
    act(() => tourOffer()!.start());
    expect(startedTour()).toBe(true);
    expect(stage.engine?.active).toBe(true);
  });

  it('offers nothing on an empty tab, so a Settings rerun there places nothing', () => {
    editor(onTab());
    render(<PlanTourHost />);
    expect(tourOffer()).toBeNull();
    act(() => requestPlanTourRelaunch());
    expect(startedTour()).toBe(false);
    expect(tickTabs).not.toHaveBeenCalled();
  });

  it.each([
    ['read-only', { isReadOnly: true }],
    ['locked', { activeTab: { id: 'tab1', locked: true, elements: [BOARD] } }],
    ['not hydrated', { hydrated: false }],
    ['embedded', { embedMode: true }],
  ])('offers nothing when %s', (_why, over) => {
    editor(over);
    render(<PlanTourHost />);
    expect(tourOffer()).toBeNull();
  });

  it('starts nothing while the Form tour is on screen', () => {
    setActiveTour('form', true);
    editor();
    render(<PlanTourHost />);
    act(() => tourOffer()!.start());
    expect(startedTour()).toBe(false);
  });

  it('reruns from Settings with a board on the tab', () => {
    editor({ userPreferences: { planTourTracks: ['boards', 'sheets'] } });
    render(<PlanTourHost />);
    act(() => requestPlanTourRelaunch());
    expect(startedTour()).toBe(true);
  });
});

describe('PlanTourHost tracks', () => {
  const start = (...elements: unknown[]) => {
    editor(onTab(...elements));
    const r = render(<PlanTourHost />);
    act(() => tourOffer()!.start());
    return r;
  };

  it('a board alone runs the board track on that board', async () => {
    start(BOARD);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(track).toHaveBeenCalledWith('UI', 'View', 'PlanTourStepBoard');
    expect(stage.helpHref).toBe('/help/plan/planning-basics/');
    expect(stage.engine!.countableSteps).toBe(6);
  });

  // docs/specs/026-plan/plan-tour.md "The tour subject": the board the person sees, not the first in the tab.
  it('runs on the board drawn over the canvas when the tab has two', async () => {
    document.body.innerHTML =
      '<div data-plan-board="b0"><div data-plan-card="c1"></div></div>' +
      '<div data-canvas-cover><div data-plan-board="b1"><div data-plan-card="c9"></div></div></div>';
    start(BOARD, { ...BOARD, id: 'b1' });
    await nextUntil('outro');
    expect(showItem).toHaveBeenCalledWith('c9');
    expect(showItem).not.toHaveBeenCalledWith('c1');
  });

  it('does not move the view for a board already on screen over the canvas', async () => {
    document.body.innerHTML =
      '<div data-canvas-cover><div data-plan-board="b0"><div data-plan-card="card1"></div></div></div>';
    start(BOARD);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('a Sheet alone offers and runs the sheet track', async () => {
    editor(onTab(SHEET));
    render(<PlanTourHost />);
    expect(tourOffer()?.name).toBe('Sheets');
    act(() => tourOffer()!.start());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(track).toHaveBeenCalledWith('UI', 'View', 'PlanTourStepSheet');
    expect(stage.helpHref).toBe('/help/plan/sheets/');
  });

  // spec "Tour content": the tour adds its own card to show the card steps on, so an empty board gets them too.
  it('a board with no cards still gets the card steps, on the card the tour adds', () => {
    drawBoard([]);
    start(BOARD);
    expect(stage.engine!.countableSteps).toBe(6);
  });

  it('a tab with both offers Boards first', () => {
    editor(onTab(BOARD, SHEET));
    render(<PlanTourHost />);
    expect(tourOffer()?.name).toBe('Boards');
  });

  // Spec "Tour subject": nothing is placed, added, moved or selected; the card panel is the one thing opened.
  it('runs to the end without changing the project, opening only the first card', async () => {
    start(BOARD);
    // Every anchored step finds no target in this harness and is skipped; a card waits for Next.
    await nextUntil('outro');
    expect(stage.engine?.step?.id).toBe('outro');
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'PlanTourCompleted');
    expect(showItem).toHaveBeenCalledWith('card1');
    expect(tickTabs).not.toHaveBeenCalled();
    expect(
      track.mock.calls.some((c) => c[0] === 'Element' || c[0] === 'Plan' || c[0] === 'Sheet'),
    ).toBe(false);
  });
});

describe('PlanTourHost end', () => {
  const start = () => {
    editor();
    const r = render(<PlanTourHost />);
    act(() => tourOffer()!.start());
    return r;
  };

  it('skipping takes the track and ends as skipped', () => {
    start();
    act(() => stage.engine!.skip());
    expect(writeUserPreferences).toHaveBeenCalledWith({ planTourTracks: ['boards'] }, 'me');
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'PlanTourSkipped');
  });

  it('ends as skipped when the person opens another tab', () => {
    const r = start();
    editor({ activeTab: { id: 'tab2', locked: false, elements: [BOARD] } });
    r.rerender(<PlanTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'PlanTourSkipped');
    expect(stage.engine?.active).toBe(false);
  });

  it('ends as skipped when its board is deleted', () => {
    const r = start();
    editor({ activeTab: { id: 'tab1', locked: false, elements: [SHEET] } });
    r.rerender(<PlanTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'PlanTourSkipped');
    expect(stage.engine?.active).toBe(false);
  });

  it('closes a card panel it left open as it ends', () => {
    editor({ plan: { openItemId: 'card1', showItem, closeItem } });
    render(<PlanTourHost />);
    act(() => tourOffer()!.start());
    act(() => stage.engine!.skip());
    expect(closeItem).toHaveBeenCalled();
  });
});

// docs/specs/026-plan/plan-tour.md "Where it appears": the button names the track not yet taken first.
describe('PlanTourHost per track', () => {
  it('offers Sheets beside a board once Boards is taken', () => {
    editor({ ...onTab(BOARD, SHEET), userPreferences: { planTourTracks: ['boards'] } });
    render(<PlanTourHost />);
    expect(tourOffer()?.name).toBe('Sheets');
  });

  it('still offers Boards on a board once every track is taken', () => {
    editor({ userPreferences: { planTourTracks: ['boards', 'sheets', 'dashboards'] } });
    render(<PlanTourHost />);
    expect(tourOffer()?.name).toBe('Boards');
  });
});
