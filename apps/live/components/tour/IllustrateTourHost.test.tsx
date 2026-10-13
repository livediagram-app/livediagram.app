// @vitest-environment jsdom

// The Illustrate tour's offer (docs/specs/007-editor/illustrate-tour.md "Where it appears"): on entering Illustrate,
// once per page kind, on its own (the Diagram tour never runs in Illustrate), never with another tour, and rerun from
// Settings. The tour page's kind picks the track.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestIllustrateTourRelaunch } from '@/lib/illustrate-tour';
import { setActiveTour } from '@/lib/tour-active';
import { setStartPanelOpen } from '@/components/start/start-panel-open';
import { clearTourPending, markTourPending } from '@/lib/tour-pending';
import type { TourEngine } from './useTourEngine';
import type { PageTourApi } from './page-tour-api';
import type { TourPage } from './illustrate-tour-page';
// Loaded at the offer: imported here so the fake timers never wait on the module loader.
import './page-tour-steps';
import { IllustrateTourHost } from './IllustrateTourHost';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const stage = vi.hoisted(() => ({
  engine: null as TourEngine<PageTourApi> | null,
  helpHref: '' as string | undefined,
  eyebrow: '' as string | undefined,
}));
vi.mock('./TourStage', () => ({
  TourStage: ({
    engine,
    copy,
  }: {
    engine: TourEngine<PageTourApi>;
    copy: { helpHref?: string; welcomeEyebrow?: string };
  }) => {
    stage.engine = engine;
    stage.helpHref = copy.helpHref;
    stage.eyebrow = copy.welcomeEyebrow;
    return null;
  },
}));
// What is on screen, by a part of each selector: everything, less what a test hides.
const dom = vi.hoisted(() => ({ hidden: [] as string[], page: null as TourPage | null }));
vi.mock('./tour-dom', () => ({
  findTour: () => null,
  clickTour: () => false,
  isOnScreen: (selector: string) => !dom.hidden.some((part) => selector.includes(part)),
  waitForSelector: async () => null,
  waitForTour: async () => null,
}));
// The page on screen the tour would run on, of the kinds still unseen.
vi.mock('./illustrate-tour-page', () => ({
  pickTourPage: (unseen: (kind: string) => boolean) =>
    dom.page && unseen(dom.page.kind) ? dom.page : null,
}));
const ctx = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/app/document/[id]/EditorContext', () => ({ useEditorContext: () => ctx.current }));

const setUserPreferences = vi.fn();
const writeUserPreferences = vi.fn();

const editor = (over: Record<string, unknown> = {}) => {
  ctx.current = {
    hydrated: true,
    anyWelcomeOpen: false,
    isReadOnly: false,
    embedMode: false,
    editorMode: { mode: 'illustrate' },
    activeTab: { id: 'tab1', locked: false, pages: [{ id: 'p1', kind: 'slide' }] },
    userPreferences: { tourSeen: true },
    setUserPreferences,
    writeUserPreferences,
    selfParticipant: { id: 'me' },
    prefsSettled: true,
    ...over,
  };
};
// Past the settle delay, and the steps' load behind it.
const wait = (ms: number) => act(async () => vi.advanceTimersByTimeAsync(ms));
const offered = () =>
  track.mock.calls.some((c) => c[1] === 'Opened' && c[2] === 'IllustrateTourOffer');

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  track.mockReset();
  dom.hidden = [];
  dom.page = { pageId: 'p1', kind: 'slide' };
  // The + after the last page, read from the document for where the Add step points.
  const plus = document.createElement('button');
  plus.dataset.tourId = 'add-page';
  document.body.append(plus);
  stage.engine = null;
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.clearAllMocks();
  vi.useRealTimers();
  setActiveTour('welcome', false);
  setActiveTour('plan', false);
  setActiveTour('facilitate', false);
  setActiveTour('draw', false);
  setActiveTour('illustrate', false);
  setStartPanelOpen(false);
  clearTourPending();
});

