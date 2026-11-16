// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseStoredPresentation, storePresentation, type Tab } from '@livediagram/document';
import { useSlideDeck } from './useSlideDeck';

// docs/specs/012-collaboration/presentation-mode.md "Decks a template seeds": a presented template's slides go on
// after the deck's own, and are saved like any deck edit.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/hooks/ui/useSlideThumbnails', () => ({ useSlideThumbnails: () => new Map() }));
vi.mock('@/lib/editor-deferred-code', () => ({ loadPresentationOverlay: () => Promise.resolve() }));

const tabs = [{ id: 'a', name: 'a', elements: [] }] as unknown as Tab[];
const slide = (id: string) => ({ id, tabId: 'a', elementIds: ['x'] });

function deck(isReadOnly: boolean) {
  const saveDeck = vi.fn<(serialised: string | null) => void>();
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
      saveDeck,
    }),
  );
  act(() =>
    hook.result.current.hydrateDeck(JSON.stringify(storePresentation({ slides: [slide('mine')] }))),
  );
  return { ...hook, saveDeck };
}

describe('useSlideDeck appendSlides', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("puts the slides after the deck's own and saves them", () => {
    const { result, saveDeck } = deck(false);
    act(() => result.current.appendSlides([slide('t1'), slide('t2')]));
    expect(result.current.deck.slides.map((s) => s.id)).toEqual(['mine', 't1', 't2']);
    act(() => {
      vi.runAllTimers();
    });
    const saved = parseStoredPresentation(saveDeck.mock.calls.at(-1)![0]);
    expect(saved?.decks[0]?.slides.map((s) => s.id)).toEqual(['mine', 't1', 't2']);
  });

  it('changes nothing for a viewer, or for no slides', () => {
    const viewer = deck(true);
    act(() => viewer.result.current.appendSlides([slide('t1')]));
    expect(viewer.result.current.deck.slides.map((s) => s.id)).toEqual(['mine']);
    const editor = deck(false);
    act(() => editor.result.current.appendSlides([]));
    act(() => {
      vi.runAllTimers();
    });
    expect(editor.saveDeck).not.toHaveBeenCalled();
  });
});
