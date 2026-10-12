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

  it('makes every element follow the new finish, in the same step', () => {
    const h = setup([box('a', { finish: 'sketch' }), box('b')]);
    h.api.setTabFinish('professional');
    expect(h.commitTabs).toHaveBeenCalledTimes(1);
    for (const el of h.tabs()[0]!.elements) expect('finish' in el, el.id).toBe(false);
  });

  it('letters every element in the new font, and sizes every one at the new size', () => {
    const h = setup([box('a', { font: 'lora', textSize: 'sm' }), box('b')]);
    h.api.setTabFont('inter');
    expect(h.tabs()[0]!.font).toBe('inter');
    for (const el of h.tabs()[0]!.elements) expect('font' in el, el.id).toBe(false);
    h.api.setTabDefaultTextSize('lg');
    expect(h.tabs()[0]!.defaultTextSize).toBe('lg');
    for (const el of h.tabs()[0]!.elements)
      expect((el as { textSize?: string }).textSize, el.id).toBe('lg');
  });

  it('does nothing when edits are blocked (a Participant or Viewer)', () => {
    const h = setup([box('a', { finish: 'sketch' })], true);
    h.api.setTabFinish('professional');
    h.api.setTabFont('inter');
    h.api.setTabDefaultTextSize('lg');
    expect(h.commitTabs).not.toHaveBeenCalled();
  });
});

// Looks (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks").
describe('useTabCanvas applyTabLook', () => {
  it('sets the theme, finish, font and pattern as one step, and tracks it', () => {
    track.mockClear();
    const h = setup([box('a')]);
    h.api.applyTabLook('boardroom');
    expect(h.commitTabs).toHaveBeenCalledTimes(1);
    const t = h.tabs()[0]!;
    expect([t.theme, t.finish, t.font, t.backgroundPattern]).toEqual([
      'steel',
      'professional',
      'inter',
      'blank',
    ]);
    expect(h.tabs()[1]!.theme).toBeUndefined();
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'Look');
  });

  it('ignores an unknown look and a blocked session', () => {
    const h = setup([box('a')]);
    h.api.applyTabLook('nope');
    expect(h.commitTabs).not.toHaveBeenCalled();
    const blocked = setup([box('a')], true);
    blocked.api.applyTabLook('everyday');
    expect(blocked.commitTabs).not.toHaveBeenCalled();
  });
});
