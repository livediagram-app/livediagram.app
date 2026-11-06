// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { storePresentation, type Tab } from '@livedocuments/document';
import { useSlideDeck } from './useSlideDeck';

// docs/specs/012-collaboration/presentation-mode.md "Presenting" and "One tab, one show": a show is the open tab's
// slides alone, held to the tab it started on, and stays on its slide when a peer changes the deck.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const overlayCode = vi.hoisted(() => ({ load: vi.fn(() => Promise.resolve()) }));
vi.mock('@/lib/editor-deferred-code', () => ({
  loadPresentationOverlay: () => overlayCode.load(),
}));

const tab = (id: string) => ({ id, name: id, elements: [] }) as unknown as Tab;

function presenting(tabs: Tab[]) {
  const hook = renderHook(
    ({ tabs, activeTabId }: { tabs: Tab[]; activeTabId: string }) =>
      useSlideDeck({
        prefs: {},
        commitPrefs: () => {},
        tabs,
        activeTabId,
        setSelectedId: vi.fn(),
        setMultiSelectedIds: vi.fn(),
        isReadOnly: false,
      }),
    { initialProps: { tabs, activeTabId: 'a' } },
  );
  act(() =>
    hook.result.current.hydrateDeck(
      JSON.stringify(
        storePresentation({
          slides: [
            { id: 's1', tabId: 'a', elementIds: ['x'] },
            { id: 'b1', tabId: 'b', elementIds: ['x'] },
            { id: 's2', tabId: 'a', elementIds: ['x'] },
            { id: 's3', tabId: 'a', elementIds: ['x'] },
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
  it("runs the open tab's slides alone, and another tab's show is its own", () => {
    const { result, rerender } = presenting([tab('a'), tab('b')]);
    expect(result.current.runnable.map((r) => r.slide.id)).toEqual(['s1', 's2', 's3']);
    rerender({ tabs: [tab('a'), tab('b')], activeTabId: 'b' });
    expect(result.current.runnable.map((r) => r.slide.id)).toEqual(['b1']);
  });

  it('presents from a slide of the open tab (Present From Here)', async () => {
    const { result } = presenting([tab('a'), tab('b')]);
    await act(() => result.current.start('s2'));
    expect(result.current.presentingAt).toBe(1);
    expect(shownId(result)).toBe('s2');
  });

  it('holds to the tab it started on when the open tab changes mid-show', async () => {
    const { result, rerender } = presenting([tab('a'), tab('b')]);
    await act(() => result.current.start());
    act(() => result.current.setPresentingAt(2));
    rerender({ tabs: [tab('a'), tab('b')], activeTabId: 'b' });
    expect(result.current.runnable.map((r) => r.slide.id)).toEqual(['s1', 's2', 's3']);
    expect(shownId(result)).toBe('s3');
    // Once it ends, the open tab's show is offered again.
    act(() => result.current.exitPresentation());
    expect(result.current.runnable.map((r) => r.slide.id)).toEqual(['b1']);
  });

  it('stays on its slide when another tab is deleted', async () => {
    const { result, rerender } = presenting([tab('a'), tab('b')]);
    await act(() => result.current.start());
    act(() => result.current.setPresentingAt(2));
    rerender({ tabs: [tab('a')], activeTabId: 'a' });
    expect(result.current.presentingAt).toBe(2);
    expect(shownId(result)).toBe('s3');
  });

  it('ends at the end card, never another tab, when its own tab is deleted', async () => {
    const { result, rerender } = presenting([tab('a'), tab('b')]);
    await act(() => result.current.start());
    rerender({ tabs: [tab('b')], activeTabId: 'a' });
    expect(result.current.runnable).toEqual([]);
    expect(shownId(result)).toBeUndefined();
  });

  it('keeps one setPresentingAt for the whole run', async () => {
    const { result, rerender } = presenting([tab('a'), tab('b'), tab('c')]);
    const first = result.current.setPresentingAt;
    await act(() => result.current.start());
    rerender({ tabs: [tab('a'), tab('b')], activeTabId: 'a' });
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
