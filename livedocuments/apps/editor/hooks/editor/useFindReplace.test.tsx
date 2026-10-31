// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderHook } from '@testing-library/react';
import type { Tab } from '@livedocuments/document';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { getFindHighlights } from '@/lib/find/find-highlight-store';
import { fixtureTab, rowsOf } from '@/test/find-fixture';
import { FIND_DEBOUNCE_MS, useFindReplace } from './useFindReplace';

// docs/specs/007-editor/find-and-replace.md: the bar's state end to end over the fixture tab (12 "plan"s, six in the
// writing and six in the elements, one in a checklist a Participant may not edit).
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/lib/text-hug', () => ({ hugsText: () => false, hugTextSize: () => ({}) }));
vi.mock('@/components/canvas/text-hug-measure', () => ({ measureDrawnText: () => () => ({}) }));

type Level = 'edit' | 'participate' | 'view';

function setup(level: Level = 'edit', over: { standsAside?: boolean } = {}) {
  let tab: Tab = fixtureTab();
  const deps = {
    focusPage: vi.fn(),
    scrollIntoView: vi.fn(),
    notify: vi.fn(),
    commits: 0,
  };
  const hook = renderHook(
    ({ t }: { t: Tab }) =>
      useFindReplace({
        activeTab: t,
        pages: rowsOf(t),
        can: resolveEditorCapabilities(level),
        standsAside: over.standsAside ?? false,
        canvasMainRef: { current: null },
        getView: () => ({ zoom: 1, offset: { x: 0, y: 0 } }),
        focusPage: deps.focusPage,
        scrollIntoView: deps.scrollIntoView,
        notify: deps.notify,
        // One history step: the mapper over the tab as it is, then the editor re-renders with the result.
        commitActiveTab: (map) => {
          deps.commits += 1;
          tab = map(tab);
          hook.rerender({ t: tab });
        },
      }),
    { initialProps: { t: tab } },
  );
  return { hook, deps, tab: () => tab, find: () => hook.result.current };
}

const chord = (key: string, shiftKey = false) =>
  act(() => {
    fireEvent.keyDown(document.body, {
      key,
      code: `Key${key.toUpperCase()}`,
      metaKey: true,
      shiftKey,
    });
  });

function search(s: ReturnType<typeof setup>, q: string) {
  act(() => s.find().setQuery(q));
  act(() => {
    vi.advanceTimersByTime(FIND_DEBOUNCE_MS);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  track.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useFindReplace', () => {
  it('opens on Cmd/Ctrl+F, searches once typing pauses, and goes to the first match', () => {
    const s = setup();
    expect(s.find().open).toBe(false);
    chord('f');
    expect(s.find().open).toBe(true);
    expect(s.find().replaceOpen).toBe(false);
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'FindBar');
    act(() => s.find().setQuery('plan'));
    // Not yet: the pause.
    expect(s.find().searched).toBe(false);
    expect(s.find().count).toBe(0);
    act(() => {
      vi.advanceTimersByTime(FIND_DEBOUNCE_MS);
    });
    expect(s.find().searched).toBe(true);
    expect(s.find().count).toBe(12);
    expect(s.find().index).toBe(0);
    expect(s.deps.focusPage).toHaveBeenCalled();
    const marks = getFindHighlights();
    expect([...marks.elements.values()]).toContain('match');
    expect(marks.flows.get('f1')?.length).toBeGreaterThan(0);
  });

  it('steps round the matches, and Enter before the pause searches at once', () => {
    const s = setup();
    chord('f');
    act(() => s.find().setQuery('plan'));
    act(() => s.find().next());
    expect(s.find().searched).toBe(true);
    expect(s.find().index).toBe(0);
    act(() => s.find().next());
    expect(s.find().index).toBe(1);
    act(() => s.find().previous());
    act(() => s.find().previous());
    expect(s.find().index).toBe(11);
  });

  it('runs the options at once and counts by them', () => {
    const s = setup();
    chord('f');
    search(s, 'Plan');
    act(() => s.find().toggleOption('matchCase'));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    // "The Plan", the box's label "Plan" and the table's "Plan".
    expect(s.find().count).toBe(3);
  });

  it('replaces the match in hand as one edit and moves on', () => {
    const s = setup();
    chord('h', true);
    expect(s.find().replaceOpen).toBe(true);
    search(s, 'plan');
    act(() => s.find().setBy('map'));
    act(() => s.find().replace());
    expect(s.deps.commits).toBe(1);
    expect(s.find().count).toBe(11);
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'FindReplace');
  });

  it('replaces all as one edit and says how many', () => {
    const s = setup();
    chord('h', true);
    search(s, 'plan');
    act(() => s.find().setBy('map'));
    act(() => s.find().replaceAll());
    expect(s.deps.commits).toBe(1);
    expect(s.find().count).toBe(0);
    expect(s.deps.notify).toHaveBeenCalledWith('Replaced 12 matches.');
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'FindReplaceAll');
  });

  it('lets a Participant replace only its text, and says what it left', () => {
    const s = setup('participate');
    chord('h', true);
    search(s, 'plan');
    expect(s.find().heldCount).toBe(1);
    act(() => s.find().replaceAll());
    expect(s.deps.notify).toHaveBeenCalledWith(
      "Replaced 11 matches. 1 match in text you can't edit was left as it is.",
    );
    expect(s.find().count).toBe(1);
    expect(s.find().currentHeld).toBe('role');
    // The held one cannot be replaced on its own either.
    act(() => s.find().replace());
    expect(s.deps.commits).toBe(1);
    expect([...getFindHighlights().elements.values()]).toEqual(['current']);
  });

  it('lets a Viewer find but never replace', () => {
    const s = setup('view');
    chord('h', true);
    expect(s.find().open).toBe(true);
    expect(s.find().canReplace).toBe(false);
    expect(s.find().replaceOpen).toBe(false);
    search(s, 'plan');
    expect(s.find().count).toBe(12);
    act(() => s.find().setReplaceOpen(true));
    act(() => s.find().replaceAll());
    act(() => s.find().replace());
    expect(s.find().replaceOpen).toBe(false);
    expect(s.deps.commits).toBe(0);
  });

  it('stays out of the way while the editor stands aside, and closes clean', () => {
    const aside = setup('edit', { standsAside: true });
    chord('f');
    expect(aside.find().open).toBe(false);
    aside.hook.unmount();
    const s = setup();
    chord('f');
    search(s, 'plan');
    act(() => s.find().close());
    expect(s.find().open).toBe(false);
    expect(getFindHighlights().elements.size).toBe(0);
  });
});
