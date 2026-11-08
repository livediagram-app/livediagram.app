// @vitest-environment jsdom

// The Plan tour's way in (docs/specs/026-plan/plan-tour.md "Where it appears"): the footer's Start Tour button, once
// there is a board or Sheet on the open tab, until its tracks there are taken, naming the track it runs; a press there
// (or the Settings row) starts the Practice Sprint on that board, or Five Small Wins on a practice sheet, never beside
// another tour. It never starts on its own.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestPlanTourRelaunch } from '@/lib/plan-tour';
import { setActiveTour } from '@/lib/tour-active';
import {
  resetTourOffersForTests,
  tourOffer,
} from '@liveworkspace/workbench/components/tour/tour-offer';
import { PlanTourHost } from './PlanTourHost';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
type End = (e: { outcome: 'completed' | 'skipped' }) => void;
const stage = vi.hoisted(() => ({
  sprint: null as { boardId: string; onEnd: End } | null,
  sheet: null as { onEnd: End } | null,
}));
vi.mock('./PracticeSprint', () => ({
  PracticeSprint: (p: { boardId: string; onEnd: End }) => {
    stage.sprint = p;
    return null;
  },
}));
vi.mock('./PracticeSheetDialog', () => ({
  PracticeSheetDialog: (p: { onEnd: End }) => {
    stage.sheet = p;
    return null;
  },
}));
const ctx = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/app/project/[id]/EditorContext', () => ({
  useEditorContext: () => ctx.current,
  useOptionalEditorContext: () => ctx.current,
}));

const setUserPreferences = vi.fn();
const writeUserPreferences = vi.fn();

// The person's own board and Sheet: the offer waits for one (docs/specs/026-plan/plan-tour.md).
const BOARD = { id: 'b0', type: 'shape', shape: 'plan-board' };
const BOARD2 = { id: 'b1', type: 'shape', shape: 'plan-board' };
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
    ...over,
  };
};
const onTab = (...elements: unknown[]) => ({
  activeTab: { id: 'tab1', locked: false, elements },
});
const startedTour = () => track.mock.calls.some((c) => c[1] === 'Started' && c[2] === 'PlanTour');
const running = () => stage.sprint !== null || stage.sheet !== null;

beforeEach(() => {
  track.mockReset();
  stage.sprint = null;
  stage.sheet = null;
  document.body.innerHTML = '<div data-plan-board="b0"></div>';
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
    expect(startedTour()).toBe(false);
    expect(running()).toBe(false);
  });

  it('starts from the button', () => {
    editor();
    render(<PlanTourHost />);
    act(() => tourOffer()!.start());
    expect(startedTour()).toBe(true);
    expect(stage.sprint?.boardId).toBe('b0');
  });

  it('offers nothing on an empty tab, so a Settings rerun there places nothing', () => {
    editor(onTab());
    render(<PlanTourHost />);
    expect(tourOffer()).toBeNull();
    act(() => requestPlanTourRelaunch());
    expect(startedTour()).toBe(false);
    expect(running()).toBe(false);
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

  it('a board alone runs the Practice Sprint on that board', () => {
    start(BOARD);
    expect(stage.sprint?.boardId).toBe('b0');
    expect(stage.sheet).toBeNull();
  });

  it('runs on the board drawn over the canvas when the tab has two', () => {
    document.body.innerHTML =
      '<div data-plan-board="b0"></div><div data-canvas-cover><div data-plan-board="b1"></div></div>';
    start(BOARD, BOARD2);
    expect(stage.sprint?.boardId).toBe('b1');
  });

  it('a Sheet alone offers and runs Five Small Wins', () => {
    editor(onTab(SHEET));
    render(<PlanTourHost />);
    expect(tourOffer()?.name).toBe('Sheets');
    act(() => tourOffer()!.start());
    expect(stage.sheet).not.toBeNull();
    expect(stage.sprint).toBeNull();
  });

  it('a tab with both offers Boards first', () => {
    editor(onTab(BOARD, SHEET));
    render(<PlanTourHost />);
    expect(tourOffer()?.name).toBe('Boards');
  });

  it('does not start a second run while one is on screen', () => {
    start(BOARD);
    const calls = track.mock.calls.length;
    act(() => requestPlanTourRelaunch());
    expect(track.mock.calls.length).toBe(calls);
  });
});

