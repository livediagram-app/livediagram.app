// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EditorMode, Tab } from '@livediagram/document';
import { useTabActions } from './useTabActions';

// docs/specs/007-editor/editor-modes.md "A new tab opens in the mode it was made from".
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const first = { id: 't1', name: 'Tab 1', elements: [] } as unknown as Tab;

function run(
  editorMode: EditorMode,
  inMode?: EditorMode,
  canEditStructure = true,
  active: Tab = first,
) {
  const commitTabs = vi.fn();
  const deps = new Proxy<Record<string, unknown>>(
    {
      tabs: [active],
      activeId: 't1',
      editorMode,
      canEditStructure,
      createTab: (name: string) => ({ id: 't2', name, elements: [] }) as unknown as Tab,
      commitTabs,
    },
    // Every other dependency the hook takes is a no-op here.
    { get: (target, key: string) => (key in target ? target[key] : vi.fn()) },
  );
  const { result } = renderHook(() => useTabActions(deps as never));
  result.current.addTab(inMode);
  return { commitTabs };
}

// The active tab in `editorMode` (its own `opensIn`, as the editor resolves its mode from), unless one is given.
function inMode(mode: EditorMode): Tab {
  return mode === 'diagram' ? first : { ...first, opensIn: mode };
}

function add(editorMode: EditorMode, asked?: EditorMode, active: Tab = inMode(editorMode)) {
  const { commitTabs } = run(editorMode, asked, true, active);
  const update = commitTabs.mock.calls[0]![0] as (ts: Tab[]) => Tab[];
  return { added: update([active]).at(-1)! };
}

describe('adding a tab', () => {
  it('from Diagram, opens on Start Diagramming: no opening mode', () => {
    expect(add('diagram').added.opensIn).toBeUndefined();
  });

  it('from Draw or Workshop, opens in that same mode on its own start', () => {
    for (const mode of ['draw', 'workshop'] as const) expect(add(mode).added.opensIn).toBe(mode);
  });

  it('asked for in a mode, opens in that mode whatever the active tab is in', () => {
    expect(add('workshop', 'draw').added.opensIn).toBe('draw');
    expect(add('workshop', 'diagram').added.opensIn).toBeUndefined();
  });

  it('is a general tab carrying the active tab look, never its kind', () => {
    const board = { ...first, kind: 'event-storming', theme: 'slate' } as unknown as Tab;
    const { added } = add('diagram', undefined, board);
    expect(added).toMatchObject({ theme: 'slate' });
    // An event-storming board is always Diagram, so its new tab is a Diagram tab.
    expect(added.opensIn).toBeUndefined();
    expect(added.kind).toBeUndefined();
  });

  it('follows a switch still landing: the mode the tabs it lands on hold, not the one this render saw', () => {
    // Picked Draw on the start (a transition, not yet rendered), then + straight after: this render still says
    // Diagram, but the commit lands on the switched tab.
    const { commitTabs } = run('diagram', undefined, true, first);
    const update = commitTabs.mock.calls[0]![0] as (ts: Tab[]) => Tab[];
    expect(update([inMode('draw')]).at(-1)!.opensIn).toBe('draw');
    expect(update([first]).at(-1)!.opensIn).toBeUndefined();
  });

  it('falls back to the mode this render saw when the active tab is not in the tabs it lands on', () => {
    const { commitTabs } = run('workshop', undefined, true, first);
    const update = commitTabs.mock.calls[0]![0] as (ts: Tab[]) => Tab[];
    expect(update([]).at(-1)!.opensIn).toBe('workshop');
  });

  it("in any mode, opens on that mode's own start", () => {
    for (const mode of ['draw', 'workshop'] as const)
      expect(add('diagram', mode).added.opensIn).toBe(mode);
  });
});

// docs/specs/013-workspace/tab-scoped-share-links.md: a tab-scoped (or view) link changes no tabs, so whichever
// control asks, no tab is added.
describe('adding a tab without the right to change tabs', () => {
  it('adds nothing', () => {
    expect(run('draw', 'diagram', false).commitTabs).not.toHaveBeenCalled();
  });

  it("adds nothing from the + either, whatever the active tab's mode", () => {
    for (const mode of ['workshop', 'draw', 'diagram'] as const)
      expect(run(mode, undefined, false).commitTabs).not.toHaveBeenCalled();
  });
});
