// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WORKBENCH_SELECTION_SETTLE_MS,
  type PageToWorkbenchMessage,
  type WorkbenchToPageMessage,
} from '@liveplanner/api-schema';
import type { Tab } from '@liveplanner/project';
import type { WorkbenchProjectSession } from '@/components/providers/workbench-session-context';
import { createRevealStore } from '@/lib/changeset-reveals';
import { createSelectionStore } from '@/lib/selection-store';

// The editor's workbench messages (docs/specs/013-workspace/blueprints/workbench-embeds.md "Workbench
// messages"): ready once, tab on each later change, the selection after it settles (only when its
// text changed), reveal, theme.

const { appearance } = vi.hoisted(() => ({ appearance: { setAppearanceOverride: vi.fn() } }));
vi.mock('@liveplanner/ui', () => appearance);

const { useWorkbenchMessages } = await import('./useWorkbenchMessages');

const shape = (id: string, label?: string) =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, label }) as never;

const TABS: Tab[] = [
  {
    id: 'tab-a',
    name: 'Wireframe',
    elements: [shape('el-play', 'Play'), shape('el-grid', 'Grid')],
  },
  { id: 'tab-b', name: 'Flow', elements: [shape('el-x')] },
];

function fakeSession() {
  const listeners = new Set<(m: WorkbenchToPageMessage) => void>();
  const sent: PageToWorkbenchMessage[] = [];
  const session = {
    port: {
      origin: 'https://127.0.0.1:5175',
      send: (m: PageToWorkbenchMessage) => sent.push(m),
      subscribe: (l: (m: WorkbenchToPageMessage) => void) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      close: () => {},
    },
  } as unknown as WorkbenchProjectSession;
  const deliver = (m: WorkbenchToPageMessage) => listeners.forEach((l) => l(m));
  return { session, sent, deliver, listeners };
}

type Props = {
  workbench: WorkbenchProjectSession | null;
  hydrated: boolean;
  activeId: string;
  projectName: string;
};

function mount(initial: Partial<Props> & { workbench: WorkbenchProjectSession | null }) {
  const selection = createSelectionStore();
  const reveals = createRevealStore();
  const revealInView = vi.fn();
  const revOf = vi.fn((tabId: string) => (tabId === 'tab-a' ? 41 : 3));
  const hook = renderHook(
    (p: Props) =>
      useWorkbenchMessages({
        workbench: p.workbench,
        hydrated: p.hydrated,
        projectId: 'doc-1',
        projectName: p.projectName,
        tabs: TABS,
        activeId: p.activeId,
        sessionRole: 'edit',
        selection,
        revOf,
        revealInView,
        reveals,
        selfColor: '#0ea5e9',
      }),
    {
      initialProps: { hydrated: true, activeId: 'tab-a', projectName: 'Home screen', ...initial },
    },
  );
  return { ...hook, selection, reveals, revealInView };
}

const settle = () =>
  act(() => {
    vi.advanceTimersByTime(WORKBENCH_SELECTION_SETTLE_MS);
  });
