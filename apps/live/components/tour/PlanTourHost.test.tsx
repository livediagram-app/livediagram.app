// @vitest-environment jsdom

// The Plan tour's offer (docs/specs/026-plan/plan-tour.md "Where it appears"): in Plan, once there is a board
// or Sheet on the open tab, once, never beside another tour, rerun from Settings (waiting for a board or
// Sheet the same way), and run on that board or Sheet without changing it.

import { PLAN_TOUR_RELAUNCH_EVENT } from '@/lib/plan-tour';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestPlanTourRelaunch } from '@/lib/plan-tour';
import { setActiveTour } from '@/lib/tour-active';
import { clearTourPending, markTourPending } from '@/lib/tour-pending';
import type { TourEngine } from './useTourEngine';
import type { PlanTourApi } from './plan-tour-steps';
import { PlanTourHost } from './PlanTourHost';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
type Choice = { id: string; label: string; onPick: () => void };
const stage = vi.hoisted(() => ({
  engine: null as TourEngine<PlanTourApi> | null,
  choices: undefined as readonly Choice[] | undefined,
  helpHref: '' as string | undefined,
}));
vi.mock('./TourStage', () => ({
  TourStage: ({
    engine,
    welcomeChoices,
    copy,
  }: {
    engine: TourEngine<PlanTourApi>;
    welcomeChoices?: readonly Choice[];
    copy: { helpHref?: string };
  }) => {
    stage.engine = engine;
    stage.choices = welcomeChoices;
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
vi.mock('@/app/document/[id]/EditorContext', () => ({ useEditorContext: () => ctx.current }));

const setUserPreferences = vi.fn();
const writeUserPreferences = vi.fn();
const tickTabs = vi.fn();
const showItem = vi.fn();
const closeItem = vi.fn();

// The person's own board and Sheet: the offer waits for one (docs/specs/026-plan/plan-tour.md).
const BOARD = { id: 'b0', type: 'shape', shape: 'plan-board' };
const SHEET = { id: 's0', type: 'shape', shape: 'plan-sheet' };

const editor = (over: Record<string, unknown> = {}) => {
  ctx.current = {
    hydrated: true,
    anyWelcomeOpen: false,
    isReadOnly: false,
    embedMode: false,
    editorMode: { mode: 'plan' },
    activeTab: { id: 'tab1', locked: false, elements: [BOARD] },
    userPreferences: {},
    setUserPreferences,
    writeUserPreferences,
    selfParticipant: { id: 'me' },
    plan: { openItemId: null, showItem, closeItem },
    tickTabs,
    ...over,
  };
};
const onTab = (...elements: unknown[]) => ({
  activeTab: { id: 'tab1', locked: false, elements },
});
const offered = () => track.mock.calls.some((c) => c[1] === 'Opened' && c[2] === 'PlanTourOffer');
// A drawn board with one card, for the card steps.
const drawBoard = (cards: string[]) => {
  document.body.innerHTML = `<div data-element-id="b0">${cards
    .map((id) => `<div data-plan-card="${id}"></div>`)
    .join('')}</div>`;
};

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  track.mockReset();
  stage.engine = null;
  stage.choices = undefined;
  drawBoard(['card1']);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  setActiveTour('welcome', false);
  setActiveTour('plan', false);
  clearTourPending();
  document.body.innerHTML = '';
});

describe('PlanTourHost offer', () => {
  it('offers itself after the settle delay when the person is in Plan with a board', () => {
    editor();
    render(<PlanTourHost />);
    act(() => vi.advanceTimersByTime(799));
    expect(offered()).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(offered()).toBe(true);
    expect(stage.engine?.active).toBe(true);
  });

  it('waits for the person to enter Plan', () => {
    editor({ editorMode: { mode: 'diagram' } });
    const { rerender } = render(<PlanTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
    editor();
    rerender(<PlanTourHost />);
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
  });

  it.each([
    ['an empty tab', onTab()],
    ['a Dashboard', onTab({ id: 'd0', type: 'shape', shape: 'plan-dashboard' })],
  ])('waits on %s for a board or Sheet, then offers itself', (_why, over) => {
    editor(over);
    const { rerender } = render(<PlanTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
    editor(onTab(SHEET));
    rerender(<PlanTourHost />);
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
  });

  it('a Settings rerun on an empty tab places nothing and waits for a board or Sheet', () => {
    editor({ ...onTab(), userPreferences: { planTourSeen: true } });
    const { rerender } = render(<PlanTourHost />);
    editor(onTab());
    rerender(<PlanTourHost />);
    act(() => {
      window.dispatchEvent(new Event(PLAN_TOUR_RELAUNCH_EVENT));
    });
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
    expect(tickTabs).not.toHaveBeenCalled();
    editor(onTab(BOARD));
    rerender(<PlanTourHost />);
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
  });

  it.each([
    ['seen', { userPreferences: { planTourSeen: true } }],
    ['read-only', { isReadOnly: true }],
    ['locked', { activeTab: { id: 'tab1', locked: true, elements: [BOARD] } }],
    ['not hydrated', { hydrated: false }],
    ['embedded', { embedMode: true }],
  ])('makes no offer when %s', (_why, over) => {
    editor(over);
    render(<PlanTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
  });

  it('waits while the Diagram tour is on screen, then follows it', () => {
    setActiveTour('welcome', true);
    editor();
    render(<PlanTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
    act(() => setActiveTour('welcome', false));
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
  });

  // The Diagram tour never runs in Plan, so its owed handoff no longer holds this one back.
  it('does not wait for the Diagram tour still being owed', () => {
    markTourPending();
    editor();
    render(<PlanTourHost />);
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
  });

  it('reruns from Settings in Plan, and not outside it', () => {
    editor({ userPreferences: { planTourSeen: true } });
    const { rerender } = render(<PlanTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
    editor();
    rerender(<PlanTourHost />);
    act(() => requestPlanTourRelaunch());
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
  });

  it('ignores a rerun outside Plan', () => {
    editor({ editorMode: { mode: 'diagram' } });
    render(<PlanTourHost />);
    act(() => requestPlanTourRelaunch());
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
  });
});

describe('PlanTourHost tracks', () => {
  const start = (...elements: unknown[]) => {
    editor(onTab(...elements));
    const r = render(<PlanTourHost />);
    act(() => vi.advanceTimersByTime(800));
    return r;
  };

  it('a board alone skips the choice and runs the board track on that board', async () => {
    start(BOARD);
    expect(stage.choices).toBeUndefined();
    expect(stage.engine!.step?.body).toMatch(/your board/);
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'PlanTour');
    expect(track).not.toHaveBeenCalledWith('UI', 'Selected', 'PlanTourBoards');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(track).toHaveBeenCalledWith('UI', 'View', 'PlanTourStepBoard');
    expect(stage.helpHref).toBe('/help/canvas/plan-mode/');
    expect(stage.engine!.countableSteps).toBe(6);
  });

  it('a Sheet alone skips the choice and runs the sheet track', async () => {
    start(SHEET);
    expect(stage.choices).toBeUndefined();
    expect(stage.engine!.step?.body).toMatch(/your sheet/);
    act(() => stage.engine!.next());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(track).toHaveBeenCalledWith('UI', 'View', 'PlanTourStepSheet');
    expect(stage.helpHref).toBe('/help/canvas/plan-mode/sheets/');
  });

  it('a board with no cards leaves out the card steps', () => {
    drawBoard([]);
    start(BOARD);
    expect(stage.engine!.countableSteps).toBe(4);
  });

  it('a tab with both asks which, and picking Spreadsheets runs the sheet track', async () => {
    start(BOARD, SHEET);
    expect(stage.choices?.map((c) => c.label)).toEqual(['Boards', 'Spreadsheets']);
    act(() => stage.choices!.find((c) => c.id === 'sheets')!.onPick());
    expect(track).toHaveBeenCalledWith('UI', 'Selected', 'PlanTourSheets');
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'PlanTour');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(track).toHaveBeenCalledWith('UI', 'View', 'PlanTourStepSheet');
    expect(stage.helpHref).toBe('/help/canvas/plan-mode/sheets/');
  });

  it('a tab with both, picking Boards runs the board track', async () => {
    start(BOARD, SHEET);
    act(() => stage.choices!.find((c) => c.id === 'boards')!.onPick());
    expect(track).toHaveBeenCalledWith('UI', 'Selected', 'PlanTourBoards');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(track).toHaveBeenCalledWith('UI', 'View', 'PlanTourStepBoard');
  });

  // Spec "Tour subject": nothing is placed, added, moved or selected; the card panel is the one thing opened.
  it('runs to the end without changing the document, opening only the first card', async () => {
    start(BOARD);
    act(() => stage.engine!.next());
    // Every anchored step finds no target in this harness and is skipped, so Next runs to the end.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
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
    act(() => vi.advanceTimersByTime(800));
    return r;
  };

  it('declining marks it seen and sends the decline', () => {
    start();
    act(() => stage.engine!.skip());
    expect(writeUserPreferences).toHaveBeenCalledWith({ planTourSeen: true }, 'me');
    expect(track).toHaveBeenCalledWith('UI', 'Closed', 'PlanTourOffer');
  });

  it('starting, then skipping, ends as skipped', async () => {
    start();
    act(() => stage.engine!.next());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    act(() => stage.engine!.skip());
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
    act(() => stage.engine!.next());
    editor({ activeTab: { id: 'tab1', locked: false, elements: [SHEET] } });
    r.rerender(<PlanTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'PlanTourSkipped');
    expect(stage.engine?.active).toBe(false);
  });

  it('closes a card panel it left open as it ends', () => {
    editor({ plan: { openItemId: 'card1', showItem, closeItem } });
    render(<PlanTourHost />);
    act(() => vi.advanceTimersByTime(800));
    act(() => stage.engine!.skip());
    expect(closeItem).toHaveBeenCalled();
  });
});
