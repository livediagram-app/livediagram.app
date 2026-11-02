// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { storePresentation, type Tab } from '@livedocuments/document';
import { useSlideDeck } from './useSlideDeck';

// docs/specs/012-collaboration/speaker-note-cards.md "The model": the deck writes a slide's note cards with the
// `notes` mirror, and an Editor alone writes them.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/hooks/ui/useSlideThumbnails', () => ({ useSlideThumbnails: () => new Map() }));
vi.mock('@/lib/editor-deferred-code', () => ({ loadPresentationOverlay: () => Promise.resolve() }));

const tabs = [{ id: 'a', name: 'a', elements: [] }] as unknown as Tab[];

function deckHook(isReadOnly: boolean) {
  const hook = renderHook(() =>
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
    }),
  );
  act(() =>
    hook.result.current.hydrateDeck(
      JSON.stringify(
        storePresentation({
          slides: [{ id: 's1', tabId: 'a', elementIds: ['x'], notes: 'Old note' }],
        }),
      ),
    ),
  );
  return hook;
}

describe('setSlideNoteCards', () => {
  it('writes the cards and their mirror, and removes both with the last card', () => {
    const { result } = deckHook(false);
    act(() =>
      result.current.setSlideNoteCards('s1', [
        { id: 'notes', text: 'Old note' },
        { id: 'c1', text: 'Second point' },
      ]),
    );
    expect(result.current.deck.slides[0]).toMatchObject({
      noteCards: [
        { id: 'notes', text: 'Old note' },
        { id: 'c1', text: 'Second point' },
      ],
      notes: 'Old note\n\nSecond point',
    });
    act(() => result.current.setSlideNoteCards('s1', []));
    expect(result.current.deck.slides[0]).not.toHaveProperty('noteCards');
    expect(result.current.deck.slides[0]).not.toHaveProperty('notes');
  });

  it('writes nothing for a session that cannot change the deck', () => {
    const { result } = deckHook(true);
    act(() => result.current.setSlideNoteCards('s1', [{ id: 'c1', text: 'Nope' }]));
    expect(result.current.deck.slides[0]).toEqual({
      id: 's1',
      tabId: 'a',
      elementIds: ['x'],
      notes: 'Old note',
    });
  });
});
