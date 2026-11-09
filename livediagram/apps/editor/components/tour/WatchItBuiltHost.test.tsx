// @vitest-environment jsdom

// Watch It Built's way in (docs/specs/007-editor/watch-it-built.md "Where it appears", "The start panel"): the footer's
// Start Tour button offers it in Diagram, Draw and Workshop while the mode has a topic not yet taken; a press (or the
// Settings rerun for that mode) opens the start panel, a pick counts the start, marks that topic taken and plays it,
// More Topics comes back to the panel, never beside another tour, and it never starts on its own.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestWatchRelaunch } from '@/lib/watch-relaunch';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { setStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import {
  resetTourOffersForTests,
  tourOffer,
} from '@liveworkspace/workbench/components/tour/tour-offer';
import type { ReplayEnd } from './WatchItBuiltPlayer';
import { WatchItBuiltHost } from './WatchItBuiltHost';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/lib/replay/curriculum', () => {
  const card = (id: string, mode: string, telemetry: string) => ({
    id,
    mode,
    title: telemetry,
    line: `${telemetry} line`,
    telemetry,
    seconds: 25,
  });
  const CURRICULUM = {
    diagram: [card('diagram-basics', 'diagram', 'Basics'), card('look', 'diagram', 'Look')],
    draw: [card('sketch', 'draw', 'Sketch')],
    workshop: [],
  };
  const all = [...CURRICULUM.diagram, ...CURRICULUM.draw];
  return {
    CURRICULUM,
    ALL_TOPIC_CARDS: all,
    topicCard: (id: string) => all.find((c) => c.id === id),
  };
});
type PanelProps = {
  topics: { id: string; taken: boolean; meta?: string }[];
  onPick: (id: string) => void;
  onClose: () => void;
};
type PlayerProps = { card: { id: string }; hasMore: boolean; onEnded: (how: ReplayEnd) => void };
const shown = vi.hoisted(() => ({
  panel: null as PanelProps | null,
  player: null as PlayerProps | null,
}));
vi.mock('next/dynamic', () => ({
  default: () =>
    function Lazy(props: PanelProps | PlayerProps) {
      if ('onPick' in props) {
        shown.panel = props;
        return <div data-testid="panel" />;
      }
      shown.player = props;
      return <div data-testid="player" />;
    },
}));
const ctx = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/app/document/[id]/EditorContext', () => ({
  useEditorContext: () => ctx.current,
  useOptionalEditorContext: () => ctx.current,
}));

const writeUserPreferences = vi.fn();
const editor = (over: Record<string, unknown> = {}) => {
  ctx.current = {
    hydrated: true,
    anyWelcomeOpen: false,
    isReadOnly: false,
    embedMode: false,
    editorMode: { mode: 'diagram' },
    activeTab: { id: 'tab1' },
    userPreferences: {},
    setUserPreferences: vi.fn(),
    writeUserPreferences,
    selfParticipant: { id: 'me' },
    canvasMainRef: { current: null },
    ...over,
  };
};
const probe: { shownTour: string | null } = { shownTour: null };
const record = (tour: string | null) => {
  probe.shownTour = tour;
};
function ActiveProbe({ onRender }: { onRender: typeof record }) {
  onRender(useActiveTour());
  return null;
}
const mount = () =>
  render(
    <>
      <WatchItBuiltHost />
      <ActiveProbe onRender={record} />
    </>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  shown.panel = null;
  shown.player = null;
  setActiveTour('welcome', false);
  setActiveTour('show-me', false);
  setStartPanelOpen(false);
  resetTourOffersForTests();
});

