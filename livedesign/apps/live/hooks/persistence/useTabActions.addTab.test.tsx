// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedesign/design';
import { useTabActions } from './useTabActions';

// docs/specs/007-editor/pages-mode.md "One mode": every tab opens in Pages.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const first = { id: 't1', name: 'Tab 1', elements: [] } as unknown as Tab;

function run(canEditStructure = true, active: Tab = first) {
  const commitTabs = vi.fn();
  const deps = new Proxy<Record<string, unknown>>(
    {
      tabs: [active],
      activeId: 't1',
      canEditStructure,
      createTab: (name: string) => ({ id: 't2', name, elements: [] }) as unknown as Tab,
      commitTabs,
    },
    // Every other dependency the hook takes is a no-op here.
    { get: (target, key: string) => (key in target ? target[key] : vi.fn()) },
  );
  const { result } = renderHook(() => useTabActions(deps as never));
  result.current.addTab();
  return { commitTabs };
}

function add(active: Tab = first) {
  const { commitTabs } = run(true, active);
  const update = commitTabs.mock.calls[0]![0] as (ts: Tab[]) => Tab[];
  return { added: update([active]).at(-1)! };
}

describe('adding a tab', () => {
  it('adds a tab named for its place', () => {
    expect(add().added).toMatchObject({ id: 't2', name: 'Tab 2' });
  });

  it('carries the active tab look', () => {
    const themed = { ...first, theme: 'slate' } as unknown as Tab;
    expect(add(themed).added).toMatchObject({ theme: 'slate' });
  });
});

// docs/specs/013-workspace/tab-scoped-share-links.md: a tab-scoped (or view) link changes no tabs, so whichever
// control asks, no tab is added.
describe('adding a tab without the right to change tabs', () => {
  it('adds nothing', () => {
    expect(run(false).commitTabs).not.toHaveBeenCalled();
  });
});
