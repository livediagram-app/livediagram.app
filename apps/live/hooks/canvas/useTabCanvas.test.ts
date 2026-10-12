// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { useTabCanvas } from './useTabCanvas';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', async (orig) => ({
  ...(await orig<typeof import('@/lib/telemetry')>()),
  track,
}));

// The tab's finish setters (docs/specs/008-canvas/finish.md "Where it is set").
const box = (id: string, over: Record<string, unknown> = {}): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, ...over }) as Element;

function setup(elements: Element[], editsBlocked = false) {
  let tabs: Tab[] = [
    { id: 't1', name: 'One', elements } as Tab,
    { id: 't2', name: 'Two', elements: [] } as Tab,
  ];
  const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  });
  let els = elements;
  const commit = vi.fn((map: (e: Element[]) => Element[]) => {
    els = map(els);
  });
  const { result } = renderHook(() =>
    useTabCanvas({
      editsBlocked,
      activeId: 't1',
      activeTab: tabs[0]!,
      commit,
      commitTabs,
      tickTabs: vi.fn(),
      checkpointBurst: vi.fn(),
    }),
  );
  return { api: result.current, tabs: () => tabs, els: () => els, commit, commitTabs };
}

describe('useTabCanvas finish', () => {
  it('sets the active tab’s finish as one step, and tracks it', () => {
    track.mockClear();
    const h = setup([]);
    h.api.setTabFinish('sketch');
    expect(h.commitTabs).toHaveBeenCalledTimes(1);
    expect(h.tabs()[0]!.finish).toBe('sketch');
    expect(h.tabs()[1]!.finish).toBeUndefined();
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'Finish');
  });

  it('Apply to All clears every element’s own finish and leaves the rest alone', () => {
    track.mockClear();
    const plain = box('c');
    const h = setup([box('a', { finish: 'sketch' }), box('b', { finish: 'flexible' }), plain]);
    h.api.applyTabFinishToAll();
    expect(h.commit).toHaveBeenCalledTimes(1);
    for (const el of h.els()) expect('finish' in el, el.id).toBe(false);
    expect(h.els()[2]).toBe(plain);
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'FinishToAll');
  });

  it('Apply to All writes nothing when no element has its own finish', () => {
    const h = setup([box('a')]);
    h.api.applyTabFinishToAll();
    expect(h.commit).not.toHaveBeenCalled();
  });

  it('does nothing when edits are blocked (a Participant or Viewer)', () => {
    const h = setup([box('a', { finish: 'sketch' })], true);
    h.api.setTabFinish('professional');
    h.api.applyTabFinishToAll();
    expect(h.commitTabs).not.toHaveBeenCalled();
    expect(h.commit).not.toHaveBeenCalled();
  });
});