describe('WatchItBuiltHost', () => {
  it('offers "Watch It Built" in Diagram and never starts on its own', () => {
    editor();
    const r = mount();
    expect(tourOffer()).toMatchObject({ name: 'Diagram', label: 'Watch It Built' });
    expect(r.queryByTestId('panel')).toBeNull();
    expect(r.queryByTestId('player')).toBeNull();
  });

  it('offers it in Draw too, by that name', () => {
    editor({ editorMode: { mode: 'draw' } });
    mount();
    expect(tourOffer()).toMatchObject({ name: 'Draw', label: 'Watch It Built' });
  });

  it.each([
    ['read-only', { isReadOnly: true }],
    ['locked', { activeTab: { id: 'tab1', locked: true } }],
    ['not hydrated', { hydrated: false }],
    ['embedded', { embedMode: true }],
    ['welcomed', { anyWelcomeOpen: true }],
    ['in a mode with no topics', { editorMode: { mode: 'workshop' } }],
    ['in a mode it does not teach', { editorMode: { mode: 'slides' } }],
  ])('offers nothing when %s', (_why, over) => {
    editor(over);
    mount();
    expect(tourOffer()).toBeNull();
  });

  it('offers nothing while a start panel is open', () => {
    editor();
    setStartPanelOpen(true);
    mount();
    expect(tourOffer()).toBeNull();
  });

  it('opens the start panel on a press, with the mode topics and which are taken; Not Now records nothing', () => {
    editor({ userPreferences: { tourSeen: true } });
    const r = mount();
    act(() => tourOffer()!.start());
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'WatchStart');
    expect(r.getByTestId('panel')).toBeTruthy();
    expect(shown.panel!.topics).toEqual([
      expect.objectContaining({ id: 'diagram-basics', taken: true, meta: '25 s' }),
      expect.objectContaining({ id: 'look', taken: false }),
    ]);
    expect(probe.shownTour).toBe('welcome');
    act(() => shown.panel!.onClose());
    expect(r.queryByTestId('panel')).toBeNull();
    expect(writeUserPreferences).not.toHaveBeenCalled();
    expect(probe.shownTour).toBeNull();
  });

  it('on a pick counts the start, marks the topic taken and plays it until it ends', () => {
    editor();
    const r = mount();
    act(() => tourOffer()!.start());
    act(() => shown.panel!.onPick('look'));
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'Tour');
    expect(track).toHaveBeenCalledWith('UI', 'View', 'WatchTopicLook');
    expect(writeUserPreferences).toHaveBeenCalledWith({ watchTopics: ['look'] }, 'me');
    expect(r.getByTestId('player')).toBeTruthy();
    expect(shown.player).toMatchObject({ card: { id: 'look' }, hasMore: true });
    act(() => shown.player!.onEnded('completed'));
    expect(r.queryByTestId('player')).toBeNull();
    expect(r.queryByTestId('panel')).toBeNull();
    expect(probe.shownTour).toBeNull();
  });

  it('comes back to the start panel on More Topics', () => {
    editor();
    const r = mount();
    act(() => tourOffer()!.start());
    act(() => shown.panel!.onPick('diagram-basics'));
    act(() => shown.player!.onEnded('more'));
    expect(r.getByTestId('panel')).toBeTruthy();
    expect(r.queryByTestId('player')).toBeNull();
  });

  it('plays a taken topic again without writing the record', () => {
    editor({ userPreferences: { watchTopics: ['look'] } });
    mount();
    act(() => tourOffer()!.start());
    act(() => shown.panel!.onPick('look'));
    expect(writeUserPreferences).not.toHaveBeenCalled();
    expect(shown.player).toMatchObject({ card: { id: 'look' } });
  });

  it('leaves the button once every topic is taken; the Settings rerun for its mode opens the panel', () => {
    editor({ userPreferences: { tourSeen: true, watchTopics: ['look'] } });
    const r = mount();
    expect(tourOffer()).toBeNull();
    act(() => requestWatchRelaunch('draw'));
    expect(r.queryByTestId('panel')).toBeNull();
    act(() => requestWatchRelaunch('diagram'));
    expect(r.getByTestId('panel')).toBeTruthy();
  });

  it('opens nothing beside another tour', () => {
    editor();
    const r = mount();
    act(() => setActiveTour('show-me', true));
    act(() => tourOffer()?.start());
    act(() => requestWatchRelaunch('diagram'));
    expect(r.queryByTestId('panel')).toBeNull();
    act(() => setActiveTour('show-me', false));
    act(() => requestWatchRelaunch('diagram'));
    expect(r.getByTestId('panel')).toBeTruthy();
  });

  it('closes the panel when the mode changes under it', () => {
    editor();
    const r = mount();
    act(() => tourOffer()!.start());
    editor({ editorMode: { mode: 'draw' } });
    r.rerender(
      <>
        <WatchItBuiltHost />
        <ActiveProbe onRender={record} />
      </>,
    );
    expect(r.queryByTestId('panel')).toBeNull();
  });
});
