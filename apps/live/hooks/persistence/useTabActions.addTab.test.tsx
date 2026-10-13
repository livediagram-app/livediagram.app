// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EditorMode, Tab } from '@livediagram/document';
import { useTabActions } from './useTabActions';

// docs/specs/007-editor/editor-modes.md "A new tab opens in the mode it was made from", with no Quick Start.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const first = { id: 't1', name: 'Tab 1', elements: [] } as unknown as Tab;

function run(
  editorMode: EditorMode,
  inMode?: EditorMode,
  canEditStructure = true,
  active: Tab = first,
) {
  const commitTabs = vi.fn();
  const setTemplatePickerMode = vi.fn();
  const deps = new Proxy(
    {
      tabs: [active],
      activeId: 't1',
      editorMode,
      canEditStructure,
      createTab: (name: string) => ({ id: 't2', name, elements: [] }) as unknown as Tab,
      commitTabs,
      setTemplatePickerMode,
    } as Record<string, unknown>,
    // Every other dependency the hook takes is a no-op here.
    { get: (target, key: string) => (key in target ? target[key] : vi.fn()) },
  );
  const { result } = renderHook(() => useTabActions(deps as never));
  result.current.addTab(inMode);
  return { commitTabs, setTemplatePickerMode };
}

function add(editorMode: EditorMode, inMode?: EditorMode, active: Tab = first) {
  const { commitTabs, setTemplatePickerMode } = run(editorMode, inMode, true, active);
  const update = commitTabs.mock.calls[0]![0] as (ts: Tab[]) => Tab[];
  return { added: update([active]).at(-1)!, setTemplatePickerMode };
}

describe('adding a tab', () => {
  it('from Plan, opens it in Plan with no Quick Start', () => {
    const { added, setTemplatePickerMode } = add('plan');
    expect(added.opensIn).toBe('plan');
    expect(setTemplatePickerMode).not.toHaveBeenCalled();
  });

  it('from Diagram, opens on Start Diagramming: no Quick Start and no opening mode', () => {
    const { added, setTemplatePickerMode } = add('diagram');
    expect(added.opensIn).toBeUndefined();
    expect(setTemplatePickerMode).not.toHaveBeenCalled();
  });

  it('from Illustrate, Draw or Facilitate, opens in that same mode on its own start, with no Quick Start', () => {
    for (const mode of ['illustrate', 'draw', 'facilitate'] as const) {
      const tab = add(mode);
      expect(tab.added.opensIn).toBe(mode);
      expect(tab.setTemplatePickerMode).not.toHaveBeenCalled();
    }
  });

  it('asked for in a mode, opens in that mode whatever the active tab is in', () => {
    expect(add('illustrate', 'draw').added.opensIn).toBe('draw');
    expect(add('illustrate', 'diagram').added.opensIn).toBeUndefined();
  });

  it('is a general tab carrying the active tab look, never its kind', () => {
    const board = { ...first, kind: 'board', theme: 'slate' } as unknown as Tab;
    const { added } = add('plan', undefined, board);
    expect(added).toMatchObject({ opensIn: 'plan', theme: 'slate' });
    expect(added.kind).toBeUndefined();
  });

  it("in any mode, opens on that mode's own start with no Quick Start over it", () => {
    // From Plan's mode menu: Start Illustrating, Start Drawing, Start Facilitating are each the new tab's start.
    for (const mode of ['illustrate', 'draw', 'facilitate'] as const) {
      const tab = add('plan', mode);
      expect(tab.added.opensIn).toBe(mode);
      expect(tab.setTemplatePickerMode).not.toHaveBeenCalled();
    }
  });
});

// docs/specs/013-workspace/tab-scoped-share-links.md: a tab-scoped (or view) link changes no tabs, so whichever
// control asks, no tab is added.
describe('adding a tab without the right to change tabs', () => {
  it('adds nothing', () => {
    const { commitTabs, setTemplatePickerMode } = run('plan', 'diagram', false);
    expect(commitTabs).not.toHaveBeenCalled();
    expect(setTemplatePickerMode).not.toHaveBeenCalled();
  });

  it("adds nothing from the + either, whatever the active tab's mode", () => {
    for (const mode of ['illustrate', 'plan', 'diagram'] as const)
      expect(run(mode, undefined, false).commitTabs).not.toHaveBeenCalled();
  });
});
