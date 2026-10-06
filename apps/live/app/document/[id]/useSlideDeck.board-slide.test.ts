// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import { useSlideDeck } from './useSlideDeck';

// docs/specs/012-collaboration/presentation-mode.md "Board slides": a whole Plan board as a slide is an
// ordinary slide naming the board, on the tab it is on.
const track = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...args: unknown[]) => track(...args) }));
vi.mock('@/hooks/ui/useSlideThumbnails', () => ({ useSlideThumbnails: () => new Map() }));

const tabs = [{ id: 't', name: 'Tab', elements: [] }] as unknown as Tab[];

function deck(isReadOnly: boolean) {
  return renderHook(() =>
    useSlideDeck({
      tabs,
      activeTabId: 't',
      setActiveId: () => {},
      readSelection: () => ({ ids: new Set() }) as never,
      setSelectedId: () => {},
      setMultiSelectedIds: () => {},
      isReadOnly,
    }),
  );
}

describe('useSlideDeck newBoardSlide', () => {
  it('adds a slide naming the board on the open tab, and counts it', () => {
    const { result } = deck(false);
    act(() => result.current.newBoardSlide('board'));
    expect(result.current.deck.slides).toEqual([
      { id: expect.any(String), tabId: 't', elementIds: ['board'] },
    ]);
    expect(track).toHaveBeenCalledWith('UI', 'Added', 'BoardSlide');
  });

  it('adds nothing read-only', () => {
    const { result } = deck(true);
    act(() => result.current.newBoardSlide('board'));
    expect(result.current.deck.slides).toEqual([]);
  });
});
