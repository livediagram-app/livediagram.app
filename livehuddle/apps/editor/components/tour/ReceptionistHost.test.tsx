// @vitest-environment jsdom

// The Receptionist's side that knows the person (docs/specs/008-canvas/receptionist.md "The welcome", "Asking the Receptionist", "Share
// roles"): the footer's Ask Receptionist while he is here, the welcome on his first greeting and a hello after, the topics
// heard kept, and the Settings rerun.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestAvatarTourRelaunch } from '@/lib/avatar-tour';
import {
  getReceptionistState,
  noteReceptionistGreetedYou,
  resetReceptionistState,
  setReceptionistHere,
  showReceptionistTopic,
} from '@/lib/receptionist/receptionist-store';
import { setStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import {
  resetTourOffersForTests,
  TOUR_OFFER_RANK,
  tourOffer,
} from '@liveworkspace/workbench/components/tour/tour-offer';
import { ReceptionistHost } from './ReceptionistHost';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
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
    embedMode: false,
    can: { takePart: true, addContent: true },
    userPreferences: {},
    setUserPreferences,
    writeUserPreferences,
    selfParticipant: { id: 'me' },
    ...over,
  };
};
const lastWrite = () => writeUserPreferences.mock.calls.at(-1)?.[0] as Record<string, unknown>;

beforeEach(() => {
  vi.useFakeTimers();
  track.mockReset();
  resetReceptionistState();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  setStartPanelOpen(false);
  resetTourOffersForTests();
  resetReceptionistState();
});

describe('ReceptionistHost', () => {
  it('offers Ask Receptionist only while he is here, and asks him over', () => {
    editor();
    render(<ReceptionistHost />);
    expect(tourOffer()).toBeNull();
    act(() => setReceptionistHere(true));
    const offer = tourOffer()!;
    expect(offer).toMatchObject({
      name: 'Receptionist',
      label: 'Ask Receptionist',
      rank: TOUR_OFFER_RANK.tool,
    });
    act(() => offer.start());
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'AskReceptionist');
    expect(getReceptionistState()).toMatchObject({ asks: 1, chat: { open: true, reason: 'ask' } });
  });

  it('offers nothing in an embed, over a start, or before the editor is ready', () => {
    for (const over of [{ embedMode: true }, { anyWelcomeOpen: true }, { hydrated: false }]) {
      editor(over);
      const { unmount } = render(<ReceptionistHost />);
      act(() => setReceptionistHere(true));
      expect(tourOffer()).toBeNull();
      unmount();
    }
    editor();
    setStartPanelOpen(true);
    render(<ReceptionistHost />);
    act(() => setReceptionistHere(true));
    expect(tourOffer()).toBeNull();
  });

  it('gives the welcome on his first greeting, recorded as seen, then a hello that asks what they want', () => {
    editor();
    const { rerender } = render(<ReceptionistHost />);
    act(() => noteReceptionistGreetedYou());
    expect(getReceptionistState().chat).toMatchObject({ open: true, reason: 'welcome' });
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'ReceptionistWelcome');
    expect(lastWrite()).toMatchObject({ avatarTourSeen: true });
    expect(writeUserPreferences.mock.calls.at(-1)?.[1]).toBe('me');

    editor({ userPreferences: { avatarTourSeen: true } });
    rerender(<ReceptionistHost />);
    act(() => noteReceptionistGreetedYou());
    expect(getReceptionistState().chat).toMatchObject({ open: true, reason: 'back' });
    // It waits for a choice or I'll Explore rather than closing itself.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(getReceptionistState().chat.open).toBe(true);
  });

  it('opens the welcome for a greeting that came before it loaded', () => {
    noteReceptionistGreetedYou();
    editor();
    render(<ReceptionistHost />);
    expect(getReceptionistState().chat).toMatchObject({ open: true, reason: 'welcome' });
  });

  it('keeps each topic heard, once', () => {
    editor({ userPreferences: { receptionistTopicsSeen: ['look'] } });
    render(<ReceptionistHost />);
    expect(getReceptionistState().heard).toEqual(['look']);
    act(() => {
      noteReceptionistGreetedYou();
    });
    act(() => showReceptionistTopic('rooms'));
    expect(lastWrite()).toMatchObject({ receptionistTopicsSeen: ['look', 'rooms'] });
    const writes = writeUserPreferences.mock.calls.length;
    act(() => showReceptionistTopic('look'));
    expect(writeUserPreferences.mock.calls.length).toBe(writes);
  });

  // docs/specs/008-canvas/receptionist.md "Share roles": a Viewer gets no Say topic, a Participant no Building.
  it('passes on what the person may do', () => {
    editor({ can: { takePart: false, addContent: false } });
    render(<ReceptionistHost />);
    expect(getReceptionistState().can).toEqual({ speak: false, edit: false });
  });

  it('gives the welcome again from Settings while he is here, never when he is not', () => {
    editor({ userPreferences: { avatarTourSeen: true } });
    render(<ReceptionistHost />);
    act(() => requestAvatarTourRelaunch());
    expect(getReceptionistState().chat.open).toBe(false);
    act(() => setReceptionistHere(true));
    act(() => requestAvatarTourRelaunch());
    expect(getReceptionistState()).toMatchObject({
      asks: 1,
      chat: { open: true, reason: 'welcome' },
    });
    expect(lastWrite()).toMatchObject({ avatarTourSeen: true });
  });

  it('closes his bubble when it unmounts', () => {
    editor();
    const { unmount } = render(<ReceptionistHost />);
    act(() => noteReceptionistGreetedYou());
    unmount();
    expect(getReceptionistState().chat.open).toBe(false);
  });
});
