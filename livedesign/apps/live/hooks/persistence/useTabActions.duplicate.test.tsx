// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NAME_MAX_LENGTH, type Element, type Tab } from '@livedesign/design';
import { useTabActions } from './useTabActions';

// Duplicate copies a tab, named as a copy (docs/specs/006-design/name-length.md), its elements re-minted alongside.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const square = { id: 's1', type: 'shape', shape: 'square', x: 0, y: 0, width: 80, height: 80 };

function duplicate(src: Tab): Tab {
  const commitTabs = vi.fn();
  const deps = new Proxy<Record<string, unknown>>(
    {
      tabs: [src],
      activeId: src.id,
      canEditStructure: true,
      isTabLoaded: () => true,
      commitTabs,
    },
    // Every other dependency the hook takes is a no-op here.
    { get: (target, key: string) => (key in target ? target[key] : vi.fn()) },
  );
  const { result } = renderHook(() => useTabActions(deps as never));
  result.current.duplicateTab(src.id);
  const update = commitTabs.mock.calls[0]![0] as (ts: Tab[]) => Tab[];
  return update([src]).at(-1)!;
}

describe('duplicating a tab', () => {
  it('names the copy after its source', () => {
    const copy = duplicate({ id: 't1', name: 'Plans', elements: [square] } as unknown as Tab);
    expect(copy.name).toBe('Plans copy');
    expect(copy.elements).toHaveLength(1);
  });

  it("keeps a full-length name's copy under the name cap", () => {
    const name = 'Quarterly platform migration plan for the payments team 2027';
    expect([...name]).toHaveLength(NAME_MAX_LENGTH);
    const copy = duplicate({ id: 't1', name, elements: [] });
    expect([...copy.name].length).toBeLessThanOrEqual(NAME_MAX_LENGTH);
    expect(copy.name.endsWith('…')).toBe(true);
  });

  it("keeps an attached badge on its host's copy", () => {
    const badge = {
      id: 'b1',
      type: 'shape',
      shape: 'badge',
      attachedTo: 's1',
      attachAt: 'top-right',
    } as unknown as Element;
    const copy = duplicate({
      id: 't1',
      name: 'Plans',
      elements: [square, badge],
    } as unknown as Tab);
    const [host, chip] = copy.elements as { id: string; attachedTo?: string }[];
    expect(host!.id).not.toBe('s1');
    expect(chip!.attachedTo).toBe(host!.id);
  });
});
