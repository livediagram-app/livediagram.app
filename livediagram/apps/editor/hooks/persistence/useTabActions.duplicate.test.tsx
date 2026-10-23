// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { useTabActions } from './useTabActions';

// Duplicate copies a tab, named as a copy, its elements alongside.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

function duplicate(src: Tab): Tab {
  const commitTabs = vi.fn();
  const deps = new Proxy<Record<string, unknown>>(
    {
      tabs: [src],
      activeId: src.id,
      commitTabs,
      isTabLoaded: () => true,
    },
    { get: (target, key: string) => (key in target ? target[key] : vi.fn()) },
  );
  const { result } = renderHook(() => useTabActions(deps as never));
  result.current.duplicateTab(src.id);
  const update = commitTabs.mock.calls[0]![0] as (ts: Tab[]) => Tab[];
  return update([src]).at(-1)!;
}

const square = { id: 's1', type: 'shape', shape: 'square' } as unknown as Element;

describe('duplicating a tab', () => {
  it('names the copy as a copy and carries its elements', () => {
    const copy = duplicate({ id: 't1', name: 'Plans', elements: [square] });
    expect(copy.name).toBe('Plans copy');
    expect(copy.elements).toHaveLength(1);
  });
});