describe('IllustrateTourHost offer', () => {
  it('offers itself after the settle delay when the person is in Illustrate', async () => {
    editor();
    render(<IllustrateTourHost />);
    act(() => vi.advanceTimersByTime(799));
    expect(offered()).toBe(false);
    await wait(1);
    expect(offered()).toBe(true);
    expect(stage.engine?.active).toBe(true);
    expect(stage.engine?.step?.title).toBe('Getting started with slides?');
    expect(stage.helpHref).toBe('/help/canvas/illustrate/slide-pages/');
  });

  it('waits for the person to enter Illustrate', async () => {
    editor({ editorMode: { mode: 'diagram' } });
    const { rerender } = render(<IllustrateTourHost />);
    await wait(2000);
    expect(offered()).toBe(false);
    editor();
    rerender(<IllustrateTourHost />);
    await wait(800);
    expect(offered()).toBe(true);
  });

  it.each([
    [
      'seen',
      {
        userPreferences: {
          tourSeen: true,
          illustrateTourKinds: ['slide', 'infographic', 'article', 'logo'],
        },
      },
    ],
    ['read-only', { isReadOnly: true }],
    ['locked', { activeTab: { id: 'tab1', locked: true } }],
    ['not hydrated', { hydrated: false }],
    ['embedded', { embedMode: true }],
    ['in Draw', { editorMode: { mode: 'draw' } }],
    ['before the synced preferences are in', { prefsSettled: false }],
  ])('makes no offer when %s', async (_why, over) => {
    editor(over);
    render(<IllustrateTourHost />);
    await wait(2000);
    expect(offered()).toBe(false);
  });

  // docs/specs/007-editor/illustrate-tour.md "Where it appears": on its own, whatever other tours.
  it('offers itself to someone who has not done the Diagram tour, even with its handoff owed', async () => {
    markTourPending();
    editor({ userPreferences: {} });
    render(<IllustrateTourHost />);
    await wait(800);
    expect(offered()).toBe(true);
    expect(stage.engine?.hasWelcome).toBe(true);
  });

  it('waits while the Diagram tour is on screen, then follows it', async () => {
    setActiveTour('welcome', true);
    editor();
    render(<IllustrateTourHost />);
    await wait(2000);
    expect(offered()).toBe(false);
    act(() => setActiveTour('welcome', false));
    await wait(800);
    expect(offered()).toBe(true);
  });

  it('never runs beside the Draw tour', async () => {
    setActiveTour('draw', true);
    editor();
    render(<IllustrateTourHost />);
    await wait(2000);
    expect(offered()).toBe(false);
  });

  it('reruns from Settings in Illustrate', async () => {
    editor({
      userPreferences: {
        tourSeen: true,
        illustrateTourKinds: ['slide', 'infographic', 'article', 'logo'],
      },
    });
    const { rerender } = render(<IllustrateTourHost />);
    await wait(2000);
    expect(offered()).toBe(false);
    editor();
    rerender(<IllustrateTourHost />);
    act(() => requestIllustrateTourRelaunch());
    await wait(800);
    expect(offered()).toBe(true);
  });

  it('ignores a rerun outside Illustrate', async () => {
    editor({ editorMode: { mode: 'diagram' } });
    render(<IllustrateTourHost />);
    act(() => requestIllustrateTourRelaunch());
    await wait(2000);
    expect(offered()).toBe(false);
  });
});

