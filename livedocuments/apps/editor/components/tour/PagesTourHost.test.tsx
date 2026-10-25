// @vitest-environment jsdom

// The Pages tour's way in (docs/specs/007-editor/pages-tour.md "Where it appears"): the footer's Start Tour button
// offers it in Pages, taken or not; a press there (or the Settings row) starts it on the page on screen, never beside
// another tour, and it never starts on its own. The tour page's kind picks the track.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestPagesTourRelaunch } from '@/lib/pages-tour';
import { setActiveTour } from '@/lib/tour-active';
import { setStartPanelOpen } from '@/components/start/start-panel-open';
import {
  resetTourOffersForTests,
  tourOffer,
} from '@liveworkspace/workbench/components/tour/tour-offer';
import type { TourEngine } from '@liveworkspace/workbench/components/tour/useTourEngine';
import type { PageTourApi } from './page-tour-api';
import type { TourPage } from './pages-tour-page';
// Loaded at the press: imported here so the fake timers never wait on the module loader.
import './page-tour-steps';
import { PagesTourHost } from './PagesTourHost';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const stage = vi.hoisted(() => ({
  engine: null as TourEngine<PageTourApi> | null,
  helpHref: '' as string | undefined,
  ariaPrefix: '' as string | undefined,
}));
vi.mock('./TourStage', () => ({
  TourStage: ({
    engine,
    copy,
    ariaPrefix,
  }: {
    engine: TourEngine<PageTourApi>;
    copy: { helpHref?: string };
    ariaPrefix?: string;
  }) => {
    stage.engine = engine;
    stage.helpHref = copy.helpHref;
    stage.ariaPrefix = ariaPrefix;
    return null;
  },
}));
// What is on screen, by a part of each selector: everything, less what a test hides.
const dom = vi.hoisted(() => ({ hidden: [] as string[], page: null as TourPage | null }));
vi.mock('@liveworkspace/workbench/components/tour/tour-dom', () => ({
  findTour: () => null,
  clickTour: () => false,
  isOnScreen: (selector: string) => !dom.hidden.some((part) => selector.includes(part)),
  waitForSelector: async () => null,
  waitForTour: async () => null,
}));
// The page on screen the tour would run on, of the kinds still unseen.
vi.mock('./pages-tour-page', () => ({
  pickTourPage: (unseen: (kind: string) => boolean) =>
    dom.page && unseen(dom.page.kind) ? dom.page : null,
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
    editorMode: { mode: 'pages' },
    activeTab: {
      id: 'tab1',
      locked: false,
      pages: [{ id: 'p1', orientation: 'landscape', kind: 'slide' }],
    },
    userPreferences: {},
    setUserPreferences,
    writeUserPreferences,
    // The demonstration elements a tour places (useTourSquare).
    tourSquare: { place: vi.fn(), remove: vi.fn(() => []) },
    selfParticipant: { id: 'me' },
    prefsSettled: true,
    ...over,
  };
};
const startedTour = () => track.mock.calls.some((c) => c[1] === 'Started' && c[2] === 'PagesTour');
// A press on the footer button, and the track's steps loading behind it.
const press = async () => {
  act(() => tourOffer()!.start());
  await act(async () => vi.advanceTimersByTimeAsync(0));
};

beforeEach(() => {
  vi.useFakeTimers();
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
  setActiveTour('element', false);
  setActiveTour('pages', false);
  setStartPanelOpen(false);
  resetTourOffersForTests();
});

describe('PagesTourHost offer', () => {
  it('offers "Pages" on the footer button in Pages, and never starts on its own', async () => {
    editor();
    render(<PagesTourHost />);
    expect(tourOffer()?.name).toBe('Pages');
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(startedTour()).toBe(false);
    expect(stage.engine?.active).toBe(false);
  });

  it('starts from the button on the page on screen, linking to its track’s article', async () => {
    editor();
    render(<PagesTourHost />);
    await press();
    expect(startedTour()).toBe(true);
    expect(stage.engine?.active).toBe(true);
    expect(stage.helpHref).toBe('/help/pages/slide-pages/');
  });

  it('stays on offer once every kind is taken, so it can be taken again', async () => {
    editor({ userPreferences: { pagesTourKinds: ['slide', 'infographic', 'article'] } });
    render(<PagesTourHost />);
    expect(tourOffer()?.name).toBe('Pages');
    await press();
    expect(startedTour()).toBe(true);
  });

  it.each([
    ['read-only', { isReadOnly: true }],
    ['locked', { activeTab: { id: 'tab1', locked: true } }],
    ['not hydrated', { hydrated: false }],
    ['embedded', { embedMode: true }],
    ['in Draw', { editorMode: { mode: 'draw' } }],
    [
      'the first page’s kind is still unchosen',
      { activeTab: { id: 'tab1', locked: false, pages: [{ id: 'p1', orientation: 'landscape' }] } },
    ],
  ])('offers nothing when %s', (_why, over) => {
    editor(over);
    render(<PagesTourHost />);
    expect(tourOffer()).toBeNull();
  });

  // docs/specs/007-editor/start-diagramming.md "The tours wait".
  it('offers nothing while a start panel is on screen', () => {
    act(() => setStartPanelOpen(true));
    editor();
    render(<PagesTourHost />);
    expect(tourOffer()).toBeNull();
    act(() => setStartPanelOpen(false));
    expect(tourOffer()?.name).toBe('Pages');
  });

  it('starts nothing while an element tour is on screen', async () => {
    setActiveTour('element', true);
    editor();
    render(<PagesTourHost />);
    await press();
    expect(startedTour()).toBe(false);
  });

  it('starts nothing with no page on screen', async () => {
    dom.page = null;
    editor();
    render(<PagesTourHost />);
    await press();
    expect(startedTour()).toBe(false);
  });

  it('reruns from Settings in Pages', async () => {
    editor({ userPreferences: { pagesTourKinds: ['slide', 'infographic', 'article'] } });
    render(<PagesTourHost />);
    act(() => requestPagesTourRelaunch());
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(startedTour()).toBe(true);
  });

  it('ignores a rerun outside Pages', async () => {
    editor({ editorMode: { mode: 'diagram' } });
    render(<PagesTourHost />);
    act(() => requestPagesTourRelaunch());
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(startedTour()).toBe(false);
  });

  it('reads the stored pages as the canvas does, skipping a malformed entry rather than throwing', () => {
    editor({
      activeTab: {
        id: 'tab1',
        locked: false,
        pages: [null, 5, { id: 'p1', orientation: 'landscape', kind: 'slide' }],
      },
    });
    expect(() => render(<PagesTourHost />)).not.toThrow();
    expect(tourOffer()?.name).toBe('Pages');
  });
});

describe('PagesTourHost end', () => {
  const start = async (over: Record<string, unknown> = {}) => {
    editor(over);
    const r = render(<PagesTourHost />);
    await press();
    return r;
  };

  it('skipping marks its kind seen and sends the skip', async () => {
    await start();
    act(() => stage.engine!.skip());
    expect(writeUserPreferences).toHaveBeenCalledWith({ pagesTourKinds: ['slide'] }, 'me');
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'PagesTourSkipped');
  });

  it('runs the steps, naming the track in each view, and completing sends the completion', async () => {
    await start();
    // Every anchored step finds no target in this harness and is skipped, so it runs to the end.
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(track).toHaveBeenCalledWith('UI', 'View', 'PagesTourStepSlideLayouts');
    expect(stage.engine?.step?.id).toBe('outro');
    act(() => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'PagesTourCompleted');
    expect(writeUserPreferences).toHaveBeenCalledWith({ pagesTourKinds: ['slide'] }, 'me');
  });

  it('names the page kind on its cards, never the mode', async () => {
    await start();
    expect(stage.ariaPrefix).toBe('Slides tour');
  });

  it('runs the track of the tour page’s kind', async () => {
    dom.page = { pageId: 'p2', kind: 'article' };
    await start({
      activeTab: {
        id: 'tab1',
        locked: false,
        pages: [{ id: 'p2', orientation: 'portrait', kind: 'article', flow: 'f' }],
      },
    });
    expect(stage.helpHref).toBe('/help/pages/articles/');
  });

  it('counts the page’s steps on screen', async () => {
    await start();
    expect(stage.engine!.countableSteps).toBe(7);
  });

  it('leaves out a step whose control is not on screen', async () => {
    dom.hidden = ['data-tour-id="slides"'];
    await start();
    expect(stage.engine!.countableSteps).toBe(3);
  });

  it('ends as skipped when the person leaves Pages or the tab', async () => {
    const r = await start();
    editor({ editorMode: { mode: 'diagram' } });
    r.rerender(<PagesTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'PagesTourSkipped');
    expect(stage.engine?.active).toBe(false);
  });

  it('ends as skipped when its page goes', async () => {
    const r = await start();
    editor({ activeTab: { id: 'tab1', locked: false, pages: [] } });
    r.rerender(<PagesTourHost />);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'PagesTourSkipped');
  });
});
