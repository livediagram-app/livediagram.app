// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { storePresentation, type Tab } from '@livediagram/document';
import { useSlideDeck } from './useSlideDeck';

// docs/specs/012-collaboration/presentation-mode.md "Presenting": a running deck stays on its slide when a peer
// changes the deck's tabs.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/hooks/ui/useSlideThumbnails', () => ({ useSlideThumbnails: () => new Map() }));
const overlayCode = vi.hoisted(() => ({ load: vi.fn(() => Promise.resolve()) }));
vi.mock('@/lib/editor-deferred-code', () => ({
  loadPresentationOverlay: () => overlayCode.load(),
}));

const tab = (id: string) => ({ id, name: id, elements: [] }) as unknown as Tab;

function presenting(tabs: Tab[]) {
  const hook = renderHook(
    ({ tabs }: { tabs: Tab[] }) =>
      useSlideDeck({
        tabs,
        activeTabId: 'a',
        setActiveId: vi.fn(),
        readSelection: () => ({ ids: new Set() }) as never,
        setSelectedId: vi.fn(),
        setMultiSelectedIds: vi.fn(),
        isReadOnly: false,
      }),
    { initialProps: { tabs } },
  );
  act(() =>
    hook.result.current.hydrateDeck(
      JSON.stringify(
        storePresentation({
          slides: [
            { id: 's1', tabId: 'a', elementIds: ['x'] },
            { id: 's2', tabId: 'b', elementIds: ['x'] },
            { id: 's3', tabId: 'c', elementIds: ['x'] },
          ],
        }),
      ),
    ),
  );
  return hook;
}

const shownId = (r: { current: ReturnType<typeof useSlideDeck> }) =>
  r.current.runnable[r.current.presentingAt!]?.slide.id;

describe('useSlideDeck presenting', () => {
  it('stays on its slide when a tab before it is deleted', async () => {
    const { result, rerender } = presenting([tab('a'), tab('b'), tab('c')]);
    await act(() => result.current.start());
    act(() => result.current.setPresentingAt(2));
    expect(shownId(result)).toBe('s3');
    rerender({ tabs: [tab('b'), tab('c')] });
    expect(result.current.presentingAt).toBe(1);
    expect(shownId(result)).toBe('s3');
  });

  it("moves to the slide in its place when its own tab is deleted, and doesn't end the deck", async () => {
    const { result, rerender } = presenting([tab('a'), tab('b'), tab('c')]);
    await act(() => result.current.start());
    act(() => result.current.setPresentingAt(2));
    rerender({ tabs: [tab('a'), tab('b')] });
    expect(result.current.presentingAt).toBe(1);
    expect(shownId(result)).toBe('s2');
  });

  it('keeps one setPresentingAt for the whole run', async () => {
    const { result, rerender } = presenting([tab('a'), tab('b'), tab('c')]);
    const first = result.current.setPresentingAt;
    await act(() => result.current.start());
    rerender({ tabs: [tab('a'), tab('b')] });
    expect(result.current.setPresentingAt).toBe(first);
    act(() => result.current.exitPresentation());
    expect(result.current.presentingAt).toBeNull();
  });

  // The overlay holds the deck's keys and loads on demand (lib/editor-deferred-code.ts): the first slide
  // waits for it, so an arrow pressed the moment it shows is never dropped.
  it('starts only once the overlay code is in, and still starts when that load fails', async () => {
    let arrive!: () => void;
    overlayCode.load.mockImplementationOnce(() => new Promise<void>((r) => (arrive = r)));
    const { result } = presenting([tab('a'), tab('b'), tab('c')]);
    let started!: Promise<void>;
    act(() => {
      started = result.current.start();
    });
    await act(async () => {});
    expect(result.current.presentingAt).toBeNull();
    await act(async () => {
      arrive();
      await started;
    });
    expect(result.current.presentingAt).toBe(0);
    act(() => result.current.exitPresentation());

    overlayCode.load.mockImplementationOnce(() => Promise.reject(new Error('ChunkLoadError')));
    await act(() => result.current.start());
    expect(result.current.presentingAt).toBe(0);
  });
});
