// @vitest-environment jsdom

// docs/specs/008-canvas/layout-cleanup.md "Hover to see it first": a hover lays the tab out from one
// snapshot (so a sweep never stacks layouts), present-only, flagged so autosave skips it, and the revert
// restores the tab it snapshotted and no other.

import { renderHook } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { createPinnedArrow, createShape, type Element, type Tab } from '@liveplanner/document';
import { cleanupElements } from '@/lib/tab-cleanup';
import { useCleanupPreview } from './useCleanupPreview';
import { loadTidyEngine } from '@/lib/tidy-engine';

// The tidiers load on demand (lib/tidy-engine.ts); these tests start with them loaded.
beforeAll(async () => {
  await loadTidyEngine();
});

const at = (id: string, x: number, y: number): Element => ({
  ...createShape('square', x, y),
  id,
  width: 120,
  height: 60,
});
const link = (from: string, to: string): Element => ({
  ...createPinnedArrow(from, 's', to, 'n'),
  id: `arr-${from}-${to}`,
});

// A small graph drawn untidily, so every tidier moves something.
const graph = (): Element[] => [
  at('a', 7, 3),
  at('b', 413, 211),
  at('c', 31, 389),
  link('a', 'b'),
  link('a', 'c'),
];

// `tabsRef` mirrors React state only after a render in production; the hook writes it eagerly, which
// is what this harness relies on by never syncing it itself.
function harness(opts: { editsBlocked?: boolean; tabs?: Tab[] } = {}) {
  let committed: Tab[] = opts.tabs ?? [
    { id: 'tab1', name: 'One', elements: graph() },
    { id: 'tab2', name: 'Two', elements: [at('z', 0, 0)] },
  ];
  const tabsRef = { current: committed };
  const previewingRef = { current: false };
  let ticks = 0;
  let activeId = 'tab1';
  const { result, rerender } = renderHook(() =>
    useCleanupPreview({
      editsBlocked: opts.editsBlocked ?? false,
      activeId,
      tabsRef: tabsRef,
      tickTabs: (map) => {
        ticks++;
        committed = map(committed);
      },
      previewingRef,
    }),
  );
  return {
    api: () => result.current,
    tab: (id: string) => committed.find((t) => t.id === id)!,
    switchTo: (id: string) => {
      activeId = id;
      rerender();
    },
    previewingRef,
    ticks: () => ticks,
  };
}

describe('useCleanupPreview', () => {
  it('lays the tab out exactly as the press would, and flags the preview for autosave', () => {
    const h = harness();
    const before = h.tab('tab1').elements;
    h.api().previewCleanup('tree');
    expect(h.tab('tab1').elements).toEqual(cleanupElements(before, 'tree'));
    expect(h.previewingRef.current).toBe(true);
  });

  it('lays out every hover from the first snapshot, so a sweep never stacks layouts', () => {
    const h = harness();
    const before = h.tab('tab1').elements;
    h.api().previewCleanup('tree');
    h.api().endCleanupPreview();
    h.api().previewCleanup('mindmap');
    h.api().previewCleanup('flow-right');
    expect(h.tab('tab1').elements).toEqual(cleanupElements(before, 'flow-right'));
  });

  it('puts the tab back as it was and clears the flag', () => {
    const h = harness();
    const before = h.tab('tab1').elements;
    h.api().previewCleanup('smart');
    h.api().endCleanupPreview();
    expect(h.tab('tab1').elements).toBe(before);
    expect(h.previewingRef.current).toBe(false);
  });

  it('restores only the tab it snapshotted after a tab switch mid-hover', () => {
    const h = harness();
    const one = h.tab('tab1').elements;
    const two = h.tab('tab2').elements;
    h.api().previewCleanup('tree');
    h.switchTo('tab2');
    h.api().endCleanupPreview();
    expect(h.tab('tab1').elements).toBe(one);
    expect(h.tab('tab2').elements).toBe(two);
  });

  it('does nothing while edits are blocked, on an empty tab, or with no preview to end', () => {
    const blocked = harness({ editsBlocked: true });
    blocked.api().previewCleanup('smart');
    blocked.api().endCleanupPreview();
    expect(blocked.ticks()).toBe(0);
    expect(blocked.previewingRef.current).toBe(false);

    const empty = harness({ tabs: [{ id: 'tab1', name: 'One', elements: [] }] });
    empty.api().previewCleanup('smart');
    expect(empty.ticks()).toBe(0);
    expect(empty.previewingRef.current).toBe(false);
  });
});
