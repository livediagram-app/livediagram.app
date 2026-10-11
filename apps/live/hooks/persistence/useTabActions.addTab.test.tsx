// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EditorMode, Tab } from '@livediagram/document';
import { useTabActions } from './useTabActions';

// docs/specs/007-editor/editor-modes.md: a tab added from Plan opens in Plan with no Quick Start.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const first = { id: 't1', name: 'Tab 1', elements: [] } as unknown as Tab;

function run(editorMode: EditorMode, inMode?: EditorMode, canEditStructure = true) {
  const commitTabs = vi.fn();
  const setTemplatePickerMode = vi.fn();
  const deps = new Proxy(
    {
      tabs: [first],
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

function add(editorMode: EditorMode, inMode?: EditorMode) {
  const { commitTabs, setTemplatePickerMode } = run(editorMode, inMode);
  const update = commitTabs.mock.calls[0]![0] as (ts: Tab[]) => Tab[];
  return { added: update([first]).at(-1)!, setTemplatePickerMode };
}

describe('adding a tab', () => {
  it('from Plan, opens it in Plan with no Quick Start', () => {
    const { added, setTemplatePickerMode } = add('plan');
    expect(added.opensIn).toBe('plan');
    expect(setTemplatePickerMode).not.toHaveBeenCalled();
  });

  it('from any other mode, opens the Quick Start and sets no opening mode', () => {
    const { added, setTemplatePickerMode } = add('diagram');
    expect(added.opensIn).toBeUndefined();
    expect(setTemplatePickerMode).toHaveBeenCalledWith('templates');
  });

  it('in a mode with its own start (Illustrate, Plan), opens no Quick Start over it', () => {
    // From Plan's mode menu, a new Illustrate tab: What Is This Page For? is its start.
    const illustrate = add('plan', 'illustrate');
    expect(illustrate.added.opensIn).toBe('illustrate');
    expect(illustrate.setTemplatePickerMode).not.toHaveBeenCalled();
    const draw = add('plan', 'draw');
    expect(draw.added.opensIn).toBe('draw');
    expect(draw.setTemplatePickerMode).toHaveBeenCalledWith('templates');
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
});
