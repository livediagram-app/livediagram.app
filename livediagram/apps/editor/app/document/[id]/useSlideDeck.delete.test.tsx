// @vitest-environment jsdom
// docs/specs/012-collaboration/presentation-mode.md and liveworkspace/docs/specs/022-interface-design/
// undo-not-confirm.md: deleting a slide acts at once, and its toast's Undo puts it back at its place in the deck.
import { act, fireEvent, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@liveworkspace/ui/toast';
import { storePresentation, type Slide, type Tab } from '@livediagram/document';
import { useSlideDeck } from './useSlideDeck';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/hooks/ui/useSlideThumbnails', () => ({ useSlideThumbnails: () => new Map() }));
vi.mock('@/lib/editor-deferred-code', () => ({ loadPresentationOverlay: () => Promise.resolve() }));

const tabs = [{ id: 'a', name: 'a', elements: [] }] as unknown as Tab[];
const slide = (id: string, title?: string): Slide => ({
  id,
  tabId: 'a',
  elementIds: ['x'],
  ...(title ? { name: title } : {}),
});

function deck(isReadOnly = false) {
  const hook = renderHook(
    () =>
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
        saveDeck: vi.fn(),
      }),
    { wrapper: ToastProvider },
  );
  act(() =>
    hook.result.current.hydrateDeck(
      JSON.stringify(
        storePresentation({ slides: [slide('s1'), slide('s2', 'Roadmap'), slide('s3')] }),
      ),
    ),
  );
  return {
    deck: () => hook.result.current,
    ids: () => hook.result.current.deck.slides.map((s) => s.id),
  };
}

describe('deleting a slide', () => {
  it('goes at once, and Undo puts it back in its place', async () => {
    const d = deck();
    await act(async () => {
      d.deck().deleteSlide('s2');
    });
    expect(d.ids()).toEqual(['s1', 's3']);
    expect(screen.getByText('Deleted “Roadmap”.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo deleting Roadmap' }));
    await act(async () => {});
    expect(d.ids()).toEqual(['s1', 's2', 's3']);
  });

  it('keeps slides added since, and never brings back one a collaborator removed', async () => {
    const d = deck();
    await act(async () => {
      d.deck().deleteSlide('s2');
    });
    act(() => d.deck().receiveSlides([slide('s4')]));
    act(() => {
      d.deck().deleteSlide('s3');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Undo deleting Roadmap' }));
    await act(async () => {});
    expect(d.ids()).toEqual(['s1', 's2', 's4']);
  });

  it('in a read-only session deletes nothing and offers nothing', async () => {
    const d = deck(true);
    await act(async () => {
      d.deck().deleteSlide('s2');
    });
    expect(d.ids()).toEqual(['s1', 's2', 's3']);
    expect(screen.queryByRole('button', { name: /^Undo/ })).toBeNull();
  });
});