describe('PlanTourHost end', () => {
  const start = () => {
    editor();
    const r = render(<PlanTourHost />);
    act(() => tourOffer()!.start());
    return r;
  };

  it('ending takes the track and ends as skipped', () => {
    start();
    const { onEnd } = stage.sprint!;
    stage.sprint = null;
    act(() => onEnd({ outcome: 'skipped' }));
    expect(writeUserPreferences).toHaveBeenCalledWith({ planTourTracks: ['boards'] }, 'me');
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'PlanTourSkipped');
    expect(stage.sprint).toBeNull();
  });

  it('a finish ends as completed, once even if it is called again', () => {
    start();
    const { onEnd } = stage.sprint!;
    act(() => onEnd({ outcome: 'completed' }));
    act(() => onEnd({ outcome: 'completed' }));
    const ends = track.mock.calls.filter((c) => c[1] === 'Ended');
    expect(ends).toEqual([['UI', 'Ended', 'PlanTourCompleted']]);
  });

  it('the practice sheet ends through the same path', () => {
    editor(onTab(SHEET));
    render(<PlanTourHost />);
    act(() => tourOffer()!.start());
    act(() => stage.sheet!.onEnd({ outcome: 'completed' }));
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'PlanTourCompleted');
    expect(writeUserPreferences).toHaveBeenLastCalledWith({ planTourTracks: ['sheets'] }, 'me');
  });

  it('ends as skipped when the person opens another tab', () => {
    const r = start();
    stage.sprint = null;
    editor({ activeTab: { id: 'tab2', locked: false, elements: [BOARD] } });
    r.rerender(<PlanTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'PlanTourSkipped');
    expect(stage.sprint).toBeNull();
  });

  it('ends as skipped when its board is deleted', () => {
    const r = start();
    stage.sprint = null;
    editor({ activeTab: { id: 'tab1', locked: false, elements: [SHEET] } });
    r.rerender(<PlanTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'PlanTourSkipped');
    expect(stage.sprint).toBeNull();
  });

  it('ends as skipped when edit rights go', () => {
    const r = start();
    editor({ isReadOnly: true });
    r.rerender(<PlanTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'PlanTourSkipped');
  });
});

// docs/specs/026-plan/plan-tour.md "Where it appears": the button names the track not yet taken first.
describe('PlanTourHost per track', () => {
  it('offers Sheets beside a board once Boards is taken', () => {
    editor({ ...onTab(BOARD, SHEET), userPreferences: { planTourTracks: ['boards'] } });
    render(<PlanTourHost />);
    expect(tourOffer()?.name).toBe('Sheets');
  });

  // Work Tracker #177: once every track with work on the tab is taken the Plan tour leaves the button, and a track's
  // Settings row (clearing it from the record) brings it back.
  it('leaves the button once every track on the tab is taken, and comes back when a row is on again', () => {
    editor({ userPreferences: { planTourTracks: ['boards', 'sheets', 'dashboards'] } });
    const { rerender } = render(<PlanTourHost />);
    expect(tourOffer()).toBeNull();
    editor({ userPreferences: { planTourTracks: ['sheets', 'dashboards'] } });
    rerender(<PlanTourHost />);
    expect(tourOffer()?.name).toBe('Boards');
  });

  it('takes a board and Sheet tab off the button only once both its tracks are taken', () => {
    editor({ ...onTab(BOARD, SHEET), userPreferences: { planTourTracks: ['boards', 'sheets'] } });
    render(<PlanTourHost />);
    expect(tourOffer()).toBeNull();
  });

  it('records the track taken as a press starts it', () => {
    editor();
    render(<PlanTourHost />);
    act(() => tourOffer()!.start());
    expect(writeUserPreferences).toHaveBeenCalledTimes(1);
    expect(writeUserPreferences).toHaveBeenCalledWith({ planTourTracks: ['boards'] }, 'me');
  });
});
