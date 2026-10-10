// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EditorMode, Tab } from '@livediagram/document';
import { useTabActions } from './useTabActions';

// docs/specs/007-editor/editor-modes.md: a tab added from Plan opens in Plan with no Quick Start.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const first = { id: 't1', name: 'Tab 1', elements: [] } as unknown as Tab;

function add(editorMode: EditorMode) {
  const commitTabs = vi.fn();
  const setTemplatePickerMode = vi.fn();
  const deps = new Proxy(
    {
      tabs: [first],
      activeId: 't1',
      editorMode,
      createTab: (name: string) => ({ id: 't2', name, elements: [] }) as unknown as Tab,
      commitTabs,
      setTemplatePickerMode,
    } as Record<string, unknown>,
    // Every other dependency the hook takes is a no-op here.
    { get: (target, key: string) => (key in target ? target[key] : vi.fn()) },
  );
  const { result } = renderHook(() => useTabActions(deps as never));
  result.current.addTab();
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
});
