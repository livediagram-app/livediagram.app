// @vitest-environment jsdom

// Watch It Built's way in (docs/specs/007-editor/watch-it-built.md "Where it appears"): the footer's Start Tour button
// offers it in Diagram until it is taken; a press (or the Settings rerun) counts the start, marks it taken and mounts
// the player, never beside another tour, and it never starts on its own.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestTourRelaunch } from '@/lib/diagram-tour';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { setStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import {
  resetTourOffersForTests,
  tourOffer,
} from '@liveworkspace/workbench/components/tour/tour-offer';
import { WatchItBuiltHost } from './WatchItBuiltHost';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const player = vi.hoisted(() => ({ onEnded: null as (() => void) | null }));
vi.mock('next/dynamic', () => ({
  default: () =>
    function Player({ onEnded }: { onEnded: () => void }) {
      player.onEnded = onEnded;
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
    ...over,
  };
};
const probe: { shownTour: string | null } = { shownTour: null };
const record = (shown: string | null) => {
  probe.shownTour = shown;
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
  player.onEnded = null;
  setActiveTour('welcome', false);
  setActiveTour('draw', false);
  setStartPanelOpen(false);
  resetTourOffersForTests();
});

describe('WatchItBuiltHost', () => {
  it('offers "Watch It Built" in Diagram and never starts on its own', () => {
    editor();
    const r = mount();
    expect(tourOffer()).toMatchObject({ name: 'Diagram', label: 'Watch It Built' });
    expect(r.queryByTestId('player')).toBeNull();
  });

  it.each([
    ['read-only', { isReadOnly: true }],
    ['locked', { activeTab: { id: 'tab1', locked: true } }],
    ['not hydrated', { hydrated: false }],
    ['embedded', { embedMode: true }],
    ['welcomed', { anyWelcomeOpen: true }],
    ['in Draw', { editorMode: { mode: 'draw' } }],
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

  it('on a press counts the start, marks it taken and mounts the player until it ends', () => {
    editor();
    const r = mount();
    act(() => tourOffer()!.start());
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'Tour');
    expect(writeUserPreferences).toHaveBeenCalledWith({ tourSeen: true }, 'me');
    expect(r.getByTestId('player')).toBeTruthy();
    expect(probe.shownTour).toBe('welcome');
    act(() => player.onEnded!());
    expect(r.queryByTestId('player')).toBeNull();
    expect(probe.shownTour).toBeNull();
  });

  it('leaves the button once taken, and its Settings rerun plays it without writing the record again', () => {
    editor({ userPreferences: { tourSeen: true } });
    const r = mount();
    expect(tourOffer()).toBeNull();
    act(() => requestTourRelaunch());
    expect(r.getByTestId('player')).toBeTruthy();
    expect(writeUserPreferences).not.toHaveBeenCalled();
  });

  it('starts from the Settings rerun when it can, and not beside another tour', () => {
    editor();
    const r = mount();
    act(() => setActiveTour('draw', true));
    act(() => tourOffer()?.start());
    act(() => requestTourRelaunch());
    expect(r.queryByTestId('player')).toBeNull();
    act(() => setActiveTour('draw', false));
    act(() => requestTourRelaunch());
    expect(r.getByTestId('player')).toBeTruthy();
  });
});
