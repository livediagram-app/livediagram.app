// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EditorMode, Tab } from '@liveplanner/document';
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

function add(editorMode: EditorMode, inMode?: EditorMode, active: Tab = first) {
  const { commitTabs } = run(editorMode, inMode, true, active);
  const update = commitTabs.mock.calls[0]![0] as (ts: Tab[]) => Tab[];
  return { added: update([active]).at(-1)! };
}

describe('adding a tab', () => {
  it('from Plan, opens it in Plan', () => {
    expect(add('plan').added.opensIn).toBe('plan');
  });

  it('from Diagram, opens on Start Diagramming: no opening mode', () => {
    expect(add('diagram').added.opensIn).toBeUndefined();
  });

  it('from Pages, Draw or Workshop, opens in that same mode on its own start', () => {
    for (const mode of ['pages', 'draw', 'workshop'] as const)
      expect(add(mode).added.opensIn).toBe(mode);
  });

  it('asked for in a mode, opens in that mode whatever the active tab is in', () => {
    expect(add('pages', 'draw').added.opensIn).toBe('draw');
    expect(add('pages', 'diagram').added.opensIn).toBeUndefined();
  });

  it('is a general tab carrying the active tab look, never its kind', () => {
    const board = { ...first, kind: 'board', theme: 'slate' } as unknown as Tab;
    const { added } = add('plan', undefined, board);
    expect(added).toMatchObject({ opensIn: 'plan', theme: 'slate' });
    expect(added.kind).toBeUndefined();
  });

  it("in any mode, opens on that mode's own start", () => {
    // From Plan's mode menu: Start Making Pages, Start Drawing, Start a Workshop are each the new tab's start.
    for (const mode of ['pages', 'draw', 'workshop'] as const)
      expect(add('plan', mode).added.opensIn).toBe(mode);
  });
});

// docs/specs/013-workspace/tab-scoped-share-links.md: a tab-scoped (or view) link changes no tabs, so whichever
// control asks, no tab is added.
describe('adding a tab without the right to change tabs', () => {
  it('adds nothing', () => {
    expect(run('plan', 'diagram', false).commitTabs).not.toHaveBeenCalled();
  });

  it("adds nothing from the + either, whatever the active tab's mode", () => {
    for (const mode of ['pages', 'plan', 'diagram'] as const)
      expect(run(mode, undefined, false).commitTabs).not.toHaveBeenCalled();
  });
});
