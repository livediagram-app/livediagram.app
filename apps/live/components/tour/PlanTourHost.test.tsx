// @vitest-environment jsdom

// The Plan tour's offer (docs/specs/026-plan/plan-tour.md "Where it appears"): on entering Plan, once,
// never with the welcome tour, rerun from Settings, and its tour content taken away however it ends.

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
  choices: [] as readonly Choice[],
  helpHref: '' as string | undefined,
}));
vi.mock('./TourStage', () => ({
  TourStage: ({
    engine,
    welcomeChoices,
    copy,
  }: {
    engine: TourEngine<PlanTourApi>;
    welcomeChoices: readonly Choice[];
    copy: { helpHref?: string };
  }) => {
    stage.engine = engine;
    stage.choices = welcomeChoices;
    stage.helpHref = copy.helpHref;
    return null;
  },
}));
const requestSheetSelect = vi.hoisted(() => vi.fn());
vi.mock('@/lib/sheet-select-request', () => ({ requestSheetSelect }));
vi.mock('./tour-dom', () => ({
  findTour: () => null,
  clickTour: () => false,
  waitForSelector: async () => null,
  waitForTour: async () => null,
}));
const ctx = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/app/document/[id]/EditorContext', () => ({ useEditorContext: () => ctx.current }));

const planTour = {
  ensureBoard: vi.fn(() => 'board1'),
  ensureSheet: vi.fn(() => 'sheetEl1'),
  sheetElementId: () => 'sheetEl1',
  sheetId: () => 'sheet1',
  ensureCards: vi.fn(async () => true),
  moveFirstCard: vi.fn(async () => {}),
  removeAll: vi.fn(),
  boardId: () => 'board1',
  firstCardId: () => 'card1',
  status: () => 'todo~a',
};
const setUserPreferences = vi.fn();
const writeUserPreferences = vi.fn();

const editor = (over: Record<string, unknown> = {}) => {
  ctx.current = {
    hydrated: true,
    anyWelcomeOpen: false,
    isReadOnly: false,
    embedMode: false,
    editorMode: { mode: 'plan' },
    activeTab: { id: 'tab1', locked: false },
    userPreferences: {},
    setUserPreferences,
    writeUserPreferences,
    selfParticipant: { id: 'me' },
    getViewportCenter: () => ({ x: 0, y: 0 }),
    plan: { openItemId: null, showItem: vi.fn(), closeItem: vi.fn() },
    planTour,
    ...over,
  };
};
const offered = () => track.mock.calls.some((c) => c[1] === 'Opened' && c[2] === 'PlanTourOffer');

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
  setActiveTour('plan', false);
  clearTourPending();
});

describe('PlanTourHost offer', () => {
  it('offers itself after the settle delay when the person is in Plan', () => {
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
    ['seen', { userPreferences: { planTourSeen: true } }],
    ['read-only', { isReadOnly: true }],
    ['locked', { activeTab: { id: 'tab1', locked: true } }],
    ['not hydrated', { hydrated: false }],
    ['embedded', { embedMode: true }],
  ])('makes no offer when %s', (_why, over) => {
    editor(over);
    render(<PlanTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
  });

  it('waits for the welcome tour, then follows it', () => {
    setActiveTour('welcome', true);
    editor();
    render(<PlanTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
    act(() => setActiveTour('welcome', false));
    act(() => vi.advanceTimersByTime(800));
    expect(offered()).toBe(true);
  });

  it('waits while the welcome tour is still owed', () => {
    markTourPending();
    editor();
    render(<PlanTourHost />);
    act(() => vi.advanceTimersByTime(2000));
    expect(offered()).toBe(false);
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

describe('PlanTourHost end', () => {
  const start = () => {
    editor();
    const r = render(<PlanTourHost />);
    act(() => vi.advanceTimersByTime(800));
    return r;
  };

  it('declining marks it seen, sends the decline and makes nothing', () => {
    start();
    act(() => stage.engine!.skip());
    expect(writeUserPreferences).toHaveBeenCalledWith({ planTourSeen: true }, 'me');
    expect(track).toHaveBeenCalledWith('UI', 'Closed', 'PlanTourOffer');
    expect(planTour.ensureBoard).not.toHaveBeenCalled();
    expect(planTour.removeAll).toHaveBeenCalled();
  });

  it('starting, then skipping, takes the tour content away', async () => {
    start();
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'PlanTour');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(planTour.ensureBoard).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('UI', 'View', 'PlanTourStepBoard');
    act(() => stage.engine!.skip());
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'PlanTourSkipped');
    expect(planTour.removeAll).toHaveBeenCalled();
  });

  it('offers Boards and Spreadsheets on its welcome card', () => {
    start();
    expect(stage.choices.map((c) => c.label)).toEqual(['Boards', 'Spreadsheets']);
  });

  it('picking Spreadsheets runs the sheet track on the example sheet', async () => {
    start();
    act(() => stage.choices.find((c) => c.id === 'sheets')!.onPick());
    expect(track).toHaveBeenCalledWith('UI', 'Selected', 'PlanTourSheets');
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'PlanTour');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(planTour.ensureSheet).toHaveBeenCalled();
    expect(planTour.ensureBoard).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('UI', 'View', 'PlanTourStepSheet');
    expect(stage.helpHref).toBe('/help/canvas/plan-mode/sheets/');
    // Every anchored step finds no target in this harness; the formula step still selects the total.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(requestSheetSelect).toHaveBeenCalledWith('sheet1', { r: 5, c: 2 });
    expect(stage.engine?.step?.id).toBe('outro');
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'PlanTourCompleted');
  });

  it('picking Boards runs the board track', async () => {
    start();
    act(() => stage.choices.find((c) => c.id === 'boards')!.onPick());
    expect(track).toHaveBeenCalledWith('UI', 'Selected', 'PlanTourBoards');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(planTour.ensureBoard).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('UI', 'View', 'PlanTourStepBoard');
    expect(stage.helpHref).toBe('/help/canvas/plan-mode/');
  });

  it('ends as skipped when the person leaves Plan or the tab', () => {
    const r = start();
    editor({ activeTab: { id: 'tab2', locked: false } });
    r.rerender(<PlanTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'PlanTourSkipped');
    expect(stage.engine?.active).toBe(false);
  });

  it('completing it sends the completion', async () => {
    start();
    // Every anchored step finds no target in this harness and is skipped, so Next runs to the end.
    act(() => stage.engine!.next());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(stage.engine?.step?.id).toBe('outro');
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'PlanTourCompleted');
  });

  it('takes the tour content away when the editor goes', () => {
    const r = start();
    r.unmount();
    expect(planTour.removeAll).toHaveBeenCalled();
  });
});
