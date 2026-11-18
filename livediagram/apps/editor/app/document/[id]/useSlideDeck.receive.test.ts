// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendToStoredPresentation,
  parseStoredPresentation,
  storePresentation,
  type Slide,
  type Tab,
} from '@livediagram/document';
import { DECK_ECHO_WINDOW_MS, useSlideDeck } from './useSlideDeck';

// docs/specs/012-collaboration/presentation-mode.md "Slides an agent appends": the MCP's add_tab appends a presented
// template's slides on the api, which tells the room; an editor with the document open takes them in, so its next
// deck edit keeps them instead of writing them away (Work Tracker 1179).
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/hooks/ui/useSlideThumbnails', () => ({ useSlideThumbnails: () => new Map() }));
vi.mock('@/lib/editor-deferred-code', () => ({ loadPresentationOverlay: () => Promise.resolve() }));

const tabs = [{ id: 'a', name: 'a', elements: [] }] as unknown as Tab[];
const slide = (id: string): Slide => ({ id, tabId: 'a', elementIds: ['x'] });
const SAVE_MS = 900;

// The api's stored deck, an open editor saving into it, and the MCP appending to it as the api does.
function documentOpenIn(isReadOnly = false) {
  const server = { stored: JSON.stringify(storePresentation({ slides: [slide('mine')] })) };
  const sent: string[] = [];
  const saveDeck = vi.fn((serialised: string | null) => {
    sent.push(serialised ?? '');
    server.stored = serialised ?? '';
  });
  const editor = renderHook(() =>
    useSlideDeck({
      prefs: {},
      commitPrefs: () => {},
      tabs,
      activeTabId: 'a',
      setActiveId: vi.fn(),
      readSelection: () => ({ ids: new Set() }) as never,
      setSelectedId: vi.fn(),
      setMultiSelectedIds: vi.fn(),
      isReadOnly,
      saveDeck,
    }),
  );
  act(() => editor.result.current.hydrateDeck(server.stored));
  // add_tab: the api appends and relays only what it added, as the room's deck-slides op.
  const agentAppends = (added: Slide[]) => {
    const next = appendToStoredPresentation(server.stored, added);
    server.stored = next.presentation ?? '';
    return next.added;
  };
  const deliver = (slides: readonly Slide[]) =>
    act(() => editor.result.current.receiveSlides(slides));
  const flush = (ms = SAVE_MS) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  const storedIds = () =>
    parseStoredPresentation(server.stored)?.decks[0]?.slides.map((s) => s.id) ?? [];
  const shownIds = () => editor.result.current.deck.slides.map((s) => s.id);
  return { editor, server, saveDeck, sent, agentAppends, deliver, flush, storedIds, shownIds };
}

describe('useSlideDeck receiveSlides', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps both sets of slides when the open editor edits its deck after add_tab', () => {
    const doc = documentOpenIn();
    doc.flush(DECK_ECHO_WINDOW_MS);
    doc.deliver(doc.agentAppends([slide('t1'), slide('t2')]));
    expect(doc.shownIds()).toEqual(['mine', 't1', 't2']);
    // Already stored: taking them in writes nothing.
    doc.flush();
    expect(doc.saveDeck).not.toHaveBeenCalled();
    // The person's own edit after the append: its save carries the agent's slides too.
    act(() => doc.editor.result.current.renameSlide('mine', 'Intro'));
    doc.flush();
    expect(doc.storedIds()).toEqual(['mine', 't1', 't2']);
    expect(parseStoredPresentation(doc.server.stored)?.decks[0]?.slides[0]?.name).toBe('Intro');
  });

  it('puts the slides into a deck save still waiting to go', () => {
    const doc = documentOpenIn();
    act(() => doc.editor.result.current.renameSlide('mine', 'Intro'));
    doc.deliver(doc.agentAppends([slide('t1')]));
    doc.flush();
    expect(doc.saveDeck).toHaveBeenCalledTimes(1);
    expect(doc.storedIds()).toEqual(['mine', 't1']);
  });

  it('saves again when its last deck save went out just before the append and landed after it', () => {
    const doc = documentOpenIn();
    act(() => doc.editor.result.current.renameSlide('mine', 'Intro'));
    doc.flush();
    const stale = doc.sent.at(-1)!;
    const added = doc.agentAppends([slide('t1')]);
    // The editor's save, sent before the append, lands after it: the append is written away.
    doc.server.stored = stale;
    expect(doc.storedIds()).toEqual(['mine']);
    doc.deliver(added);
    doc.flush();
    expect(doc.storedIds()).toEqual(['mine', 't1']);
  });

  it('adds a replayed slide once, drops a malformed one, and a viewer never saves', () => {
    const doc = documentOpenIn();
    doc.flush(DECK_ECHO_WINDOW_MS);
    doc.deliver([slide('t1'), { id: 'bad' } as Slide]);
    doc.deliver([slide('t1')]);
    expect(doc.shownIds()).toEqual(['mine', 't1']);

    const viewer = documentOpenIn(true);
    act(() => viewer.editor.result.current.renameSlide('mine', 'Ignored'));
    viewer.deliver([slide('t1')]);
    viewer.flush(DECK_ECHO_WINDOW_MS);
    expect(viewer.shownIds()).toEqual(['mine', 't1']);
    expect(viewer.saveDeck).not.toHaveBeenCalled();
  });
});

// A resync reads the stored deck back (useRoomResync) when the room could no longer replay a deck-slides op.
describe('useSlideDeck receiveStoredDeck', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("takes in the stored deck's slides it lacks, saving nothing", () => {
    const doc = documentOpenIn();
    doc.agentAppends([slide('t1')]);
    act(() => doc.editor.result.current.receiveStoredDeck(doc.server.stored));
    expect(doc.shownIds()).toEqual(['mine', 't1']);
    doc.flush(DECK_ECHO_WINDOW_MS);
    expect(doc.saveDeck).not.toHaveBeenCalled();
  });

  it('leaves the deck alone while a save of ours is waiting or just went out, so a deleted slide stays gone', () => {
    const doc = documentOpenIn();
    const before = doc.server.stored;
    act(() => doc.editor.result.current.deleteSlide('mine'));
    act(() => doc.editor.result.current.receiveStoredDeck(before));
    expect(doc.shownIds()).toEqual([]);
    doc.flush();
    act(() => doc.editor.result.current.receiveStoredDeck(before));
    expect(doc.shownIds()).toEqual([]);
  });
});