const ofType = (sent: PageToWorkbenchMessage[], type: string) =>
  sent.filter((m) => m.type === type);

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  appearance.setAppearanceOverride.mockClear();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useWorkbenchMessages', () => {
  it('does nothing outside a workbench', () => {
    const { selection } = mount({ workbench: null });
    act(() => selection.setSelectedId('el-play'));
    settle();
    expect(appearance.setAppearanceOverride).not.toHaveBeenCalled();
  });

  it('sends ready once, after hydration, with the project, tab and role', () => {
    const { session, sent } = fakeSession();
    const { rerender } = mount({ workbench: session, hydrated: false });
    expect(sent).toEqual([]);

    rerender({
      workbench: session,
      hydrated: true,
      activeId: 'tab-a',
      projectName: 'Home screen',
    });
    rerender({ workbench: session, hydrated: true, activeId: 'tab-a', projectName: 'Renamed' });

    expect(ofType(sent, 'liveplanner:ready')).toEqual([
      {
        type: 'liveplanner:ready',
        v: 1,
        projectId: 'doc-1',
        projectName: 'Home screen',
        tabId: 'tab-a',
        tabName: 'Wireframe',
        role: 'edit',
      },
    ]);
  });

  it('sends the whole tab once the first selection settles', () => {
    const { session, sent } = fakeSession();
    mount({ workbench: session });
    settle();

    const [selection] = ofType(sent, 'liveplanner:selection');
    expect(selection).toMatchObject({ projectId: 'doc-1', tabId: 'tab-a', rev: 41, count: 0 });
    expect((selection as { reference: string }).reference).toMatch(/\nwhole tab$/);
  });

  it('sends a selection only once it has settled, as one message per gesture', () => {
    const { session, sent } = fakeSession();
    const { selection } = mount({ workbench: session });
    settle();
    sent.length = 0;

    act(() => selection.setSelectedId('el-play'));
    act(() => {
      vi.advanceTimersByTime(WORKBENCH_SELECTION_SETTLE_MS - 1);
    });
    act(() => selection.setMultiSelectedIds(new Set(['el-play', 'el-grid'])));
    act(() => {
      vi.advanceTimersByTime(WORKBENCH_SELECTION_SETTLE_MS - 1);
    });
    expect(sent).toEqual([]);
    settle();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: 'liveplanner:selection', count: 2, rev: 41 });
    expect((sent[0] as { reference: string }).reference).toContain('"Play"');
  });

  it('never sends an unchanged selection again', () => {
    const { session, sent } = fakeSession();
    const { selection } = mount({ workbench: session });
    act(() => selection.setSelectedId('el-play'));
    settle();
    act(() => selection.setSelectedId(null));
    act(() => selection.setSelectedId('el-play'));
    settle();

    expect(ofType(sent, 'liveplanner:selection')).toHaveLength(1);
  });

  it('sends the tab on every later change, then its selection after the settle', () => {
    const { session, sent } = fakeSession();
    const { rerender } = mount({ workbench: session });
    settle();
    sent.length = 0;

    rerender({
      workbench: session,
      hydrated: true,
      activeId: 'tab-b',
      projectName: 'Home screen',
    });
    expect(sent).toEqual([{ type: 'liveplanner:tab', v: 1, tabId: 'tab-b', tabName: 'Flow' }]);
    settle();

    expect(sent[1]).toMatchObject({ type: 'liveplanner:selection', tabId: 'tab-b', rev: 3 });
  });

  it('starts the frame on the system scheme, then follows the workbench’s theme', () => {
    const { session, deliver } = fakeSession();
    mount({ workbench: session });
    expect(appearance.setAppearanceOverride).toHaveBeenLastCalledWith('system');

    act(() => deliver({ type: 'liveplanner:theme', v: 1, colourScheme: 'dark' }));

    expect(appearance.setAppearanceOverride).toHaveBeenLastCalledWith('dark');
  });

  it('reveals the refs it can find on the active tab, outlined in the person’s colour', () => {
    const { session, deliver } = fakeSession();
    const { revealInView, reveals } = mount({ workbench: session });
    const added = vi.spyOn(reveals, 'add');

    act(() =>
      deliver({ type: 'liveplanner:reveal', v: 1, refs: ['el-play', 'el-grid', 'el-x', 'zz'] }),
    );

    expect(revealInView).toHaveBeenCalledWith('tab-a', ['el-play', 'el-grid']);
    expect(added).toHaveBeenCalledWith(
      expect.objectContaining({ tabId: 'tab-a', ids: ['el-play', 'el-grid'], color: '#0ea5e9' }),
    );
    expect(warn).toHaveBeenCalledWith('[workbench] reveal-missed', { count: 2 });
  });

  it('reveals nothing, and says so, when no ref is on the tab', () => {
    const { session, deliver } = fakeSession();
    const { revealInView } = mount({ workbench: session });

    act(() => deliver({ type: 'liveplanner:reveal', v: 1, refs: ['el-x'] }));

    expect(revealInView).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('[workbench] reveal-missed', { count: 1 });
  });

  it('reveals an element named twice once, and misses nothing', () => {
    const { session, deliver } = fakeSession();
    const { revealInView } = mount({ workbench: session });

    act(() => deliver({ type: 'liveplanner:reveal', v: 1, refs: ['el-play', 'el-play'] }));

    expect(revealInView).toHaveBeenCalledWith('tab-a', ['el-play']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('sends nothing while the active tab is not among the tabs', () => {
    const { session, sent, deliver } = fakeSession();
    const { revealInView, selection } = mount({ workbench: session, activeId: 'tab-gone' });
    act(() => selection.setSelectedId('el-play'));
    settle();
    act(() => deliver({ type: 'liveplanner:reveal', v: 1, refs: ['el-play'] }));

    expect(sent).toEqual([]);
    expect(revealInView).not.toHaveBeenCalled();
  });

  it('skips an ambiguous ref', () => {
    const { session, deliver } = fakeSession();
    const { revealInView } = mount({ workbench: session });

    act(() => deliver({ type: 'liveplanner:reveal', v: 1, refs: ['el-', 'el-play'] }));

    expect(revealInView).toHaveBeenCalledWith('tab-a', ['el-play']);
  });

  it('leaves the messages the page handles alone, and stops listening on unmount', () => {
    const { session, deliver, listeners } = fakeSession();
    const { revealInView, unmount } = mount({ workbench: session });

    act(() => deliver({ type: 'liveplanner:ticket', v: 1, ticket: 'A'.repeat(22) }));
    unmount();

    expect(revealInView).not.toHaveBeenCalled();
    expect(listeners.size).toBe(0);
  });
});

describe('useWorkbenchMessages in a workspace frame', () => {
  function framed() {
    const base = fakeSession();
    const reportProjectPlace = vi.fn();
    const session = {
      ...base.session,
      frame: { back: vi.fn(), backTitle: 'Home', reportProjectPlace },
    } as WorkbenchProjectSession;
    return { ...base, session, reportProjectPlace };
  }

  it('reports its project as the frame’s place instead of ready, on every tab change and rename', () => {
    const { session, sent, reportProjectPlace } = framed();
    const { rerender } = mount({ workbench: session });

    expect(ofType(sent, 'liveplanner:ready')).toEqual([]);
    expect(reportProjectPlace).toHaveBeenLastCalledWith({
      projectId: 'doc-1',
      projectName: 'Home screen',
      tabId: 'tab-a',
      tabName: 'Wireframe',
      role: 'edit',
    });

    rerender({
      workbench: session,
      hydrated: true,
      activeId: 'tab-b',
      projectName: 'Home screen',
    });
    expect(ofType(sent, 'liveplanner:tab')).toEqual([
      { type: 'liveplanner:tab', v: 1, tabId: 'tab-b', tabName: 'Flow' },
    ]);
    expect(reportProjectPlace).toHaveBeenLastCalledWith(
      expect.objectContaining({ tabId: 'tab-b', tabName: 'Flow' }),
    );

    rerender({ workbench: session, hydrated: true, activeId: 'tab-b', projectName: 'Menu' });
    expect(reportProjectPlace).toHaveBeenLastCalledWith(
      expect.objectContaining({ projectName: 'Menu' }),
    );
  });

  it('leaves the scheme to the frame', () => {
    const { session, deliver } = framed();
    mount({ workbench: session });

    deliver({ type: 'liveplanner:theme', v: 1, colourScheme: 'dark' });

    expect(appearance.setAppearanceOverride).not.toHaveBeenCalled();
  });
});