describe('IllustrateTourHost end', () => {
  const start = async (over: Record<string, unknown> = {}) => {
    editor(over);
    const r = render(<IllustrateTourHost />);
    await wait(800);
    return r;
  };

  it('declining marks its kind seen and sends the decline', async () => {
    await start();
    act(() => stage.engine!.skip());
    expect(writeUserPreferences).toHaveBeenCalledWith(
      { tourSeen: true, illustrateTourKinds: ['slide'] },
      'me',
    );
    expect(track).toHaveBeenCalledWith('UI', 'Closed', 'IllustrateTourOffer');
  });

  it('starting runs the steps, naming the track in each view, and completing sends the completion', async () => {
    await start();
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'IllustrateTour');
    // Every anchored step finds no target in this harness and is skipped, so Next runs to the end.
    await wait(30000);
    expect(track).toHaveBeenCalledWith('UI', 'View', 'IllustrateTourStepSlideLayouts');
    expect(stage.engine?.step?.id).toBe('outro');
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'IllustrateTourCompleted');
    expect(writeUserPreferences).toHaveBeenCalledWith(
      { tourSeen: true, illustrateTourKinds: ['slide'] },
      'me',
    );
  });

  it('adds the last kind answered to the list', async () => {
    await start({
      userPreferences: { illustrateTourKinds: ['infographic', 'article', 'logo'] },
    });
    act(() => stage.engine!.skip());
    expect(writeUserPreferences).toHaveBeenCalledWith(
      { illustrateTourKinds: ['infographic', 'article', 'logo', 'slide'] },
      'me',
    );
  });

  it('offers again to someone who answered the single tour before it split', async () => {
    await start({ userPreferences: { tourSeen: true, illustrateTourSeen: true } });
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'IllustrateTourOffer');
  });

  it('names the page kind on its welcome card, never the mode', async () => {
    await start();
    expect(stage.eyebrow).toBe('Slides tour');
  });

  it('runs the track of the tour page’s kind', async () => {
    dom.page = { pageId: 'p2', kind: 'article' };
    await start({
      activeTab: { id: 'tab1', locked: false, pages: [{ id: 'p2', kind: 'article', flow: 'f' }] },
    });
    expect(stage.engine?.step?.title).toBe('Getting started with articles?');
    expect(stage.helpHref).toBe('/help/canvas/illustrate/articles/');
    expect(stage.engine!.countableSteps).toBe(4);
  });

  it('counts the slide’s steps on screen', async () => {
    await start();
    expect(stage.engine!.countableSteps).toBe(5);
  });

  it('leaves out a step whose control is not on screen', async () => {
    dom.hidden = ['data-tour-id="slides"'];
    await start();
    expect(stage.engine!.countableSteps).toBe(4);
  });

  // docs/specs/007-editor/start-diagramming.md "The tours wait".
  it('waits while a start panel is on screen', async () => {
    act(() => setStartPanelOpen(true));
    editor();
    render(<IllustrateTourHost />);
    await wait(2000);
    expect(offered()).toBe(false);
    act(() => setStartPanelOpen(false));
    await wait(800);
    expect(offered()).toBe(true);
  });

  it('ends as skipped when the person leaves Illustrate or the tab', async () => {
    const r = await start();
    act(() => stage.engine!.next());
    editor({ editorMode: { mode: 'diagram' } });
    r.rerender(<IllustrateTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'IllustrateTourSkipped');
    expect(stage.engine?.active).toBe(false);
  });

  it('ends as skipped when its page goes', async () => {
    const r = await start();
    act(() => stage.engine!.next());
    editor({ activeTab: { id: 'tab1', locked: false, pages: [] } });
    r.rerender(<IllustrateTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'IllustrateTourSkipped');
  });
});

describe('IllustrateTourHost per kind', () => {
  it('offers nothing while every kind on the tab is seen', async () => {
    editor({ userPreferences: { illustrateTourKinds: ['slide'] } });
    render(<IllustrateTourHost />);
    await wait(2000);
    expect(offered()).toBe(false);
  });

  it('offers a new kind’s track when a page of it arrives', async () => {
    editor({ userPreferences: { illustrateTourKinds: ['slide'] } });
    const { rerender } = render(<IllustrateTourHost />);
    await wait(2000);
    expect(offered()).toBe(false);
    dom.page = { pageId: 'p2', kind: 'logo' };
    editor({
      userPreferences: { illustrateTourKinds: ['slide'] },
      activeTab: {
        id: 'tab1',
        locked: false,
        pages: [
          { id: 'p1', kind: 'slide' },
          { id: 'p2', kind: 'logo' },
        ],
      },
    });
    rerender(<IllustrateTourHost />);
    await wait(800);
    expect(offered()).toBe(true);
    expect(stage.engine?.step?.title).toBe('Getting started with logos?');
  });

  it('waits out the first page’s kind choice', async () => {
    const choice = document.createElement('div');
    choice.setAttribute('data-first-page-choice', '');
    document.body.append(choice);
    try {
      editor({ activeTab: { id: 'tab1', locked: false, pages: [{ id: 'p1' }] } });
      render(<IllustrateTourHost />);
      await wait(2000);
      expect(offered()).toBe(false);
    } finally {
      choice.remove();
    }
  });
});
